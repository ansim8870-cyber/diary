import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readDir, DirEntry } from "@tauri-apps/plugin-fs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, FolderOpen, Loader2, Edit3, Search, FolderSearch, Scan, HelpCircle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { AppSettings, ScreenshotFile, HuntingOcrResult } from "@/types";

interface ScreenshotRecognitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  characterId: number;
  characterLevel: number;
  onManualInput: () => void;
  onOcrAnalyzed: (result: HuntingOcrResult, startPath: string, endPath: string) => void;
}

// 파일명 파싱: Maple_YYMMDD_HHMMSS.jpg
function parseScreenshotFilename(filename: string, folderPath: string): ScreenshotFile | null {
  const match = filename.match(/^Maple_(\d{6})_(\d{6})\.(jpg|png|jpeg)$/i);
  if (!match) return null;

  const [, dateStr, timeStr] = match;
  // dateStr: "260208" -> 2026-02-08
  // timeStr: "164926" -> 16:49:26

  const year = 2000 + parseInt(dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4));
  const day = parseInt(dateStr.substring(4, 6));
  const hour = parseInt(timeStr.substring(0, 2));
  const minute = parseInt(timeStr.substring(2, 4));
  const second = parseInt(timeStr.substring(4, 6));

  const timestamp = new Date(year, month - 1, day, hour, minute, second);

  // Windows 경로 구분자 처리
  const separator = folderPath.includes("\\") ? "\\" : "/";

  return {
    name: filename,
    path: `${folderPath}${separator}${filename}`,
    timestamp,
    displayTime: `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`,
  };
}

