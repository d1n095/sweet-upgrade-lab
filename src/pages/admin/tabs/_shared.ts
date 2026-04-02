import { createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Context to allow any tab to open a work item detail view
export const DetailContext = createContext<{
  openDetail: (itemId: string) => void;
}>({ openDetail: () => {} });

export const useDetailContext = () => useContext(DetailContext);

export interface GeneratedPrompt {
  title: string;
  goal: string;
  problem?: string;
  steps: string[];
  expected_result: string;
  tags: string[];
  category: string;
  priority: string;
  full_prompt: string;
}

export interface DataInsight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  action: string;
}

export interface DataAnalysis {
  insights: DataInsight[];
  summary: string;
  health_score: number;
  raw_metrics?: Record<string, number>;
  work_items_created?: number;
}

export interface UnifiedArea {
  name: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  actions: string[];
}

export interface UnifiedReport {
  overall_score: number;
  overall_status: 'healthy' | 'warning' | 'critical';
  executive_summary: string;
  areas: UnifiedArea[];
  top_priorities: { title: string; urgency: 'now' | 'today' | 'this_week'; reason: string }[];
  raw_metrics?: Record<string, number>;
}

export const callAI = async (_type: string, _payload: Record<string, any> = {}): Promise<any> => {
  console.warn('[AI DISABLED] callAI blocked:', _type);
  return null;
};

export const callTaskManager = async (_action: string): Promise<any> => {
  console.warn('[AI DISABLED] callTaskManager blocked:', _action);
  return null;
};

export const copyToClipboard = (text: string, buttonId?: string) => {
  const clean = text.replace(/[#*`_~>]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  navigator.clipboard.writeText(clean);
  if (buttonId) {
    const el = document.getElementById(buttonId);
    if (el) {
      el.textContent = '✓ Kopierad';
      el.classList.add('text-green-600');
      setTimeout(() => { el.textContent = '📋 Copy Fix'; el.classList.remove('text-green-600'); }, 2000);
    }
  }
  toast.success('Kopierat till urklipp');
};

export const applyFix = async (
  fixText: string,
  issueTitle: string,
  opts?: { category?: string; severity?: string; workItemId?: string; bugId?: string; buttonId?: string }
): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error('Ej inloggad'); return false; }

  // UI feedback: show loading
  if (opts?.buttonId) {
    const el = document.getElementById(opts.buttonId);
    if (el) { el.textContent = '⏳ Analyserar...'; el.setAttribute('disabled', 'true'); }
  }

  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apply-fix`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fix_text: fixText,
          issue_title: issueTitle,
          issue_category: opts?.category,
          issue_severity: opts?.severity,
          source_work_item_id: opts?.workItemId,
          source_bug_id: opts?.bugId,
        }),
      }
    );

    const data = await resp.json();

    if (opts?.buttonId) {
      const el = document.getElementById(opts.buttonId);
      if (el) el.removeAttribute('disabled');
    }

    if (!resp.ok) {
      toast.error(data.error || 'Apply fix misslyckades');
      if (opts?.buttonId) {
        const el = document.getElementById(opts.buttonId);
        if (el) { el.textContent = '❌ Misslyckades'; setTimeout(() => { el.textContent = '⚡ Apply Fix'; }, 2000); }
      }
      return false;
    }

    if (data.executed && data.success) {
      toast.success(data.message || '✅ Fix applicerad!');
      if (opts?.buttonId) {
        const el = document.getElementById(opts.buttonId);
        if (el) { el.textContent = '✅ Applicerad'; el.classList.add('text-green-600'); setTimeout(() => { el.textContent = '⚡ Apply Fix'; el.classList.remove('text-green-600'); }, 3000); }
      }
      return true;
    } else if (data.executed && !data.success) {
      toast.warning(data.message || '⚠️ Delvis applicerad');
      return false;
    } else {
      // Not executable — fallback to copy
      const reason = data.plan?.fix_type === 'code_change' ? 'Kräver kodändring — kopierad till urklipp' : (data.message || 'Kan inte auto-appliceras');
      toast.info(`📋 ${reason}`);
      copyToClipboard(fixText);
      if (opts?.buttonId) {
        const el = document.getElementById(opts.buttonId);
        if (el) { el.textContent = '📋 Kopierad'; setTimeout(() => { el.textContent = '⚡ Apply Fix'; }, 2000); }
      }
      return false;
    }
  } catch (e: any) {
    toast.error('Apply fix fel: ' + (e.message || 'okänt'));
    if (opts?.buttonId) {
      const el = document.getElementById(opts.buttonId);
      if (el) { el.removeAttribute('disabled'); el.textContent = '⚡ Apply Fix'; }
    }
    return false;
  }
};
