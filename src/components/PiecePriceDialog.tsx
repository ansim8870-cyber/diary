import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import type { AppSettings } from "@/types";
import { formatMeso } from "@/data/bossData";

interface PiecePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function PiecePriceDialog({
  open,
  onOpenChange,
  onSaved,
}: PiecePriceDialogProps) {
  const [price, setPrice] = useState<number>(6500000);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const settings = await invoke<AppSettings>("get_app_settings");
      setPrice(settings.sol_erda_piece_price);
    } catch (error) {
      console.error("Failed to load app settings:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await invoke("save_app_settings", { solErdaPiecePrice: price });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error("Failed to save app settings:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="/images/icons/솔에르다조각.png" alt="조각" className="w-6 h-6" />
            조각 가격 설정
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>솔 에르다 조각 1개 가격</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={Math.floor(price / 10000) || ""}
                  onChange={(e) => setPrice((parseInt(e.target.value) || 0) * 10000)}
                  placeholder="650"
                  className="w-24 text-right"
                />
                <span className="text-sm font-medium text-muted-foreground">만 메소</span>
              </div>
              <p className="text-sm text-muted-foreground">
                현재 설정: <span className="font-semibold text-primary">{formatMeso(price)}</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/50 space-y-1">
              <p className="text-xs text-muted-foreground">빠른 설정</p>
              <div className="flex flex-wrap gap-2">
                {[500, 550, 600, 650, 700, 750].map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setPrice(p * 10000)}
                  >
                    {p}만
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-xl border-2 border-green-800/50 bg-green-800 hover:bg-green-900 text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                저장
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-2 border-red-800/50 bg-red-800 hover:bg-red-900 text-white"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
