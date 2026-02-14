import { useState, useEffect } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

export function UpdateDialog() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setOpen(true);
      }
    } catch (e) {
      console.error("Update check failed:", e);
    }
  }

  async function handleInstall() {
    if (!update) return;

    setDownloading(true);
    try {
      let totalLength = 0;
      let downloadedLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedLength += event.data.chunkLength;
            if (totalLength > 0) {
              setProgress(Math.round((downloadedLength / totalLength) * 100));
            }
            break;
          case "Finished":
            break;
        }
      });

      await relaunch();
    } catch (e) {
      console.error("Update install failed:", e);
      setDownloading(false);
    }
  }

  if (!update) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!downloading) setOpen(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            업데이트 알림
          </DialogTitle>
          <DialogDescription className="font-medium">
            새 버전 v{update.version}이(가) 있습니다
          </DialogDescription>
        </DialogHeader>

        {update.body && (
          <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
            {update.body}
          </div>
        )}

        {downloading ? (
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              다운로드 중... {progress}%
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-1.5 border-2 border-blue-800/50 bg-blue-800 hover:bg-blue-900 text-white"
              onClick={handleInstall}
            >
              <Download className="h-4 w-4" />
              업데이트
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              나중에
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
