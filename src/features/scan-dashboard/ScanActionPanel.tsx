import React, { useState } from 'react';
import { Copy, CheckCheck, CheckCircle2, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { ScanIssue } from './ScanIssuesList';

interface ScanActionPanelProps {
  issue: ScanIssue;
  fixText?: string;
  onMarkResolved?: (issue: ScanIssue) => void;
  onIgnore?: (issue: ScanIssue) => void;
}

function buildFixPrompt(issue: ScanIssue, fixText?: string): string {
  const parts: string[] = [
    `Problem: ${issue.title}`,
  ];
  if (issue.description) {
    parts.push(`Beskrivning: ${issue.description}`);
  }
  const affectedArea =
    issue._raw?.target ||
    issue._raw?.component ||
    issue._raw?.route ||
    issue._raw?.path;
  if (affectedArea) {
    parts.push(`Berörd del: ${String(affectedArea)}`);
  }
  if (fixText) {
    parts.push(`Föreslagen åtgärd: ${fixText}`);
  }
  return parts.join('\n');
}

export function ScanActionPanel({ issue, fixText, onMarkResolved, onIgnore }: ScanActionPanelProps) {
  const [copied, setCopied] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [ignored, setIgnored] = useState(false);

  const handleCopy = async () => {
    const prompt = buildFixPrompt(issue, fixText);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('Fixprompt kopierad till urklipp');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kunde inte kopiera till urklipp');
    }
  };

  const handleResolve = () => {
    setResolved(true);
    onMarkResolved?.(issue);
    toast.success('Markerat som löst');
  };

  const handleIgnore = () => {
    setIgnored(true);
    onIgnore?.(issue);
    toast.info('Problem ignorerat');
  };

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="gap-1.5 text-xs"
      >
        {copied ? (
          <><CheckCheck className="w-3.5 h-3.5 text-green-500" />Kopierad!</>
        ) : (
          <><Copy className="w-3.5 h-3.5" />Kopiera fixprompt</>
        )}
      </Button>

      <Button
        size="sm"
        variant={resolved ? 'default' : 'outline'}
        onClick={handleResolve}
        disabled={resolved}
        className={`gap-1.5 text-xs ${resolved ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        {resolved ? 'Markerat som löst' : 'Markera som löst'}
      </Button>

      <Button
        size="sm"
        variant={ignored ? 'secondary' : 'ghost'}
        onClick={handleIgnore}
        disabled={ignored}
        className="gap-1.5 text-xs text-muted-foreground"
      >
        <EyeOff className="w-3.5 h-3.5" />
        {ignored ? 'Ignorerat' : 'Ignorera'}
      </Button>
    </div>
  );
}
