import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile, copyFile } from "@tauri-apps/plugin-fs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Trash2, ImageIcon, X, Download, ZoomIn, Pencil, Check, Save } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { ItemDrop } from "@/types";
import { formatMeso, formatMesoDetailed } from "@/data/bossData";
import { formatDate } from "@/lib/utils";

// 로컬 파일 경로를 표시 가능한 URL로 변환
async function filePathToUrl(path: string): Promise<string> {
  const data = await readFile(path);
  const ext = path.split(".").pop()?.toLowerCase() || "png";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    bmp: "image/bmp",
    webp: "image/webp",
  };
  const mime = mimeMap[ext] || "image/png";
  const blob = new Blob([data], { type: mime });
  return URL.createObjectURL(blob);
}

// 파일명 추출
function getFileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "image.png";
}

// 이미지를 비동기 로드하여 표시하는 컴포넌트
function LocalImage({
  path,
  alt,
  className,
  onClick,
}: {
  path: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    filePathToUrl(path)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => setSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) return null;
  return (
    <div className={onClick ? "relative group cursor-pointer" : "relative"} onClick={onClick}>
      <img src={src} alt={alt} className={className} />
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-md flex items-center justify-center">
          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
      )}
    </div>
  );
}

// ── 이미지 확대 프리뷰 (Radix Dialog 기반) ──
function ImagePreviewOverlay({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    filePathToUrl(path)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => setSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  async function handleDownload() {
    const fileName = getFileName(path);
    const ext = fileName.split(".").pop()?.toLowerCase() || "png";

    setIsSaving(true);
    try {
      const savePath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: "Images",
            extensions: [ext],
          },
        ],
      });

      if (savePath) {
        await copyFile(path, savePath);
      }
    } catch (error) {
      console.error("Failed to save image:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-150" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* 배경 클릭 시 닫기 */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* 상단 버튼 바 */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm"
              onClick={handleDownload}
              disabled={isSaving}
            >
              <Download className="h-4 w-4" />
              {isSaving ? "저장 중..." : "다운로드"}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 이미지 */}
          {src && (
            <img
              src={src}
              alt="확대 이미지"
              className="relative z-10 max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          )}

          {/* Radix 접근성 - 숨겨진 타이틀 */}
          <DialogPrimitive.Title className="sr-only">이미지 프리뷰</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">이미지 확대 보기</DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── 득템 추가 다이얼로그 ──
interface ItemDropAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  characterId: number;
  onSaved: () => void;
}

export function ItemDropAddDialog({
  open: isOpen,
  onOpenChange,
  date,
  characterId,
  onSaved,
}: ItemDropAddDialogProps) {
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItemName("");
      setPrice("");
      setScreenshot(null);
    }
  }, [isOpen]);

  async function handleAdd() {
    if (!itemName.trim() || !price.trim()) return;

    const priceNum = parseInt(price.replace(/,/g, ""), 10);
    if (isNaN(priceNum) || priceNum < 0) return;

    setIsLoading(true);
    try {
      await invoke("save_item_drop", {
        characterId,
        date,
        itemName: itemName.trim(),
        price: priceNum,
        screenshot,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save item drop:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectScreenshot() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "bmp", "webp"],
          },
        ],
      });
      if (selected) {
        setScreenshot(selected as string);
      }
    } catch (error) {
      console.error("Failed to select screenshot:", error);
    }
  }

  function handlePriceChange(value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    if (cleaned === "") {
      setPrice("");
      return;
    }
    const num = parseInt(cleaned, 10);
    setPrice(num.toLocaleString());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              득템 추가
            </DialogTitle>
            <DialogDescription className="font-medium">{formatDate(date)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Input
                placeholder="아이템명"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <div>
              <Input
                placeholder="가격 (메소)"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-right"
              />
            </div>

            {/* Screenshot */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleSelectScreenshot}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {screenshot ? "스크린샷 변경" : "스크린샷 첨부"}
                </Button>
                {screenshot && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-muted-foreground"
                    onClick={() => setScreenshot(null)}
                  >
                    <X className="h-3 w-3" />
                    제거
                  </Button>
                )}
              </div>
              {screenshot && (
                <LocalImage
                  path={screenshot}
                  alt="첨부 스크린샷"
                  className="w-full rounded-lg border border-border/60"
                  onClick={() => setPreviewPath(screenshot)}
                />
              )}
            </div>

            <Button
              className="w-full gap-1.5 border-2 border-green-800/50 bg-green-800 hover:bg-green-900 text-white"
              onClick={handleAdd}
              disabled={!itemName.trim() || !price.trim() || isLoading}
            >
              <Save className="h-4 w-4" />
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewPath && (
        <ImagePreviewOverlay
          path={previewPath}
          onClose={() => setPreviewPath(null)}
        />
      )}
    </>
  );
}

// ── 득템 목록 다이얼로그 ──
interface ItemDropListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  characterId: number;
  onDataChanged: () => void;
}

