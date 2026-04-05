import { Eye, Shield, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fileSystemMap, getFileContent } from "@/lib/fileSystemMap";

interface ValidationViewProps {
  patchInput: string;
  setPatchInput: (v: string) => void;
  patchStatus: "idle" | "valid" | "invalid";
  setPatchStatus: (v: "idle" | "valid" | "invalid") => void;
  safeModeEnabled: boolean;
  setSafeModeEnabled: (v: boolean) => void;
  patchSubmitted: boolean;
  setPatchSubmitted: (v: boolean) => void;
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
}

export const ValidationView = ({
  patchInput,
  setPatchInput,
  patchStatus,
  setPatchStatus,
  safeModeEnabled,
  setSafeModeEnabled,
  patchSubmitted,
  setPatchSubmitted,
  confirmOpen,
  setConfirmOpen,
}: ValidationViewProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          Patch Controller
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Validate patch prompts before sending. Must contain FILE:, ADD:, and DO NOT.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Safe Mode Toggle */}
        <div className="flex items-center justify-between border border-border rounded-md p-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <div>
              <span className="text-xs font-medium text-foreground">Safe Mode</span>
              <p className="text-[9px] text-muted-foreground">Max 1 patch in queue, block multiple submissions, require confirmation</p>
            </div>
          </div>
          <button
            onClick={() => setSafeModeEnabled(!safeModeEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${safeModeEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${safeModeEnabled ? "translate-x-4" : ""}`} />
          </button>
        </div>
        {safeModeEnabled && patchSubmitted && (
          <div className="border border-orange-500/30 rounded-md p-2 bg-orange-500/10">
            <p className="text-[10px] text-orange-500 font-medium">⚠️ Safe Mode: A patch is already in queue. Wait for it to complete before submitting another.</p>
          </div>
        )}

        <textarea
          className="w-full h-48 text-xs font-mono bg-muted/30 border border-border rounded-md p-3 text-foreground resize-y"
          placeholder={"DO EXACT PATCH ONLY\nDO NOT REFACTOR\n\nFILE: ...\n\nADD:\n..."}
          value={patchInput}
          onChange={(e) => { setPatchInput(e.target.value); setPatchStatus("idle"); }}
          disabled={safeModeEnabled && patchSubmitted}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={safeModeEnabled && patchSubmitted}
            onClick={() => {
              const text = patchInput.trim();
              const hasFile = /FILE:/i.test(text);
              const hasAdd = /ADD:/i.test(text);
              const hasDoNot = /DO NOT/i.test(text);
              if (hasFile && hasAdd && hasDoNot) {
                setPatchStatus("valid");
              } else {
                setPatchStatus("invalid");
              }
            }}
          >
            Validate Patch
          </Button>
          {patchStatus === "valid" && !confirmOpen && (
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">✅ Ready to send</Badge>
          )}
          {patchStatus === "valid" && safeModeEnabled && !confirmOpen && (
            <Button
              variant="default"
              size="sm"
              disabled={patchSubmitted}
              onClick={() => setConfirmOpen(true)}
            >
              Submit Patch
            </Button>
          )}
          {patchStatus === "invalid" && (
            <div className="space-y-0.5">
              <Badge variant="destructive" className="text-[10px]">❌ Invalid patch format</Badge>
              <div className="flex gap-1 flex-wrap">
                {!/FILE:/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing FILE:</span>}
                {!/ADD:/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing ADD:</span>}
                {!/DO NOT/i.test(patchInput) && <span className="text-[9px] text-destructive">Missing DO NOT</span>}
              </div>
            </div>
          )}
        </div>

        {/* Patch Preview */}
        {patchStatus === "valid" && (() => {
          const fileMatch = patchInput.match(/FILE:\s*(.+)/i);
          const targetFile = fileMatch ? fileMatch[1].trim() : null;
          const addMatch = patchInput.match(/ADD:\s*([\s\S]*?)(?=\n(?:GOAL|DISPLAY|RULES|SHOW|IF|WHEN|LIMIT|DO NOT|$))/i);
          const addContent = addMatch ? addMatch[1].trim() : null;
          const matchedFile = targetFile ? fileSystemMap.find(f => {
            const name = f.path.split("/").pop()?.replace(/\.tsx?$/, "").toLowerCase() || "";
            const target = targetFile.toLowerCase().replace(/\.tsx?$/, "");
            return f.path.toLowerCase().includes(target) || name === target || f.path.toLowerCase().endsWith(target.toLowerCase());
          }) : null;
          const currentContent = matchedFile ? getFileContent(matchedFile.path) : null;
          return (
            <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-2">
                <Eye className="h-3 w-3" />
                Patch Preview
              </p>
              <div>
                <span className="text-[10px] text-muted-foreground">Target File</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[10px] text-foreground">{targetFile || "Unknown"}</span>
                  {matchedFile ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[8px]">found: {matchedFile.path}</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[8px]">not found in file map</Badge>
                  )}
                </div>
              </div>
              {addContent && (
                <div>
                  <span className="text-[10px] text-muted-foreground">Code Diff (what will be added)</span>
                  <pre className="mt-0.5 bg-green-500/5 border border-green-500/20 rounded-md p-2 text-[9px] font-mono max-h-[150px] overflow-auto whitespace-pre-wrap">
                    {addContent.split("\n").map((line, i) => (
                      <div key={i} className="text-green-500">+ {line}</div>
                    ))}
                  </pre>
                </div>
              )}
              {currentContent && (
                <details className="text-[10px]">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Current file content ({currentContent.split("\n").length} lines)</summary>
                  <pre className="mt-1 bg-muted/30 border border-border rounded-md p-2 text-[9px] font-mono max-h-[200px] overflow-auto whitespace-pre text-foreground">{currentContent}</pre>
                </details>
              )}
            </div>
          );
        })()}

        {/* Confirmation Dialog */}
        {confirmOpen && (
          <div className="border border-primary/30 rounded-md p-3 bg-primary/5 space-y-2">
            <p className="text-xs font-medium text-foreground">⚠️ Confirm submission</p>
            <p className="text-[10px] text-muted-foreground">Are you sure you want to submit this patch? Safe Mode will block further submissions until this one completes.</p>
            <pre className="bg-muted/30 border border-border rounded-md p-2 text-[9px] font-mono max-h-[100px] overflow-auto whitespace-pre-wrap text-foreground">{patchInput.slice(0, 500)}</pre>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setPatchSubmitted(true);
                  setConfirmOpen(false);
                  setPatchStatus("idle");
                }}
              >
                ✅ Confirm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reset button when submitted */}
        {patchSubmitted && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">📦 Patch in queue</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPatchSubmitted(false);
                setPatchInput("");
                setPatchStatus("idle");
              }}
            >
              Clear Queue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationView;
