#!/usr/bin/env python3
"""
Splits AdminAI.tsx into individual tab files under src/pages/admin/tabs/.
Pure refactoring - no logic changes.
"""

import os
import re

SRC = '/home/runner/work/sweet-upgrade-lab/sweet-upgrade-lab/src/pages/admin/AdminAI.tsx'
TABS_DIR = '/home/runner/work/sweet-upgrade-lab/sweet-upgrade-lab/src/pages/admin/tabs'

with open(SRC, 'r') as f:
    lines = f.readlines()

def get_lines(start, end):
    """Get lines start..end (1-indexed, inclusive)."""
    return ''.join(lines[start-1:end])

# ─────────────────────────────────────────────
# Helper: build import statements
# ─────────────────────────────────────────────

ALL_ICONS = [
    'Sparkles','Bug','BarChart3','Copy','Loader2','Send','AlertTriangle','Lightbulb',
    'Info','RefreshCw','Bot','CheckCircle','XCircle','Shield','Clock','Zap','Activity',
    'TrendingUp','Package','AlertCircle','Database','Wrench','Radar','ArrowRight',
    'Layers','Monitor','Smartphone','Tablet','Eye','Compass','LayoutGrid','GitMerge',
    'ArrowRightLeft','ShieldCheck','Play','Settings2','ToggleRight','Maximize2',
    'Gavel','ChevronDown','History','User','Brain',
]

REACT_HOOKS = ['useState','useEffect','useRef','useCallback','useMemo','useContext']

UI_COMPONENTS = {
    'Button': '@/components/ui/button',
    'Textarea': '@/components/ui/textarea',
    'Input': '@/components/ui/input',
    'Badge': '@/components/ui/badge',
    'Separator': '@/components/ui/separator',
    'ScrollArea': '@/components/ui/scroll-area',
    'Card': '@/components/ui/card',
    'CardContent': '@/components/ui/card',
    'CardHeader': '@/components/ui/card',
    'CardTitle': '@/components/ui/card',
    'Progress': '@/components/ui/progress',
}