export function ItemDropListDialog({
  open: isOpen,
  onOpenChange,
  date,
  characterId,
  onDataChanged,
}: ItemDropListDialogProps) {
  const [itemDrops, setItemDrops] = useState<ItemDrop[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editScreenshot, setEditScreenshot] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadItemDrops();
      setEditingId(null);
    }
  }, [isOpen, date]);

  async function loadItemDrops() {
    try {
      const drops = await invoke<ItemDrop[]>("get_item_drops", {
        characterId,
        date,
      });
      setItemDrops(drops);
    } catch (error) {
      console.error("Failed to load item drops:", error);
    }
  }

  function startEdit(drop: ItemDrop) {
    setEditingId(drop.id);
    setEditName(drop.item_name);
    setEditPrice(drop.price.toLocaleString());
    setEditScreenshot(drop.screenshot ?? null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleEditPriceChange(value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    if (cleaned === "") {
      setEditPrice("");
      return;
    }
    const num = parseInt(cleaned, 10);
    setEditPrice(num.toLocaleString());
  }

  async function handleUpdate() {
    if (editingId === null || !editName.trim() || !editPrice.trim()) return;

    const priceNum = parseInt(editPrice.replace(/,/g, ""), 10);
    if (isNaN(priceNum) || priceNum < 0) return;

    setIsUpdating(true);
    try {
      await invoke("update_item_drop", {
        id: editingId,
        itemName: editName.trim(),
        price: priceNum,
        screenshot: editScreenshot,
      });
      setEditingId(null);
      await loadItemDrops();
      onDataChanged();
    } catch (error) {
      console.error("Failed to update item drop:", error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleEditScreenshot() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "bmp", "webp"],
          },
        ],
      });
      if (selected) {
        setEditScreenshot(selected as string);
      }
    } catch (error) {
      console.error("Failed to select screenshot:", error);
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpdate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  async function handleDelete(id: number) {
    try {
      await invoke("delete_item_drop", { id });
      await loadItemDrops();
      onDataChanged();
    } catch (error) {
      console.error("Failed to delete item drop:", error);
    }
  }

  const totalPrice = itemDrops.reduce((sum, drop) => sum + drop.price, 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              득템 목록
            </DialogTitle>
            <DialogDescription className="font-medium">{formatDate(date)}</DialogDescription>
          </DialogHeader>

          {itemDrops.length > 0 ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {itemDrops.map((drop) => (
                <div
                  key={drop.id}
                  className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden"
                >
                  {editingId === drop.id ? (
                    /* ── 수정 모드 ── */
                    <div className="p-2.5 space-y-2">
                      <Input
                        placeholder="아이템명"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                      <Input
                        placeholder="가격 (메소)"
                        value={editPrice}
                        onChange={(e) => handleEditPriceChange(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="text-right"
                      />
                      {/* 스크린샷 수정 */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={handleEditScreenshot}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            {editScreenshot ? "스크린샷 변경" : "스크린샷 첨부"}
                          </Button>
                          {editScreenshot && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-muted-foreground"
                              onClick={() => setEditScreenshot(null)}
                            >
                              <X className="h-3 w-3" />
                              제거
                            </Button>
                          )}
                        </div>
                        {editScreenshot && (
                          <LocalImage
                            path={editScreenshot}
                            alt="수정 스크린샷"
                            className="w-full rounded-md border border-border/40"
                            onClick={() => setPreviewPath(editScreenshot)}
                          />
                        )}
                      </div>
                      {/* 저장/취소 버튼 */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={handleUpdate}
                          disabled={!editName.trim() || !editPrice.trim() || isUpdating}
                        >
                          <Check className="h-3.5 w-3.5" />
                          저장
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={cancelEdit}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── 보기 모드 ── */
                    <>
                      <div className="flex items-center gap-2 p-2.5">
                        <span className="flex-1 text-sm font-medium truncate">
                          {drop.item_name}
                        </span>
                        <span className="text-sm font-bold text-pink-600 dark:text-pink-400 whitespace-nowrap">
                          {formatMeso(drop.price)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-blue-500"
                          onClick={() => startEdit(drop)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDelete(drop.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {drop.screenshot && (
                        <div className="px-2.5 pb-2.5">
                          <LocalImage
                            path={drop.screenshot}
                            alt={`${drop.item_name} 스크린샷`}
                            className="w-full rounded-md border border-border/40"
                            onClick={() => setPreviewPath(drop.screenshot!)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                등록된 아이템이 없습니다
              </p>
            </div>
          )}

          {/* Total */}
          {itemDrops.length > 0 && (
            <div className="rounded-xl border-2 border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-pink-500/10 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                  <Gift className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">
                    총 득템 ({itemDrops.length}건)
                  </span>
                </div>
                <p className="text-sm font-bold text-pink-600 dark:text-pink-400">
                  +{formatMesoDetailed(totalPrice)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {previewPath && (
        <ImagePreviewOverlay
          path={previewPath}
          onClose={() => setPreviewPath(null)}
        />
      )}
    </>
  );
}
