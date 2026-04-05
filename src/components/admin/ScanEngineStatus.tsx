import { useEffect, useState } from 'react';
import { getCurrentJob, type ScanJob } from '@/lib/scanEngine';
import { Loader2 } from 'lucide-react';

/**
 * Global scan engine status badge.
 * Shows a subtle indicator while a scan job is running.
 */
export function ScanEngineStatus() {
  const [job, setJob] = useState<ScanJob | null>(getCurrentJob());

  useEffect(() => {
    // Poll at 500ms intervals — lightweight since getCurrentJob() is a simple getter
    const interval = setInterval(() => {
      setJob(getCurrentJob());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!job || job.status !== 'running') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Scan running: {job.type}</span>
    </div>
  );
}

export default ScanEngineStatus;
