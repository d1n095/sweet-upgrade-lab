import { supabase } from '@/integrations/supabase/client';

interface ChangeLogEntry {
  change_type?: string;
  description: string;
  affected_components?: string[];
  source?: 'lovable' | 'ai' | 'manual' | 'automation' | 'system';
  work_item_id?: string;
  bug_report_id?: string;
  scan_id?: string;
  prompt_queue_id?: string;
  metadata?: Record<string, any>;
}

export const logChange = async (entry: ChangeLogEntry) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('change_log' as any).insert({
      change_type: entry.change_type || 'update',
      description: entry.description,
      affected_components: entry.affected_components || [],
      source: entry.source || 'manual',
      work_item_id: entry.work_item_id || null,
      bug_report_id: entry.bug_report_id || null,
      scan_id: entry.scan_id || null,
      prompt_queue_id: entry.prompt_queue_id || null,
      metadata: entry.metadata || {},
      created_by: session?.user?.id || null,
    });
  } catch (e) {
    console.warn('Change log write failed:', e);
  }
};
