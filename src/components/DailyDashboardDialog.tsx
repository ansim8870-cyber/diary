import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sword, ScrollText, Crown, TrendingUp, Coins, Star } from "lucide-react";
import type { DailyTotal, Character } from "@/types";
import { HuntingDialog } from "./HuntingDialog";

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
  const [dailyTotal, setDailyTotal] = useState<DailyTotal | null>(null);
  const [showHuntingDialog, setShowHuntingDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && date) {
      loadDailyData();
    }
  }, [open, date]);

  async function loadDailyData() {
    setIsLoading(true);
    try {
      const [year, month] = date.split("-").map(Number);
      const totals = await invoke<DailyTotal[]>("get_daily_totals", {
        year,
        month,
      });
      const todayTotal = totals.find((t) => t.date === date);
      setDailyTotal(todayTotal || null);
    } catch (error) {
      console.error("Failed to load daily data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleHuntingSaved() {
    loadDailyData();
    onDataChanged();
  }

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split("-");
    return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
  }

  // 레벨업 여부 확인 (경험치 100% 이상 획득 시)
  const hasLevelUp = dailyTotal && dailyTotal.total_exp_gained >= 100;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{formatDate(date)}</DialogTitle>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="flex-col h-auto py-3 gap-1.5"
              disabled
            >
              <ScrollText className="h-5 w-5" />
              <span className="text-xs">피드</span>
            </Button>
            <Button
              variant="default"
              className="flex-col h-auto py-3 gap-1.5"
              onClick={() => setShowHuntingDialog(true)}
            >
              <Sword className="h-5 w-5" />
              <span className="text-xs">사냥</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col h-auto py-3 gap-1.5"
              disabled
            >
              <Crown className="h-5 w-5" />
              <span className="text-xs">보스</span>
            </Button>
          </div>

          {/* Dashboard Content */}
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              로딩 중...
            </div>
          ) : dailyTotal ? (
            <div className="space-y-4">
              {/* Level Up Celebration */}
              {hasLevelUp && (
                <div className="rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-lg">레벨 업!</span>
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    축하합니다! 오늘 레벨업에 성공했습니다!
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Exp Gained */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">획득 경험치</span>
                  </div>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    +{dailyTotal.total_exp_gained.toFixed(2)}%
                  </p>
                </div>

                {/* Meso Gained */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Coins className="h-4 w-4" />
                    <span className="text-xs">획득 메소</span>
                  </div>
                  <p className="text-xl font-bold">
                    +{dailyTotal.total_meso_gained.toLocaleString()}
                  </p>
                </div>

                {/* Sojaebi */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Sword className="h-4 w-4" />
                    <span className="text-xs">총 소재비</span>
                  </div>
                  <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {dailyTotal.total_sojaebi.toFixed(1)}
                  </p>
                </div>

                {/* Session Count */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <span className="text-xs">사냥 횟수</span>
                  </div>
                  <p className="text-xl font-bold">
                    {dailyTotal.session_count}회
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-2">아직 기록이 없습니다</p>
              <p className="text-sm text-muted-foreground">
                사냥 버튼을 눌러 기록을 추가해보세요!
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hunting Dialog */}
      <HuntingDialog
        open={showHuntingDialog}
        onOpenChange={setShowHuntingDialog}
        date={date}
        characterId={character.id}
        onSaved={handleHuntingSaved}
      />
    </>
  );
}