def build_imports(code: str, extra_from_shared=None, include_detail_context=False):
    """Build import block for a tab file based on what's actually used in code."""
    parts = []

    # 1. React hooks
    hooks = [h for h in REACT_HOOKS if re.search(r'\b' + h + r'\b', code)]
    if hooks:
        parts.append(f"import {{ {', '.join(hooks)} }} from 'react';")

    # 2. Lucide icons
    icons = [i for i in ALL_ICONS if re.search(r'\b' + i + r'\b', code)]
    if icons:
        parts.append(f"import {{ {', '.join(icons)} }} from 'lucide-react';")

    # 3. UI components (group by import path)
    used_ui = {comp: path for comp, path in UI_COMPONENTS.items()
               if re.search(r'\b' + comp + r'\b', code)}
    by_path = {}
    for comp, path in used_ui.items():
        by_path.setdefault(path, []).append(comp)
    for path in ['@/components/ui/button','@/components/ui/textarea','@/components/ui/input',
                 '@/components/ui/badge','@/components/ui/separator','@/components/ui/scroll-area',
                 '@/components/ui/card','@/components/ui/progress']:
        if path in by_path:
            comps = sorted(by_path[path])
            parts.append(f"import {{ {', '.join(comps)} }} from '{path}';")

    # 4. External imports
    if re.search(r'\buseQuery\b', code) or re.search(r'\buseQueryClient\b', code):
        hooks_list = []
        if re.search(r'\buseQuery\b', code): hooks_list.append('useQuery')
        if re.search(r'\buseQueryClient\b', code): hooks_list.append('useQueryClient')
        parts.append(f"import {{ {', '.join(hooks_list)} }} from '@tanstack/react-query';")

    if re.search(r'\bsupabase\b', code):
        parts.append("import { supabase } from '@/integrations/supabase/client';")

    if re.search(r'\btoast\b', code):
        parts.append("import { toast } from 'sonner';")

    if re.search(r'\bcn\b', code):
        parts.append("import { cn } from '@/lib/utils';")

    if re.search(r'\blogChange\b', code):
        parts.append("import { logChange } from '@/utils/changeLogger';")

    if re.search(r'\bcreateAndVerify\b', code):
        parts.append("import { createAndVerify } from '@/utils/createVerifyLoop';")

    if re.search(r'\bcreateWorkItemWithDedup\b', code):
        parts.append("import { createWorkItemWithDedup } from '@/utils/workItemDedup';")

    if re.search(r'\btrace\b', code) or re.search(r'\bnewTraceId\b', code):
        items = []
        if re.search(r'\btrace\b', code): items.append('trace')
        if re.search(r'\bnewTraceId\b', code): items.append('newTraceId')
        parts.append(f"import {{ {', '.join(items)} }} from '@/utils/deepDebugTrace';")

    if re.search(r'\btriggerAiReviewForWorkItem\b', code):
        parts.append("import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';")

    if re.search(r'\bWorkItemDetail\b', code):
        parts.append("import WorkItemDetail from '@/components/admin/workbench/WorkItemDetail';")

    if re.search(r'\buseNavigate\b', code):
        parts.append("import { useNavigate } from 'react-router-dom';")

    if re.search(r'\buseScannerStore\b', code) or re.search(r'\bSCAN_STEPS\b', code):
        items = []
        if re.search(r'\buseScannerStore\b', code): items.append('useScannerStore')
        if re.search(r'\bSCAN_STEPS\b', code): items.append('SCAN_STEPS')
        parts.append(f"import {{ {', '.join(items)} }} from '@/stores/scannerStore';")
    if re.search(r'\bScanStepResult\b', code):
        parts.append("import type { ScanStepResult } from '@/stores/scannerStore';")

    if re.search(r'\buseFullScanOrchestrator\b', code) or re.search(r'\bORCHESTRATED_STEPS\b', code) or re.search(r'\bfilterRelevantIssues\b', code):
        items = []
        if re.search(r'\buseFullScanOrchestrator\b', code): items.append('useFullScanOrchestrator')
        if re.search(r'\bORCHESTRATED_STEPS\b', code): items.append('ORCHESTRATED_STEPS')
        if re.search(r'\bfilterRelevantIssues\b', code): items.append('filterRelevantIssues')
        parts.append(f"import {{ {', '.join(items)} }} from '@/stores/fullScanOrchestrator';")
    if re.search(r'\bUnifiedScanResult\b', code):
        parts.append("import type { UnifiedScanResult } from '@/stores/fullScanOrchestrator';")

    if re.search(r'\bAdminAiReadLog\b', code):
        parts.append("import AdminAiReadLog from '@/components/admin/AdminAiReadLog';")
    if re.search(r'\bAiQueueControl\b', code):
        parts.append("import AiQueueControl from '@/components/admin/AiQueueControl';")
    if re.search(r'\bDataFlowValidator\b', code):
        parts.append("import DataFlowValidator from '@/components/admin/DataFlowValidator';")
    if re.search(r'\bUiRealityCheck\b', code):
        parts.append("import UiRealityCheck from '@/components/admin/UiRealityCheck';")
    if re.search(r'\bSystemTrustScore\b', code):
        parts.append("import SystemTrustScore from '@/components/admin/SystemTrustScore';")
    if re.search(r'\bUnifiedPipelineDashboard\b', code):
        parts.append("import UnifiedPipelineDashboard from '@/components/admin/UnifiedPipelineDashboard';")
    if re.search(r'\bSystemStateDashboard\b', code):
        parts.append("import SystemStateDashboard from '@/components/admin/SystemStateDashboard';")
    if re.search(r'\bFailureMemoryPanel\b', code):
        parts.append("import FailureMemoryPanel from '@/components/admin/FailureMemoryPanel';")

    # 5. Shared imports
    shared_items = []
    if re.search(r'\bcallAI\b', code): shared_items.append('callAI')
    if re.search(r'\bcallTaskManager\b', code): shared_items.append('callTaskManager')
    if re.search(r'\bcopyToClipboard\b', code): shared_items.append('copyToClipboard')
    if re.search(r'\bapplyFix\b', code): shared_items.append('applyFix')
    if re.search(r'\buseDetailContext\b', code): shared_items.append('useDetailContext')
    if include_detail_context or re.search(r'\bDetailContext\b', code): shared_items.append('DetailContext')
    if re.search(r'\bGeneratedPrompt\b', code): shared_items.append('GeneratedPrompt')
    if re.search(r'\bDataInsight\b', code): shared_items.append('DataInsight')
    if re.search(r'\bDataAnalysis\b', code): shared_items.append('DataAnalysis')
    if re.search(r'\bUnifiedArea\b', code): shared_items.append('UnifiedArea')
    if re.search(r'\bUnifiedReport\b', code): shared_items.append('UnifiedReport')

    if extra_from_shared:
        for s in extra_from_shared:
            if s not in shared_items:
                shared_items.append(s)

    if shared_items:
        parts.append(f"import {{ {', '.join(shared_items)} }} from './_shared';")

    return '\n'.join(parts)

