import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  UserCog,
  Download,
  Upload,
  Trash2,
  Search,
  Check,
} from "lucide-react";
import type { Character, SearchCharacterResult } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharacterChange: (character: Character) => void;
}

type SettingsView = "main" | "change-character";

export function SettingsDialog({
  open,
  onOpenChange,
  onCharacterChange,
}: SettingsDialogProps) {
  const [view, setView] = useState<SettingsView>("main");
  const [isLoading, setIsLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState<SearchCharacterResult | null>(null);
  const [searchError, setSearchError] = useState("");

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setView("main");
      setSearchName("");
      setSearchResult(null);
      setSearchError("");
    }
    onOpenChange(isOpen);
  }

  async function handleSearchCharacter() {
    if (!searchName.trim()) return;

    setIsLoading(true);
    setSearchError("");
    setSearchResult(null);

    try {
      const result = await invoke<SearchCharacterResult>("search_character", {
        characterName: searchName.trim(),
      });
      setSearchResult(result);
    } catch (error) {
      setSearchError(
        typeof error === "string" ? error : "캐릭터를 찾을 수 없습니다"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChangeCharacter() {
    if (!searchResult) return;

    setIsLoading(true);
    try {
      const character = await invoke<Character>("register_character", {
        input: {
          character_name: searchResult.character_name,
          character_image: searchResult.character_image,
          ocid: searchResult.ocid,
          world_name: searchResult.world_name,
          character_class: searchResult.character_class,
          character_level: searchResult.character_level,
          character_exp_rate: searchResult.character_exp_rate,
        },
      });
      onCharacterChange(character);
      handleClose(false);
    } catch (error) {
      console.error("Failed to change character:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBackup() {
    try {
      const filePath = await save({
        title: "데이터 백업",
        defaultPath: `maple_diary_backup_${new Date().toISOString().split("T")[0]}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!filePath) return;

      setIsLoading(true);
      const data = await invoke<string>("export_data");
      await writeTextFile(filePath, data);
      alert("백업이 완료되었습니다.");
    } catch (error) {
      console.error("Backup failed:", error);
      alert("백업에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRestore() {
    try {
      const filePath = await openDialog({
        title: "데이터 불러오기",
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });

      if (!filePath) return;

      const confirmRestore = confirm(
        "현재 데이터가 백업 데이터로 교체됩니다. 계속하시겠습니까?"
      );
      if (!confirmRestore) return;

      setIsLoading(true);
      const data = await readTextFile(filePath as string);
      await invoke("import_data", { data });
      alert("데이터 복원이 완료되었습니다. 앱을 다시 시작해주세요.");
      handleClose(false);
    } catch (error) {
      console.error("Restore failed:", error);
      alert("데이터 복원에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset() {
    const confirmReset = confirm(
      "모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.\n\n정말 초기화하시겠습니까?"
    );
    if (!confirmReset) return;

    const doubleConfirm = confirm(
      "마지막 확인: 정말로 모든 데이터를 삭제하시겠습니까?"
    );
    if (!doubleConfirm) return;

    try {
      setIsLoading(true);
      await invoke("reset_data");
      alert("데이터가 초기화되었습니다. 앱을 다시 시작해주세요.");
      window.location.reload();
    } catch (error) {
      console.error("Reset failed:", error);
      alert("초기화에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === "main" ? "설정" : "캐릭터 변경"}
          </DialogTitle>
          <DialogDescription>
            {view === "main"
              ? "캐릭터 및 데이터 관리"
              : "다른 캐릭터로 변경합니다"}
          </DialogDescription>
        </DialogHeader>

        {view === "main" ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => setView("change-character")}
            >
              <UserCog className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">캐릭터 변경</p>
                <p className="text-xs text-muted-foreground">
                  다른 캐릭터로 전환합니다
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleBackup}
              disabled={isLoading}
            >
              <Download className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">데이터 백업</p>
                <p className="text-xs text-muted-foreground">
                  모든 기록을 파일로 저장합니다
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleRestore}
              disabled={isLoading}
            >
              <Upload className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">데이터 불러오기</p>
                <p className="text-xs text-muted-foreground">
                  백업 파일에서 데이터를 복원합니다
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 text-destructive hover:text-destructive"
              onClick={handleReset}
              disabled={isLoading}
            >
              <Trash2 className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">데이터 초기화</p>
                <p className="text-xs text-muted-foreground">
                  모든 데이터를 삭제합니다
                </p>
              </div>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>캐릭터 닉네임</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="닉네임 입력"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchCharacter()}
                />
                <Button onClick={handleSearchCharacter} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}

            {searchResult && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={searchResult.character_image}
                    alt={searchResult.character_name}
                    className="h-16 w-16 rounded-lg bg-muted object-contain"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {searchResult.character_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchResult.world_name} · {searchResult.character_class}
                    </p>
                    <p className="text-sm">
                      Lv.{searchResult.character_level}
                      <span className="text-primary ml-1">
                        ({searchResult.character_exp_rate})
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full mt-3"
                  onClick={handleChangeCharacter}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  이 캐릭터로 변경
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setView("main");
                setSearchName("");
                setSearchResult(null);
                setSearchError("");
              }}
            >
              뒤로
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