// 선택한 날짜 기준 필터링
function filterScreenshotsForDate(files: ScreenshotFile[], targetDate: string): ScreenshotFile[] {
  const [year, month, day] = targetDate.split("-").map(Number);

  return files
    .filter((f) => {
      return (
        f.timestamp.getFullYear() === year &&
        f.timestamp.getMonth() === month - 1 &&
        f.timestamp.getDate() === day
      );
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function ScreenshotRecognitionDialog({
  open,
  onOpenChange,
  date,
  onManualInput,
  onOcrAnalyzed,
}: ScreenshotRecognitionDialogProps) {
  const [screenshotFolder, setScreenshotFolder] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [selectedStart, setSelectedStart] = useState<ScreenshotFile | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<ScreenshotFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"start" | "end">("start");
  const [isScanning, setIsScanning] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 스캔 중지 함수
  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // 설정 로드
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  // 실시간 스캔 시작
  useEffect(() => {
    if (open && screenshotFolder && !autoDetected) {
      // 초기 로드
      loadScreenshots();

      // 실시간 스캔 시작 (3초마다)
      setIsScanning(true);
      scanIntervalRef.current = setInterval(() => {
        loadScreenshots();
      }, 3000);
    }

    return () => {
      stopScanning();
    };
  }, [open, screenshotFolder, date, autoDetected, stopScanning]);

  async function loadSettings() {
    try {
      const settings = await invoke<AppSettings>("get_app_settings");
      setScreenshotFolder(settings.screenshot_folder_path || null);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  async function loadScreenshots() {
    if (!screenshotFolder) return;

    // 초기 로드 시에만 로딩 표시
    if (screenshots.length === 0) {
      setIsLoading(true);
    }

    try {
      console.log("[DEBUG] 스크린샷 폴더:", screenshotFolder);
      console.log("[DEBUG] 선택된 날짜:", date);

      const entries: DirEntry[] = await readDir(screenshotFolder);
      console.log("[DEBUG] 폴더 내 파일 수:", entries.length);

      const parsed: ScreenshotFile[] = [];

      for (const entry of entries) {
        console.log("[DEBUG] 파일:", entry.name, "isFile:", entry.isFile);
        if (entry.name && entry.isFile) {
          const file = parseScreenshotFilename(entry.name, screenshotFolder);
          console.log("[DEBUG] 파싱 결과:", file);
          if (file) {
            parsed.push(file);
          }
        }
      }

      console.log("[DEBUG] 파싱된 스크린샷 수:", parsed.length);

      // 선택한 날짜 기준 필터링
      const filtered = filterScreenshotsForDate(parsed, date);
      console.log("[DEBUG] 필터링 후 스크린샷 수:", filtered.length);
      setScreenshots(filtered);

      // 2개 이상 감지 시 가장 나중 시간대 2개를 시작/종료로 자동 선택
      if (filtered.length >= 2 && !autoDetected) {
        setSelectedStart(filtered[filtered.length - 2]); // 뒤에서 두 번째 = 시작
        setSelectedEnd(filtered[filtered.length - 1]);   // 마지막 = 종료
        setAutoDetected(true);
        stopScanning();
      }
    } catch (error) {
      console.error("Failed to read screenshots:", error);
      setScreenshots([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectFolder() {
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

  function handleSelectScreenshot(file: ScreenshotFile) {
    if (selectionMode === "start") {
      setSelectedStart(file);
      setSelectionMode("end");
    } else {
      setSelectedEnd(file);
      setSelectionMode("start");
    }
  }

  async function handleConfirmSelection() {
    if (!selectedStart || !selectedEnd) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      console.log("[OCR] 분석 시작 - 시작:", selectedStart.path, "종료:", selectedEnd.path);

      // OCR 분석 실행
      const result = await invoke<HuntingOcrResult>("analyze_hunting_screenshots", {
        startImagePath: selectedStart.path,
        endImagePath: selectedEnd.path,
      });

      console.log("[OCR] 분석 결과:", result);

      // 결과 전달 및 다이얼로그 닫기
      onOcrAnalyzed(result, selectedStart.path, selectedEnd.path);
      handleOpenChange(false);
    } catch (error) {
      console.error("OCR analysis failed:", error);
      setAnalyzeError(typeof error === "string" ? error : "스크린샷 분석에 실패했습니다");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleManualInputClick() {
    onOpenChange(false);
    onManualInput();
  }

  // 다이얼로그 닫힐 때 상태 초기화
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelectedStart(null);
      setSelectedEnd(null);
      setSelectionMode("start");
      setScreenshots([]);
      setAutoDetected(false);
      setAnalyzeError(null);
      stopScanning();
    }
    onOpenChange(isOpen);
  }

  // 수동 선택 시 스캔 중지
  function handleManualSelect(file: ScreenshotFile) {
    stopScanning();
    handleSelectScreenshot(file);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            스크린샷 선택
          </DialogTitle>
          <DialogDescription>{formatDate(date)}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
          <p>
            메이플스토리에서 스크린샷을 찍으면
            <span className="font-medium text-foreground/70"> Maple_YYMMDD_HHMMSS.jpg</span> 형식으로 저장됩니다.
            이 파일명을 기반으로 해당 날짜의 스크린샷을 자동으로 찾으며, 여러 장이 있을 경우 가장 마지막 2장을 시작/종료로 선택합니다.
          </p>
        </div>

        {/* 폴더 미설정 시 */}
        {!screenshotFolder ? (
          <div className="py-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold mb-1">스크린샷 폴더가 설정되지 않았습니다</p>
              <p className="text-sm text-muted-foreground">
                메이플스토리 스크린샷 폴더를 선택해주세요
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleSelectFolder} className="rounded-xl">
                <FolderOpen className="h-4 w-4 mr-2" />
                폴더 설정하기
              </Button>
              <Button variant="outline" onClick={handleManualInputClick} className="rounded-xl">
                <Edit3 className="h-4 w-4 mr-2" />
                수동 입력
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* 선택 상태 표시 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "p-3 rounded-xl border-2 text-left transition-all",
                  selectionMode === "start"
                    ? "border-green-500 bg-green-500/10"
                    : "border-border hover:border-green-500/50"
                )}
                onClick={() => setSelectionMode("start")}
              >
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  시작
                </span>
                <p className="font-medium truncate">
                  {selectedStart?.displayTime || "선택해주세요"}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "p-3 rounded-xl border-2 text-left transition-all",
                  selectionMode === "end"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-blue-500/50"
                )}
                onClick={() => setSelectionMode("end")}
              >
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  종료
                </span>
                <p className="font-medium truncate">
                  {selectedEnd?.displayTime || "선택해주세요"}
                </p>
              </button>
            </div>

            {/* 스캔 상태 표시 */}
            {isScanning && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                <Search className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium text-primary">
                  스크린샷 탐색 중...
                </span>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}

            {/* 자동 감지 완료 표시 */}
            {autoDetected && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  시작/종료 스크린샷 자동 감지 완료
                </span>
              </div>
            )}

            {/* 스크린샷 목록 */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {isLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">스크린샷 로딩 중...</p>
                </div>
              ) : screenshots.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-muted/50 mb-3">
                    {isScanning ? (
                      <FolderSearch className="h-6 w-6 text-muted-foreground animate-pulse" />
                    ) : (
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isScanning
                      ? "스크린샷을 찍으면 자동으로 인식됩니다"
                      : `${formatDate(date)}의 스크린샷이 없습니다`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {screenshots.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className={cn(
                        "w-full p-3 rounded-xl border-2 text-left transition-all",
                        selectedStart?.path === file.path &&
                          "border-green-500 bg-green-500/10",
                        selectedEnd?.path === file.path && "border-blue-500 bg-blue-500/10",
                        selectedStart?.path !== file.path &&
                          selectedEnd?.path !== file.path &&
                          "border-border hover:border-primary/30 hover:bg-accent"
                      )}
                      onClick={() => handleManualSelect(file)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">
                          {file.displayTime}
                        </span>
                        <div className="flex gap-1">
                          {selectedStart?.path === file.path && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-semibold">
                              시작
                            </span>
                          )}
                          {selectedEnd?.path === file.path && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold">
                              종료
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {file.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 분석 에러 표시 */}
            {analyzeError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">{analyzeError}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  수동 입력을 이용하거나 다시 시도해주세요
                </p>
              </div>
            )}

            {/* 분석 중 표시 */}
            {isAnalyzing && (
              <div className="flex items-center justify-center gap-3 py-4 px-3 rounded-lg bg-primary/10 border border-primary/20">
                <Scan className="h-5 w-5 text-primary animate-pulse" />
                <div>
                  <span className="text-sm font-medium text-primary">
                    스크린샷 분석 중...
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    잠시만 기다려주세요
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {/* 버튼 영역 */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                className="flex-1 rounded-xl border-2 border-green-800/50"
                disabled={!selectedStart || !selectedEnd || isAnalyzing}
                onClick={handleConfirmSelection}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4 mr-2" />
                    분석 시작
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSelectFolder}
                className="rounded-xl"
                title="스크린샷 폴더 변경"
                disabled={isAnalyzing}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleManualInputClick}
                className="rounded-xl"
                disabled={isAnalyzing}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                수동 입력
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
