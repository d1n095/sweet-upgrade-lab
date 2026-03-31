import { create } from 'zustand';

export type PipelineSeverity = 'high' | 'medium' | 'low';
export type PipelineStatus = 'new' | 'in_progress' | 'done' | 'dismissed';

export interface PipelineWorkItem {
  id: number;
  file: string;
  message: string;
  severity: PipelineSeverity;
  status: PipelineStatus;
  createdAt: number;
}

interface PipelineState {
  workItems: PipelineWorkItem[];
  pushToPipeline: (issues: { type?: string; message: string; file: string; severity?: string }[]) => void;
  updateStatus: (id: number, status: PipelineStatus) => void;
  clearDone: () => void;
}

let _idCounter = 1;

export const usePipelineStore = create<PipelineState>((set) => ({
  workItems: [],

  pushToPipeline: (issues) => {
    const items: PipelineWorkItem[] = issues.map(issue => ({
      id: _idCounter++,
      file: issue.file || '',
      message: issue.message || '',
      severity: (['high', 'medium', 'low'].includes(issue.severity || '') ? issue.severity : 'low') as PipelineSeverity,
      status: 'new',
      createdAt: Date.now(),
    }));

    set(state => ({ workItems: [...state.workItems, ...items] }));
    console.log('📦 PIPELINE ITEMS:', items.length);
  },

  updateStatus: (id, status) => {
    set(state => ({
      workItems: state.workItems.map(i => i.id === id ? { ...i, status } : i),
    }));
  },

  clearDone: () => {
    set(state => ({
      workItems: state.workItems.filter(i => i.status !== 'done' && i.status !== 'dismissed'),
    }));
  },
}));

const SEVERITY_ORDER: Record<PipelineSeverity, number> = { high: 3, medium: 2, low: 1 };

export const getPrioritized = (workItems: PipelineWorkItem[]) =>
  [...workItems].sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 1) - (SEVERITY_ORDER[a.severity] ?? 1));
