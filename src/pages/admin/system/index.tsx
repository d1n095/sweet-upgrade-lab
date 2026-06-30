// Stub placeholders — original advanced panels were archived during cleanup.
// SystemExplorer still references them; these render a discreet notice so the
// page keeps working without re-introducing the archived modules.
import { AlertTriangle } from "lucide-react";

const Stub = ({ name }: { name: string }) => (
  <div className="flex items-start gap-2 p-4 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
    <div>
      <p className="font-medium text-foreground">{name} är arkiverad</p>
      <p>Den här panelen togs bort under städningen (FAS 2). Inga åtgärder krävs.</p>
    </div>
  </div>
);

export const ScanControls = (_props: any) => <Stub name="ScanControls" />;
export const IssueAnalysisPanel = (_props: any) => <Stub name="IssueAnalysisPanel" />;
export const SystemCommandCenter = (_props: any) => <Stub name="SystemCommandCenter" />;
