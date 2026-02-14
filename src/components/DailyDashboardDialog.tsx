import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sword, Skull, Star } from "lucide-react";
import type { DailyTotalWithPieces, Character, BossSetting, BossClear, HuntingSession, HuntingOcrResult, ItemDrop } from "@/types";
import { HuntingDialog } from "./HuntingDialog";
import { BossClearDialog } from "./BossClearDialog";
import { ItemDropAddDialog, ItemDropListDialog } from "./ItemDropDialog";
import { ScreenshotRecognitionDialog } from "./ScreenshotRecognitionDialog";
import { formatMeso, formatMesoDetailed } from "@/data/bossData";
import { formatExpWithPercent } from "@/data/expTable";
import { formatDate } from "@/lib/utils";

interface DailyDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  character: Character;
  onDataChanged: () => void;
}

export function DailyDashboardDialog({
  open,
  onOpenChange,
  date,
  character,
  onDataChanged,
}: DailyDashboardDialogProps) {
  const [dailyTotal, setDailyTotal] = useState<DailyTotalWithPieces | null>(null);
  const [huntingSessions, setHuntingSessions] = useState<HuntingSession[]>([]);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [showHuntingDialog, setShowHuntingDialog] = useState(false);
  const [huntingStartWithForm, setHuntingStartWithForm] = useState(false);
  const [showBossDialog, setShowBossDialog] = useState(false);
  const [showItemDropAddDialog, setShowItemDropAddDialog] = useState(false);
  const [showItemDropListDialog, setShowItemDropListDialog] = useState(false);
  const [itemDrops, setItemDrops] = useState<ItemDrop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasBossSettings, setHasBossSettings] = useState(false);
  const [todayBossClears, setTodayBossClears] = useState<BossClear[]>([]);
  // OCR 결과 저장
  const [ocrResult, setOcrResult] = useState<HuntingOcrResult | null>(null);
  const [screenshotPaths, setScreenshotPaths] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (open && date) {
      loadDailyData();
    }
  }, [open, date]);

  async function loadDailyData() {
    setIsLoading(true);
    try {
      const [year, month] = date.split("-").map(Number);

      // 일일 통계 로드 (조각 포함)
      const totals = await invoke<DailyTotalWithPieces[]>("get_daily_totals_with_pieces", {
        characterId: character.id,
        year,
        month,
      });
      const todayTotal = totals.find((t) => t.date === date);
      setDailyTotal(todayTotal || null);

      // 보스 설정 확인
      const bossSettings = await invoke<BossSetting[]>("get_boss_settings", {
        characterId: character.id,
      });
      setHasBossSettings(bossSettings.some((s) => s.enabled));

      // 오늘 보스 클리어 로드
      const clears = await invoke<BossClear[]>("get_boss_clears_by_date", {
        characterId: character.id,
        date,
      });
      setTodayBossClears(clears);

      // 사냥 세션 로드 (솔 에르다 정보용)
      const sessions = await invoke<HuntingSession[]>("get_hunting_sessions", {
        characterId: character.id,
        date,
      });
      setHuntingSessions(sessions);

      // 아이템 드랍 로드
      const drops = await invoke<ItemDrop[]>("get_item_drops", {
        characterId: character.id,
        date,
      });
      setItemDrops(drops);
    } catch (error) {
      console.error("Failed to load daily data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleHuntingSaved() {
    loadDailyData();
    onDataChanged();
    // OCR 결과 초기화
    setOcrResult(null);
    setScreenshotPaths(null);
  }

  function handleBossDataChanged() {
    loadDailyData();
    onDataChanged();
  }

  // 레벨업 여부 확인 (경험치 100% 이상 획득 시)
  const hasLevelUp = dailyTotal && dailyTotal.total_exp_gained >= 100;

  // 오늘 보스 수익 계산
  const todayBossIncome = todayBossClears.reduce((total, clear) => {
    return total + Math.floor(clear.crystal_price / clear.party_size);
  }, 0);

  // 솔 에르다 합계 계산
  const totalSolErda = huntingSessions.reduce((total, session) => {
    return total + session.sol_erda_gained;
  }, 0);

  // 솔 에르다 조각 합계 계산
  const totalSolErdaPiece = huntingSessions.reduce((total, session) => {
    return total + session.sol_erda_piece_gained;
  }, 0);

  // 득템 합계
  const itemDropTotal = itemDrops.reduce((total, drop) => total + drop.price, 0);
  const mostExpensiveDrop = itemDrops.length > 0 ? itemDrops.reduce((a, b) => a.price >= b.price ? a : b) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              {formatDate(date)}
            </DialogTitle>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="default"
              className="flex-col h-auto py-3 gap-1.5 rounded-xl border-2 border-primary/50 shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200"
              onClick={() => setShowScreenshotDialog(true)}
            >
              <Sword className="h-5 w-5" />
              <span className="text-xs font-semibold">사냥</span>
            </Button>
            <Button
              variant="default"
              className={
                hasBossSettings
                  ? "flex-col h-auto py-3 gap-1.5 rounded-xl border-2 border-primary/50 shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200"
                  : "flex-col h-auto py-3 gap-1.5 rounded-xl border-2 cursor-not-allowed opacity-50"
              }
              onClick={() => setShowBossDialog(true)}
              disabled={!hasBossSettings}
            >
              <Skull className={hasBossSettings ? "h-5 w-5" : "h-5 w-5 text-muted-foreground"} />
              <span className="text-xs font-semibold">보스</span>
            </Button>
            <Button
              variant="default"
              className="flex-col h-auto py-3 gap-1.5 rounded-xl border-2 border-primary/50 shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200"
              onClick={() => setShowItemDropAddDialog(true)}
            >
              <span className="text-lg">🎁</span>
              <span className="text-xs font-semibold">득템</span>
            </Button>
          </div>

          {/* Dashboard Content */}
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
              <p className="mt-3 text-sm text-muted-foreground font-medium">로딩 중...</p>
            </div>
          ) : (dailyTotal || todayBossClears.length > 0 || itemDrops.length > 0) ? (
            <div className="space-y-4">
              {/* Level Up Celebration */}
              {hasLevelUp && (
                <div className="rounded-2xl bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-yellow-500/40 p-5 text-center animate-pulse-subtle">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-xl bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">레벨 업!</span>
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    축하합니다! 오늘 레벨업에 성공했습니다!
                  </p>
                </div>
              )}

              {/* Hunting Section */}
              <fieldset
                className="rounded-xl border-2 border-orange-500/20 p-2.5 pt-1.5 cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/5 transition-all duration-200"
                onClick={() => {
                  setHuntingStartWithForm(false);
                  setShowHuntingDialog(true);
                }}
              >
                <legend className="flex items-center gap-1.5 px-2 text-orange-600 dark:text-orange-400">
                  <img src="/images/icons/재획비.png" alt="" className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">
                    {Math.round(dailyTotal?.total_sojaebi ?? 0)} 소재비 (사냥 {dailyTotal?.session_count ?? 0}건)
                  </span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {/* Exp Gained */}
                  <div className="rounded-xl border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1.5">
                      <img src="/images/icons/경험치.png" alt="" className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">획득 경험치</span>
                    </div>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatExpWithPercent(character.character_level, dailyTotal?.total_exp_gained ?? 0)}
                    </p>
                  </div>

                  {/* Meso Gained */}
                  <div className="rounded-xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1.5">
                      <img src="/images/icons/메소.png" alt="" className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">획득 메소</span>
                    </div>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      +{formatMeso(dailyTotal?.total_meso_gained ?? 0)}
                    </p>
                  </div>

                  {/* Sol Erda */}
                  <div className="rounded-xl border-2 border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-sky-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 mb-1.5">
                      <img src="/images/icons/솔에르다.png" alt="" className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">솔 에르다</span>
                    </div>
                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
                      +{totalSolErda.toFixed(2)}개
                    </p>
                  </div>

                  {/* Sol Erda Piece */}
                  <div className="rounded-xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 mb-1.5">
                      <img src="/images/icons/솔에르다조각.png" alt="" className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">솔 에르다 조각</span>
                    </div>
                    <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                      +{totalSolErdaPiece.toLocaleString()}개
                    </p>
                  </div>
                </div>
              </fieldset>

              {/* Boss Section */}
              <div className="grid grid-cols-2 gap-2">
                {/* Boss Clear Summary */}
                <div
                  className="rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10 p-2.5 cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/10 transition-all duration-200"
                  onClick={() => setShowBossDialog(true)}
                >
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1.5">
                    <img src="/images/icons/주간결정석.png" alt="" className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">보스 클리어 (결정석 {todayBossClears.length}개)</span>
                  </div>
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    +{formatMeso(todayBossIncome)}
                  </p>
                </div>

                {/* Item Drops */}
                <div
                  className="rounded-xl border-2 border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-pink-500/10 p-2.5 cursor-pointer hover:border-pink-500/40 hover:bg-pink-500/10 transition-all duration-200"
                  onClick={() => setShowItemDropListDialog(true)}
                >
                  <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 mb-1.5 min-w-0">
                    <span className="text-xs flex-shrink-0">🎁</span>
                    <span className="text-[11px] font-semibold flex-shrink-0">득템</span>
                    {mostExpensiveDrop && (
                      <span className="text-[11px] font-semibold truncate min-w-0">({mostExpensiveDrop.item_name}{itemDrops.length > 1 ? ` 외 ${itemDrops.length - 1}개` : ""})</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-pink-600 dark:text-pink-400">
                    {mostExpensiveDrop ? `+${formatMeso(itemDropTotal)}` : "-"}
                  </p>
                </div>
              </div>

              {/* Daily Total Income */}
              <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary">
                    <img src="/images/icons/메소.png" alt="" className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold">일일 총 수익</span>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    {formatMesoDetailed((dailyTotal?.total_meso_gained ?? 0) + todayBossIncome + (dailyTotal ? dailyTotal.total_pieces * dailyTotal.avg_piece_price : 0) + itemDropTotal)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mb-4">
                <Sword className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">아직 기록이 없습니다</p>
              <p className="text-sm text-muted-foreground">
                사냥 버튼을 눌러 기록을 추가해보세요!
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Screenshot Recognition Dialog */}
      <ScreenshotRecognitionDialog
        open={showScreenshotDialog}
        onOpenChange={setShowScreenshotDialog}
        date={date}
        characterId={character.id}
        characterLevel={character.character_level}
        onManualInput={() => {
          setShowScreenshotDialog(false);
          setOcrResult(null);
          setScreenshotPaths(null);
          setHuntingStartWithForm(true);
          setShowHuntingDialog(true);
        }}
        onOcrAnalyzed={(result, startPath, endPath) => {
          setShowScreenshotDialog(false);
          setOcrResult(result);
          setScreenshotPaths({ start: startPath, end: endPath });
          setShowHuntingDialog(true);
        }}
      />

      {/* Hunting Dialog */}
      <HuntingDialog
        open={showHuntingDialog}
        onOpenChange={(open) => {
          setShowHuntingDialog(open);
          if (!open) {
            setOcrResult(null);
            setScreenshotPaths(null);
            setHuntingStartWithForm(false);
          }
        }}
        date={date}
        characterId={character.id}
        characterLevel={character.character_level}
        onSaved={handleHuntingSaved}
        startWithForm={huntingStartWithForm}
        onAddNew={() => {
          setShowHuntingDialog(false);
          setShowScreenshotDialog(true);
        }}
        ocrResult={ocrResult}
        screenshotPaths={screenshotPaths}
      />

      {/* Item Drop Add Dialog */}
      <ItemDropAddDialog
        open={showItemDropAddDialog}
        onOpenChange={setShowItemDropAddDialog}
        date={date}
        characterId={character.id}
        onSaved={() => {
          loadDailyData();
          onDataChanged();
        }}
      />

      {/* Item Drop List Dialog */}
      <ItemDropListDialog
        open={showItemDropListDialog}
        onOpenChange={setShowItemDropListDialog}
        date={date}
        characterId={character.id}
        onDataChanged={() => {
          loadDailyData();
          onDataChanged();
        }}
      />

      {/* Boss Clear Dialog */}
      <BossClearDialog
        open={showBossDialog}
        onOpenChange={setShowBossDialog}
        date={date}
        character={character}
        onDataChanged={handleBossDataChanged}
      />
    </>
  );
}
