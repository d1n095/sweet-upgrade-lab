import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  /** Panel label shown in the empty state */
  label?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * PanelErrorBoundary — SYSTEM RECOVERY MODE guarantee:
 *   Any panel that throws is replaced by an empty-state card.
 *   The surrounding Command Center / page MUST continue to render.
 */
export class PanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.warn(`[PanelErrorBoundary] ${this.props.label ?? "panel"} failed:`, error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-6 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{this.props.label ?? "Panel"} kunde inte läsas in</p>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                {this.state.error?.message || "Okänt fel — visar tom vy istället för att blockera UI."}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default PanelErrorBoundary;
