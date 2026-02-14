import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import type { Character, BossSetting, BossClear } from "@/types";
import { bossData, formatMeso, type Difficulty } from "@/data/bossData";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { cn, formatShortDate } from "@/lib/utils";

interface BossClearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  character: Character;
  onDataChanged: () => void;
}

export function BossClearDialog({
  open,
  onOpenChange,
  date,
  character,
  onDataChanged,
}: BossClearDialogProps) {
  const [bossSettings, setBossSettings] = useState<BossSetting[]>([]);
  const [weeklyClears, setWeeklyClears] = useState<BossClear[]>([]);
  const [monthlyClears, setMonthlyClears] = useState<BossClear[]>([]);
  const [todayClears, setTodayClears] = useState<BossClear[]>([]);
  const [weekStartDate, setWeekStartDate] = useState<string>("");
  const [monthStartDate, setMonthStartDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, date, character.id]);

  async function loadData() {
    setIsLoading(true);
    try {
      // 주간 시작일 계산
      const weekStart = await invoke<string>("get_week_start_date", { date });
      setWeekStartDate(weekStart);

      // 월간 시작일 계산
      const monthStart = await invoke<string>("get_month_start_date", { date });
      setMonthStartDate(monthStart);

      // 보스 설정 로드
      const settings = await invoke<BossSetting[]>("get_boss_settings", {
        characterId: character.id,
      });
      setBossSettings(settings.filter((s) => s.enabled));

      // 주간 클리어 로드
      const weeklyClrs = await invoke<BossClear[]>("get_boss_clears_by_week", {
        characterId: character.id,
        weekStartDate: weekStart,
      });
      setWeeklyClears(weeklyClrs);

      // 월간 클리어 로드 (월간 보스용)
      const monthlyClrs = await invoke<BossClear[]>("get_boss_clears_by_week", {
        characterId: character.id,
        weekStartDate: monthStart,
      });
      setMonthlyClears(monthlyClrs);

      // 오늘 클리어 로드
      const today = await invoke<BossClear[]>("get_boss_clears_by_date", {
        characterId: character.id,
        date,
      });
      setTodayClears(today);
    } catch (error) {
      console.error("Failed to load boss data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 보스 클리어 토글
  const handleToggleClear = useCallback(async (setting: BossSetting) => {
    const boss = bossData.find((b) => b.id === setting.boss_id);
    const isMonthly = boss?.isMonthly || false;
    const clears = isMonthly ? monthlyClears : weeklyClears;
    const startDate = isMonthly ? monthStartDate : weekStartDate;
    const isCleared = clears.some((c) => c.boss_id === setting.boss_id);

    // 스크롤 위치 저장
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }

    try {
      if (isCleared) {
        // 클리어 해제
        await invoke("delete_boss_clear", {
          characterId: character.id,
          bossId: setting.boss_id,
          weekStartDate: startDate,
        });
      } else {
        // 클리어 등록
        const diffData = boss?.difficulties.find(
          (d) => d.difficulty === setting.difficulty
        );

        if (diffData) {
          await invoke("save_boss_clear", {
            input: {
              character_id: character.id,
              boss_id: setting.boss_id,
              difficulty: setting.difficulty,
              cleared_date: date,
              crystal_price: diffData.price,
              party_size: setting.party_size,
              is_monthly: isMonthly,
            },
          });
        }
      }

      // 데이터 새로고침 (스크롤 위치 유지)
      await loadDataWithoutScroll();
      onDataChanged();
    } catch (error) {
      console.error("Failed to toggle boss clear:", error);
    }
  }, [monthlyClears, weeklyClears, monthStartDate, weekStartDate, character.id, date, onDataChanged]);

  // 스크롤 위치를 유지하면서 데이터 로드
  async function loadDataWithoutScroll() {
    try {
      const weekStart = weekStartDate;
      const monthStart = monthStartDate;

      // 주간 클리어 로드
      const weeklyClrs = await invoke<BossClear[]>("get_boss_clears_by_week", {
        characterId: character.id,
        weekStartDate: weekStart,
      });
      setWeeklyClears(weeklyClrs);

      // 월간 클리어 로드
      const monthlyClrs = await invoke<BossClear[]>("get_boss_clears_by_week", {
        characterId: character.id,
        weekStartDate: monthStart,
      });
      setMonthlyClears(monthlyClrs);

      // 오늘 클리어 로드
      const today = await invoke<BossClear[]>("get_boss_clears_by_date", {
        characterId: character.id,
        date,
      });
      setTodayClears(today);

      // 스크롤 위치 복원
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    } catch (error) {
      console.error("Failed to load boss data:", error);
    }
  }

  // 오늘 수익 계산
  const todayIncome = useMemo(() => {
    return todayClears.reduce((total, clear) => {
      return total + Math.floor(clear.crystal_price / clear.party_size);
    }, 0);
  }, [todayClears]);

  // 정렬된 보스 목록 (월간 우선, 가격 내림차순)
  const sortedBossSettings = useMemo(() => {
    return [...bossSettings].sort((a, b) => {
      const bossA = bossData.find((boss) => boss.id === a.boss_id);
      const bossB = bossData.find((boss) => boss.id === b.boss_id);

      // 월간 보스 우선
      const isMonthlyA = bossA?.isMonthly || false;
      const isMonthlyB = bossB?.isMonthly || false;
      if (isMonthlyA !== isMonthlyB) {
        return isMonthlyA ? -1 : 1;
      }

      // 가격 내림차순
      const diffA = bossA?.difficulties.find((d) => d.difficulty === a.difficulty);
      const diffB = bossB?.difficulties.find((d) => d.difficulty === b.difficulty);
      const priceA = diffA ? Math.floor(diffA.price / a.party_size) : 0;
      const priceB = diffB ? Math.floor(diffB.price / b.party_size) : 0;
      return priceB - priceA;
    });
  }, [bossSettings]);

  // 주간/월간 보스 통계
  const bossStats = useMemo(() => {
    const weeklyBosses = bossSettings.filter((s) => {
      const boss = bossData.find((b) => b.id === s.boss_id);
      return !boss?.isMonthly;
    });
    const monthlyBosses = bossSettings.filter((s) => {
      const boss = bossData.find((b) => b.id === s.boss_id);
      return boss?.isMonthly;
    });

    const weeklyClearedCount = weeklyClears.filter((c) => {
      const boss = bossData.find((b) => b.id === c.boss_id);
      return !boss?.isMonthly;
    }).length;

    const monthlyClearedCount = monthlyClears.filter((c) => {
      const boss = bossData.find((b) => b.id === c.boss_id);
      return boss?.isMonthly;
    }).length;

    return {
      weeklyTotal: weeklyBosses.length,
      weeklyCleared: weeklyClearedCount,
      monthlyTotal: monthlyBosses.length,
      monthlyCleared: monthlyClearedCount,
    };
  }, [bossSettings, weeklyClears, monthlyClears]);

  // 보스별 클리어 상태 확인
  function isBossCleared(bossId: string): boolean {
    const boss = bossData.find((b) => b.id === bossId);
    const clears = boss?.isMonthly ? monthlyClears : weeklyClears;
    return clears.some((c) => c.boss_id === bossId);
  }

  // 보스가 오늘 클리어되었는지 확인
  function isClearedToday(bossId: string): boolean {
    return todayClears.some((c) => c.boss_id === bossId);
  }

  // 클리어 날짜 확인
  function getClearDate(bossId: string): string | null {
    const boss = bossData.find((b) => b.id === bossId);
    const clears = boss?.isMonthly ? monthlyClears : weeklyClears;
    const clear = clears.find((c) => c.boss_id === bossId);
    return clear?.cleared_date || null;
  }

  // 다음 주간 초기화일 계산 (현재 주 시작일 + 7일)
  function getNextWeeklyReset(weekStart: string): string {
    const [year, month, day] = weekStart.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 7);
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (목)`;
  }

  // 다음 월간 초기화일 계산 (다음 달 1일)
  function getNextMonthlyReset(monthStart: string): string {
    const [year, month] = monthStart.split("-").map(Number);
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    return `${nextMonth}월 1일`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img src="/images/icons/주간결정석.png" alt="보스" className="w-7 h-7" />
            보스 클리어
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="mt-3 text-sm text-muted-foreground font-medium">로딩 중...</p>
          </div>
        ) : bossSettings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-foreground mb-1">설정된 보스가 없습니다</p>
            <p className="text-sm text-muted-foreground">
              보스 설정에서 보스를 추가해주세요
            </p>
          </div>
        ) : (
          <>
            {/* 수익 요약 */}
            <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-2 border-amber-500/30">
              <div className="flex items-center gap-2 mb-1">
                <img src="/images/icons/메소.png" alt="메소" className="w-5 h-5" />
                <span className="text-sm font-semibold text-muted-foreground">오늘 수익</span>
              </div>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatMeso(todayIncome)}
              </p>
            </Card>

            {/* 주간/월간 클리어 현황 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 주간 보스 */}
              <div className="rounded-xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src="/images/icons/주간결정석.png" alt="주간" className="w-4 h-4" />
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">주간 보스</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    초기화: {getNextWeeklyReset(weekStartDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-purple-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-300"
                      style={{
                        width: bossStats.weeklyTotal > 0
                          ? `${(bossStats.weeklyCleared / bossStats.weeklyTotal) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400 min-w-[50px] text-right">
                    {bossStats.weeklyCleared} / {bossStats.weeklyTotal}
                  </span>
                </div>
                {bossStats.weeklyCleared === bossStats.weeklyTotal && bossStats.weeklyTotal > 0 && (
                  <p className="text-xs text-green-500 font-semibold mt-1 text-center">완료!</p>
                )}
              </div>

              {/* 월간 보스 */}
              <div className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src="/images/icons/월간결정석.png" alt="월간" className="w-4 h-4" />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">월간 보스</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    초기화: {getNextMonthlyReset(monthStartDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-amber-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{
                        width: bossStats.monthlyTotal > 0
                          ? `${(bossStats.monthlyCleared / bossStats.monthlyTotal) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 min-w-[50px] text-right">
                    {bossStats.monthlyCleared} / {bossStats.monthlyTotal}
                  </span>
                </div>
                {bossStats.monthlyCleared === bossStats.monthlyTotal && bossStats.monthlyTotal > 0 && (
                  <p className="text-xs text-green-500 font-semibold mt-1 text-center">완료!</p>
                )}
              </div>
            </div>

            {/* 보스 목록 */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-2 pr-2">
              {sortedBossSettings.map((setting) => {
                const boss = bossData.find((b) => b.id === setting.boss_id);
                if (!boss) return null;

                const diffData = boss.difficulties.find(
                  (d) => d.difficulty === setting.difficulty
                );
                if (!diffData) return null;

                const isCleared = isBossCleared(setting.boss_id);
                const clearedToday = isClearedToday(setting.boss_id);
                const clearDate = getClearDate(setting.boss_id);
                const personalIncome = Math.floor(diffData.price / setting.party_size);
                const isDisabled = isCleared && !clearedToday;

                return (
                  <div
                    key={setting.boss_id}
                    className={cn(
                      "grid grid-cols-[24px_48px_1fr_auto] items-center gap-3 p-3 rounded-lg transition-colors",
                      isCleared
                        ? clearedToday
                          ? "bg-green-500/10"
                          : "bg-muted/30 opacity-60"
                        : "bg-muted/30 hover:bg-muted/50",
                      boss.isMonthly && "border border-amber-500/30"
                    )}
                  >
                    {/* 체크박스 */}
                    <Checkbox
                      id={`boss-${setting.boss_id}`}
                      checked={isCleared}
                      disabled={isDisabled}
                      onCheckedChange={() => {
                        if (isDisabled) return;
                        handleToggleClear(setting);
                      }}
                    />

                    {/* 보스 이미지 */}
                    <img
                      src={boss.image}
                      alt={boss.name}
                      className="w-10 h-10 object-contain flex-shrink-0 rounded-lg"
                    />

                    {/* 보스 정보 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <label htmlFor={`boss-${setting.boss_id}`} className="font-medium text-sm truncate cursor-pointer">
                          {boss.name}
                        </label>
                        {boss.isMonthly && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">
                            월간
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <DifficultyBadge difficulty={setting.difficulty as Difficulty} size="sm" />
                        {setting.party_size > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {setting.party_size}인
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 가격 및 클리어 상태 */}
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-sm font-semibold",
                        isCleared ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                      )}>
                        {formatMeso(personalIncome)}
                      </p>
                      {isCleared && clearDate && !clearedToday && (
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(clearDate)} 클리어
                        </p>
                      )}
                      {clearedToday && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          오늘 클리어
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
