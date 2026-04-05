import { AlertTriangle, ArrowRight, FileText, GitBranch, Link2Off, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Static audit data — sourced from App.tsx route map + src/pages file listing ──

interface DeadRoute {
  path: string;
  redirectsTo: string;
  note?: string;
}

interface OrphanedPage {
  file: string;
  reason: string;
}

interface DuplicateRoute {
  paths: string[];
  component: string;
}

interface UnusedImport {
  symbol: string;
  importedIn: string;
  note: string;
}

const DEAD_ROUTES: DeadRoute[] = [
  { path: "/shop", redirectsTo: "/produkter", note: "Legacy alias" },
  { path: "/products", redirectsTo: "/produkter", note: "Legacy alias" },
  { path: "/donations", redirectsTo: "/", note: "Feature disabled" },
  { path: "/donations-panel", redirectsTo: "/", note: "Feature disabled" },
  { path: "/admin/communication", redirectsTo: "/admin/content", note: "Renamed" },
  { path: "/admin/updates", redirectsTo: "/admin/content", note: "Renamed" },
  { path: "/admin/visibility", redirectsTo: "/admin/settings", note: "Merged into settings" },
  { path: "/admin/ai", redirectsTo: "/admin/system-explorer", note: "Renamed" },
];

const DUPLICATE_ROUTES: DuplicateRoute[] = [
  { paths: ["/admin/finance", "/admin/payments"], component: "AdminPayments" },
];

const ORPHANED_PAGES: OrphanedPage[] = [
  { file: "src/pages/admin/AdminAI.tsx", reason: "Route /admin/ai redirects to system-explorer; file never rendered" },
  { file: "src/pages/admin/AdminCommunication.tsx", reason: "Route /admin/communication redirects to /admin/content" },
  { file: "src/pages/admin/AdminUpdates.tsx", reason: "Route /admin/updates redirects to /admin/content" },
  { file: "src/pages/admin/AdminFinance.tsx", reason: "Route /admin/finance uses AdminPayments instead; AdminFinance is imported in App.tsx but never mounted" },
  { file: "src/pages/admin/AdminVisibility.tsx", reason: "Route /admin/visibility redirects to /admin/settings; imported in App.tsx but never mounted" },
  { file: "src/pages/Donations.tsx", reason: "Route /donations redirects to /; file never rendered" },
  { file: "src/pages/DonationsPanel.tsx", reason: "Route /donations-panel redirects to /; file never rendered" },
  { file: "src/pages/Shop.tsx", reason: "Route /shop redirects to /produkter; file never rendered" },
];

const UNUSED_IMPORTS: UnusedImport[] = [
  { symbol: "AdminFinance", importedIn: "src/App.tsx", note: "Imported but replaced by AdminPayments on /admin/finance route" },
  { symbol: "AdminVisibility", importedIn: "src/App.tsx", note: "Imported but route redirects to /admin/settings" },
];

export default function AdminAudit() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-yellow-500" />
        <div>
          <h1 className="text-xl font-bold">Route & Code Audit</h1>
          <p className="text-sm text-muted-foreground">
            Dead routes · orphaned pages · unused imports · duplicate routes
          </p>
        </div>
      </div>

      {/* Dead routes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2Off className="h-4 w-4 text-red-500" />
            Dead Routes ({DEAD_ROUTES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-4 font-medium">Path</th>
                <th className="text-left py-1 pr-4 font-medium">Redirects to</th>
                <th className="text-left py-1 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {DEAD_ROUTES.map((r) => (
                <tr key={r.path} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 pr-4 font-mono text-red-500">{r.path}</td>
                  <td className="py-1.5 pr-4 flex items-center gap-1 font-mono text-muted-foreground">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {r.redirectsTo}
                  </td>
                  <td className="py-1.5 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Duplicate routes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-500" />
            Duplicate Routes ({DUPLICATE_ROUTES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-4 font-medium">Paths</th>
                <th className="text-left py-1 font-medium">Component</th>
              </tr>
            </thead>
            <tbody>
              {DUPLICATE_ROUTES.map((d) => (
                <tr key={d.paths.join()} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 pr-4 font-mono text-orange-500">{d.paths.join(" · ")}</td>
                  <td className="py-1.5 font-mono text-muted-foreground">{d.component}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Orphaned pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-yellow-500" />
            Orphaned Page Files ({ORPHANED_PAGES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-4 font-medium">File</th>
                <th className="text-left py-1 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {ORPHANED_PAGES.map((p) => (
                <tr key={p.file} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 pr-4 font-mono text-yellow-600 dark:text-yellow-400 whitespace-nowrap">{p.file}</td>
                  <td className="py-1.5 text-muted-foreground">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Unused imports */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-blue-500" />
            Imported but Never Mounted ({UNUSED_IMPORTS.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-1 pr-4 font-medium">Symbol</th>
                <th className="text-left py-1 pr-4 font-medium">File</th>
                <th className="text-left py-1 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {UNUSED_IMPORTS.map((u) => (
                <tr key={u.symbol} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 pr-4 font-mono text-blue-500">{u.symbol}</td>
                  <td className="py-1.5 pr-4 font-mono text-muted-foreground">{u.importedIn}</td>
                  <td className="py-1.5 text-muted-foreground">{u.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
        <Badge variant="outline">{DEAD_ROUTES.length} dead routes</Badge>
        <Badge variant="outline">{DUPLICATE_ROUTES.length} duplicate routes</Badge>
        <Badge variant="outline">{ORPHANED_PAGES.length} orphaned files</Badge>
        <Badge variant="outline">{UNUSED_IMPORTS.length} unused imports</Badge>
      </div>
    </div>
  );
}
