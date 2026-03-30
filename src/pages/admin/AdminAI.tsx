import { useState, useCallback } from 'react';
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
import { ChangeLogTab } from './tabs/ChangeLogTab';

const AdminAI = () => {
  const [detailItem, setDetailItem] = useState<any>(null);
  const queryClient = useQueryClient();

  const openDetail = useCallback(async (itemId: string) => {
    const { data } = await supabase.from('work_items' as any).select('*').eq('id', itemId).maybeSingle();
    if (data) setDetailItem(data);
    else toast.error('Uppgiften hittades inte');
  }, []);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status: newStatus, updated_at: now };
    if (newStatus === 'done') updates.completed_at = now;
    await supabase.from('work_items' as any).update(updates).eq('id', itemId);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
    queryClient.invalidateQueries({ queryKey: ['ai-managed-items'] });
    if (newStatus === 'done') {
      // Look up linked IDs from the work item for full traceability
      const { data: wi } = await supabase.from('work_items' as any).select('source_type, source_id, title').eq('id', itemId).maybeSingle();
      const linkedBugId = (wi as any)?.source_type === 'bug_report' ? (wi as any)?.source_id : null;
      const linkedScanId = ['scan', 'ai_visual_qa', 'ai_detection'].includes((wi as any)?.source_type) ? (wi as any)?.source_id : null;
      triggerAiReviewForWorkItem(itemId, { context: 'admin_ai_detail' });
      logChange({ change_type: 'fix', description: `Work item slutförd: ${(wi as any)?.title || itemId}`, source: 'manual', affected_components: ['work_items'], work_item_id: itemId, bug_report_id: linkedBugId, scan_id: linkedScanId });
      if (linkedBugId) queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
    }
  };

  return (
    <DetailContext.Provider value={{ openDetail }}>
    <div className="flex flex-col min-h-0 h-full">
      <SafeModeBanner />
      <div className="min-h-0 flex-1 flex flex-col">
        <AiCenterTabs defaultValue="ai-dashboard">
          {/* Dashboard */}
          <div data-value="system-state"><SystemStateDashboard /></div>
          <div data-value="unified-pipeline"><UnifiedPipelineDashboard /></div>
          <div data-value="health"><SystemHealthTab /></div>
          <div data-value="insights"><DataInsightsTab /></div>

          {/* Operations */}
          <div data-value="lova-chat"><LovaChatTab /></div>
          <div data-value="autopilot"><AiAutopilotTab /></div>
          <div data-value="actions"><ActionEngineTab /></div>
          <div data-value="tasks"><TaskAITab /></div>
          <div data-value="bugs" className="flex flex-col min-h-0 h-full"><BugAITab /></div>

          {/* User management */}
          <div data-value="user-management"><AiUserManagementTab /></div>

          {/* Scanners */}
          <div data-value="scan"><SystemScanTab /></div>
          <div data-value="access-control"><AccessControlTab /></div>
          <div data-value="visual-qa"><VisualQATab /></div>
          <div data-value="ux-scanner"><UxScannerTab /></div>
          <div data-value="sync-scan"><SyncScannerTab /></div>

          {/* System */}
          <div data-value="safe-mode"><SafeModePanel /></div>
          <div data-value="trust-score"><SystemTrustScore /></div>
          <div data-value="data-flow"><DataFlowValidator /></div>
          <div data-value="cleanup"><DataCleanupTab /></div>
          <div data-value="change-log"><ChangeLogTab /></div>
          <div data-value="ai-reads"><AdminAiReadLog /></div>
        </AiCenterTabs>
      </div>

      <WorkItemDetail
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => { if (!open) setDetailItem(null); }}
        onStatusChange={handleStatusChange}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['work-items'] });
          queryClient.invalidateQueries({ queryKey: ['ai-managed-items'] });
          if (detailItem) {
            supabase.from('work_items' as any).select('*').eq('id', detailItem.id).maybeSingle().then(({ data }) => {
              if (data) setDetailItem(data);
            });
          }
        }}
      />
    </div>
    </DetailContext.Provider>
  );
};

export default AdminAI;
