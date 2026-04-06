import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScanIssue } from './ScanIssuesList';
import { ScanActionPanel } from './ScanActionPanel';

const SOURCE_LABELS: Record<string, string> = {
  broken_flows: 'Trasigt flöde',
  fake_features: 'Saknad funktion',
  interaction_failures: 'Interaktionsfel',
  data_issues: 'Dataproblem',
};

const WHY_LABELS: Record<string, string> = {
  broken_flows:
    'Det här händer ofta när en funktion i systemet slutade fungera eller aldrig var fullt implementerad. Det kan bero på en bugg, en saknad backend-koppling eller ett fel i logiken.',
  fake_features:
    'En del av gränssnittet ser ut att fungera men gör ingenting i bakgrunden. Det här kan uppstå när en funktion börjades men aldrig slutfördes.',
  interaction_failures:
    'Användaren kan inte interagera med den här delen av systemet som förväntat. Det kan vara ett felaktigt formulär, en knapp som inte svarar eller felaktig validering.',
  data_issues:
    'Data läses eller sparas inte korrekt. Det kan handla om felaktig formatering, saknade fält eller trasiga kopplingar till databasen.',
};

const FIX_LABELS: Record<string, string> = {
  broken_flows:
    'Kontrollera koden för det berörda flödet. Se till att alla anrop till backend faktiskt returnerar rätt data och att eventuella felsteg hanteras.',
  fake_features:
    'Antingen implementera funktionen fullt ut eller ta bort den från gränssnittet tills den är klar. Låt inte användaren se knappar eller länkar som inte gör något.',
  interaction_failures:
    'Testa formuläret eller komponenten manuellt. Se till att formulärvalidering, event-hantering och API-anrop fungerar korrekt.',
  data_issues:
    'Granska datamodellen och kontrollera att rätt kolumner finns och att data sparas i korrekt format. Testa med exempeldata för att isolera problemet.',
};

function SeverityIcon({ severity }: { severity: ScanIssue['severity'] }) {
  if (severity === 'high') return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (severity === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
}

function SeverityBadge({ severity }: { severity: ScanIssue['severity'] }) {
  if (severity === 'high') return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Hög allvarlighet</Badge>;
  if (severity === 'medium') return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Medel allvarlighet</Badge>;
  return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Låg allvarlighet</Badge>;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium text-foreground"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 py-3 text-sm text-muted-foreground leading-relaxed">{children}</div>}
    </div>
  );
}

interface ScanIssueDetailsProps {
  issue: ScanIssue | null;
  onMarkResolved?: (issue: ScanIssue) => void;
  onIgnore?: (issue: ScanIssue) => void;
}

export function ScanIssueDetails({ issue, onMarkResolved, onIgnore }: ScanIssueDetailsProps) {
  if (!issue) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Klicka på ett problem i listan för att se detaljer och föreslagna åtgärder.
        </CardContent>
      </Card>
    );
  }

  const whyText =
    issue._raw?.why ||
    issue._raw?.root_cause ||
    issue._raw?.reason ||
    WHY_LABELS[issue._source] ||
    'Orsaken till det här problemet är inte helt klarlagd. Granska koden manuellt för att hitta rotorsaken.';

  const fixText =
    issue._raw?.fix ||
    issue._raw?.suggested_fix ||
    issue._raw?.recommendation ||
    FIX_LABELS[issue._source] ||
    'Granska det berörda området och testa manuellt för att identifiera och åtgärda problemet.';

  const fullDescription =
    issue._raw?.full_description ||
    issue._raw?.details ||
    issue._raw?.error_details ||
    issue.description ||
    'Ingen detaljerad beskrivning tillgänglig.';

  const affectedArea =
    issue._raw?.target ||
    issue._raw?.component ||
    issue._raw?.route ||
    issue._raw?.path ||
    null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <SeverityIcon severity={issue.severity} />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base leading-snug">{issue.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <SeverityBadge severity={issue.severity} />
              <span className="text-xs text-muted-foreground">
                {SOURCE_LABELS[issue._source] || issue._source}
              </span>
              {affectedArea && (
                <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                  {String(affectedArea)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <CollapsibleSection title="Vad är problemet?" defaultOpen>
          <p>{fullDescription}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Varför händer det här?" defaultOpen>
          <p>{whyText}</p>
        </CollapsibleSection>

        <CollapsibleSection title="Hur åtgärdar vi det?">
          <p>{fixText}</p>
        </CollapsibleSection>

        <ScanActionPanel
          issue={issue}
          fixText={fixText}
          onMarkResolved={onMarkResolved}
          onIgnore={onIgnore}
        />
      </CardContent>
    </Card>
  );
}