# ─────────────────────────────────────────────
# Write _shared.ts
# ─────────────────────────────────────────────

shared_content = get_lines(41, 211)

shared_file = '''import { createContext, useContext } from 'react';
import { logAICall } from '@/utils/aiGuard';
import { runAISafe } from '@/core/aiGateway';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

''' + shared_content

# Add export keywords
shared_file = shared_file.replace('const DetailContext = createContext', 'export const DetailContext = createContext')
shared_file = shared_file.replace('const useDetailContext = () =>', 'export const useDetailContext = () =>')
shared_file = shared_file.replace('interface GeneratedPrompt {', 'export interface GeneratedPrompt {')
shared_file = shared_file.replace('interface DataInsight {', 'export interface DataInsight {')
shared_file = shared_file.replace('interface DataAnalysis {', 'export interface DataAnalysis {')
shared_file = shared_file.replace('interface UnifiedArea {', 'export interface UnifiedArea {')
shared_file = shared_file.replace('interface UnifiedReport {', 'export interface UnifiedReport {')
shared_file = shared_file.replace('const callAI = async', 'export const callAI = async')
shared_file = shared_file.replace('const callTaskManager = async', 'export const callTaskManager = async')
shared_file = shared_file.replace('const copyToClipboard = (text', 'export const copyToClipboard = (text')
shared_file = shared_file.replace('const applyFix = async (', 'export const applyFix = async (')

with open(os.path.join(TABS_DIR, '_shared.ts'), 'w') as f:
    f.write(shared_file)
print('Wrote _shared.ts')

# ─────────────────────────────────────────────
# Tab definitions: (filename, start_line, end_line, component_name)
# plus optional extra notes
# ─────────────────────────────────────────────

tabs = [
    ('LovaChatTab', 'LovaChatTab', 214, 470),
    ('LovaPromptsTab', 'LovaPromptsTab', 472, 641),
    ('UnifiedDashboardTab', 'UnifiedDashboardTab', 643, 797),
    ('TaskAITab', 'TaskAITab', 799, 994),
    ('PromptGeneratorTab', 'PromptGeneratorTab', 996, 1078),
    ('DataInsightsTab', 'DataInsightsTab', 1080, 1175),
    ('BugAITab', 'BugAITab', 1176, 1390),
    ('ProductSuggestionsTab', 'ProductSuggestionsTab', 1391, 1479),
    ('SystemHealthTab', 'SystemHealthTab', 1480, 1615),
    ('TrendAnalysisPanel', 'TrendAnalysisPanel', 1616, 1797),
    ('SystemScanTab', 'SystemScanTab', 1798, 2441),
    ('ActionEngineTab', 'ActionEngineTab', 2441, 2677),
    ('DataIntegrityTab', 'DataIntegrityTab', 2678, 2780),
    ('ContentValidationTab', 'ContentValidationTab', 2781, 2927),
    ('PatternDetectionTab', 'PatternDetectionTab', 2928, 3061),
    ('DataHealthTab', 'DataHealthTab', 3062, 3193),
    ('FocusedScanTab', 'FocusedScanTab', 3194, 3364),
    ('NavBugScanTab', 'NavBugScanTab', 3365, 3597),
    ('VisualQATab', 'VisualQATab', 3598, 4309),
    ('StructureAnalysisTab', 'StructureAnalysisTab', 4310, 4467),
    ('DevGuardianTab', 'DevGuardianTab', 4468, 4601),
    ('AiAutopilotTab', 'AiAutopilotTab', 4602, 5210),
    ('InteractionQATab', 'InteractionQATab', 5211, 5531),
    ('VerificationEngineTab', 'VerificationEngineTab', 5532, 5697),
    ('DataCleanupTab', 'DataCleanupTab', 5698, 6049),
    ('AutoFixTab', 'AutoFixTab', 6050, 6182),
    ('OverflowScanTab', 'OverflowScanTab', 6183, 6382),
    ('UxScannerTab', 'UxScannerTab', 6383, 6542),
    ('AiUserManagementTab', 'AiUserManagementTab', 6543, 6821),
    ('AccessControlTab', 'AccessControlTab', 6822, 7172),
    ('SyncScannerTab', 'SyncScannerTab', 7173, 7311),
    ('ActionGovernorTab', 'ActionGovernorTab', 7312, 7493),
    ('PromptQueueTab', 'PromptQueueTab', 7494, 7653),
    ('ChangeLogTab', 'ChangeLogTab', 7654, 7755),
    ('OrchestrationTab', 'OrchestrationTab', 7760, 8054),
]

