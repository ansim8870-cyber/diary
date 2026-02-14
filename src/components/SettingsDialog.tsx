import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
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
import {
  Loader2,
  UserCog,
  Download,
  Upload,
  Trash2,
  Search,
  FolderOpen,
  X,
  ArrowLeft,
  Maximize2,
} from "lucide-react";
import type { Character, CharacterListItem, AppSettings } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharacterChange: (character: Character) => void;
}

type SettingsView = "main" | "select-server" | "select-character";

export function SettingsDialog({
  open,
  onOpenChange,
  onCharacterChange,
}: SettingsDialogProps) {
  const [view, setView] = useState<SettingsView>("main");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [screenshotFolder, setScreenshotFolder] = useState<string | null>(null);

  // 캐릭터 목록 관련 상태
  const [allCharacters, setAllCharacters] = useState<CharacterListItem[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 캐릭터가 있는 서버 목록
  const servers = useMemo(() => {
    const serverMap = new Map<string, number>();
    for (const char of allCharacters) {
      serverMap.set(char.world_name, (serverMap.get(char.world_name) || 0) + 1);
    }
    return Array.from(serverMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allCharacters]);

  // 선택된 서버의 캐릭터 목록 (레벨 내림차순, 검색 필터링)
  const filteredCharacters = useMemo(() => {
    if (!selectedServer) return [];
    return allCharacters
      .filter(
        (c) =>
          c.world_name === selectedServer &&
          (searchQuery === "" ||
            c.character_name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.character_level - a.character_level);
  }, [allCharacters, selectedServer, searchQuery]);

  // 설정 로드
  useEffect(() => {
    if (open) {
      loadAppSettings();
    }
  }, [open]);

  async function loadAppSettings() {
    try {
      const settings = await invoke<AppSettings>("get_app_settings");
      setScreenshotFolder(settings.screenshot_folder_path || null);
    } catch (error) {
      console.error("Failed to load app settings:", error);
    }
  }

  async function handleSelectScreenshotFolder() {
    try {
      const folderPath = await openDialog({
        title: "스크린샷 폴더 선택",
        directory: true,
      });

      if (folderPath) {
        await invoke("save_screenshot_folder_path", { path: folderPath });
        setScreenshotFolder(folderPath as string);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  }

  async function handleClearScreenshotFolder() {
    try {
      await invoke("save_screenshot_folder_path", { path: null });
      setScreenshotFolder(null);
    } catch (error) {
      console.error("Failed to clear folder:", error);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setView("main");
      setAllCharacters([]);
      setSelectedServer(null);
      setSearchQuery("");
      setError("");
    }
    onOpenChange(isOpen);
  }

  async function handleStartCharacterChange() {
    setIsLoading(true);
    setError("");
    try {
      const characters = await invoke<CharacterListItem[]>("get_character_list");
      setAllCharacters(characters);
      setView("select-server");
    } catch (err) {
      setError(`캐릭터 목록 조회 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleServerSelect(serverName: string) {
    setSelectedServer(serverName);
    setSearchQuery("");
    setView("select-character");
  }

  async function handleCharacterSelect(char: CharacterListItem) {
    setIsRegistering(true);
    setError("");
    try {
      const fullInfo = await invoke<{
        ocid: string;
        character_name: string;
        character_image: string;
        world_name: string;
        character_class: string;
        character_level: number;
        character_exp_rate: string;
      }>("search_character", {
        characterName: char.character_name,
      });

      const character = await invoke<Character>("register_character", {
        input: {
          character_name: fullInfo.character_name,
          character_image: fullInfo.character_image,
          ocid: fullInfo.ocid,
          world_name: fullInfo.world_name,
          character_class: fullInfo.character_class,
          character_level: fullInfo.character_level,
          character_exp_rate: fullInfo.character_exp_rate,
        },
      });
      onCharacterChange(character);
      handleClose(false);
    } catch (err) {
      setError(`캐릭터 변경 실패: ${err}`);
    } finally {
      setIsRegistering(false);
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

  const dialogTitle =
    view === "main"
      ? "설정"
      : view === "select-server"
        ? "서버 선택"
        : "캐릭터 선택";

  const dialogDesc =
    view === "main"
      ? "캐릭터 및 데이터 관리"
      : view === "select-server"
        ? "캐릭터가 있는 서버를 선택해주세요"
        : `${selectedServer} 서버의 캐릭터를 선택해주세요`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <Button
          variant="outline"
          size="sm"
          className="absolute right-14 top-4 h-7 px-2 text-[10px] gap-1 rounded-md hover:bg-transparent hover:text-current z-50"
          onClick={async () => {
            try {
              const win = getCurrentWindow();
              await win.setSize(new LogicalSize(1024, 860));
              await win.center();
            } catch (err) {
              console.error("Failed to restore window size:", err);
            }
          }}
        >
          <Maximize2 className="h-3 w-3" />
          창 크기 초기화
        </Button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">
              {view === "main" ? "⚙️" : "👤"}
            </span>
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive font-medium p-3 rounded-lg bg-destructive/10">
            {error}
          </p>
        )}

        {view === "main" && (
          <div className="space-y-3">
            <button
              className="w-full flex items-center gap-4 h-auto py-4 px-4 rounded-xl border-2 border-border bg-background hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleStartCharacterChange}
              disabled={isLoading}
            >
              <div className="p-2 rounded-lg bg-primary/10">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <UserCog className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">캐릭터 변경</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading
                    ? "캐릭터 목록을 불러오는 중..."
                    : "다른 캐릭터로 전환합니다"}
                </p>
              </div>
            </button>

            <div className="relative">
              <Button
                variant="ghost"
                className="w-full justify-start gap-4 h-auto py-4 rounded-xl border-2 border-border hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                onClick={handleSelectScreenshotFolder}
              >
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <FolderOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold">스크린샷 폴더</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {screenshotFolder || "폴더를 선택해주세요"}
                  </p>
                </div>
              </Button>
              {screenshotFolder && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearScreenshotFolder();
                  }}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start gap-4 h-auto py-4 rounded-xl border-2 border-border hover:border-green-500/30 hover:bg-green-500/5 transition-all"
              onClick={handleBackup}
              disabled={isLoading}
            >
              <div className="p-2 rounded-lg bg-green-500/10">
                <Download className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold">데이터 백업</p>
                <p className="text-xs text-muted-foreground">
                  저장했던 모든 기록을 파일로 저장합니다
                </p>
              </div>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-4 h-auto py-4 rounded-xl border-2 border-border hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
              onClick={handleRestore}
              disabled={isLoading}
            >
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold">데이터 불러오기</p>
                <p className="text-xs text-muted-foreground">
                  백업 파일에서 데이터를 복원합니다
                </p>
              </div>
            </Button>

            <button
              className="w-full flex items-center gap-4 h-auto py-4 px-4 rounded-xl border-2 border-border bg-background hover:border-destructive/30 hover:bg-destructive/5 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleReset}
              disabled={isLoading}
            >
              <div className="p-2 rounded-lg bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-destructive">데이터 초기화</p>
                <p className="text-xs text-muted-foreground">
                  모든 데이터를 삭제하고 첫 설치 상태로 되돌립니다
                </p>
              </div>
            </button>
          </div>
        )}

        {view === "select-server" && (
          <div className="space-y-4">
            {servers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  캐릭터를 찾을 수 없습니다
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {servers.map((server) => (
                  <Button
                    key={server.name}
                    variant="outline"
                    className="h-auto py-3 px-2 flex flex-col gap-1 rounded-xl border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => handleServerSelect(server.name)}
                  >
                    <span className="font-semibold text-sm">
                      {server.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {server.count}캐릭터
                    </span>
                  </Button>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full rounded-xl"
              onClick={() => {
                setView("main");
                setAllCharacters([]);
                setError("");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로
            </Button>
          </div>
        )}

        {view === "select-character" && (
          <div className="space-y-4">
            {/* 검색바 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="캐릭터 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>

            {/* 캐릭터 목록 */}
            <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
              {filteredCharacters.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {searchQuery
                    ? "검색 결과가 없습니다"
                    : "캐릭터가 없습니다"}
                </p>
              ) : (
                filteredCharacters.map((char) => (
                  <button
                    key={char.ocid}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                    onClick={() => handleCharacterSelect(char)}
                    disabled={isRegistering}
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {char.character_level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {char.character_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Lv.{char.character_level} · {char.character_class}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {isRegistering && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  캐릭터 정보를 가져오는 중...
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full rounded-xl"
              onClick={() => {
                setView("select-server");
                setSelectedServer(null);
                setSearchQuery("");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              서버 선택으로 돌아가기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