for (filename, component, start, end) in tabs:
    code = get_lines(start, end)

    # Add export to the component declaration
    # Handle both `const ComponentName = () => {` and type/interface declarations before it
    code = re.sub(
        r'^(const ' + component + r'\s*=\s*\()',
        r'export const ' + component + r' = (',
        code,
        count=1,
        flags=re.MULTILINE
    )

    import_block = build_imports(code)

    full_content = import_block + '\n\n' + code
    # Clean up extra blank lines at start
    full_content = full_content.lstrip('\n')

    out_path = os.path.join(TABS_DIR, filename + '.tsx')
    with open(out_path, 'w') as f:
        f.write(full_content)
    print(f'Wrote {filename}.tsx')

# ─────────────────────────────────────────────
# Write thin AdminAI.tsx
# ─────────────────────────────────────────────

# AdminAI starts at 7756, OrchestrationTab nested at 7760-8054
# After OrchestrationTab: lines 8056-8139
adminai_start = get_lines(7756, 7759)  # const AdminAI = () => { + state + queryClient
adminai_rest = get_lines(8056, 8139)   # openDetail + handleStatusChange + return + export

adminai_body = adminai_start + adminai_rest

adminai_imports = """import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { triggerAiReviewForWorkItem } from '@/lib/workItemAiReview';
import { logChange } from '@/utils/changeLogger';
import WorkItemDetail from '@/components/admin/workbench/WorkItemDetail';
import AiCenterTabs from '@/components/admin/AiCenterTabs';
import SafeModePanel, { SafeModeBanner } from '@/components/admin/SafeModePanel';
import AdminAiReadLog from '@/components/admin/AdminAiReadLog';
import SystemTrustScore from '@/components/admin/SystemTrustScore';
import DataFlowValidator from '@/components/admin/DataFlowValidator';
import UnifiedPipelineDashboard from '@/components/admin/UnifiedPipelineDashboard';
import SystemStateDashboard from '@/components/admin/SystemStateDashboard';
import { DetailContext } from './tabs/_shared';
import { LovaChatTab } from './tabs/LovaChatTab';
import { SystemHealthTab } from './tabs/SystemHealthTab';
import { DataInsightsTab } from './tabs/DataInsightsTab';
import { TaskAITab } from './tabs/TaskAITab';
import { BugAITab } from './tabs/BugAITab';
import { ActionEngineTab } from './tabs/ActionEngineTab';
import { AiAutopilotTab } from './tabs/AiAutopilotTab';
import { SystemScanTab } from './tabs/SystemScanTab';
import { AccessControlTab } from './tabs/AccessControlTab';
import { VisualQATab } from './tabs/VisualQATab';
import { UxScannerTab } from './tabs/UxScannerTab';
import { SyncScannerTab } from './tabs/SyncScannerTab';
import { AiUserManagementTab } from './tabs/AiUserManagementTab';
import { DataCleanupTab } from './tabs/DataCleanupTab';
import { ChangeLogTab } from './tabs/ChangeLogTab';"""

adminai_content = adminai_imports + '\n\n' + adminai_body

with open(SRC, 'w') as f:
    f.write(adminai_content)
print('Rewrote AdminAI.tsx (thin orchestrator)')
print('Done!')
