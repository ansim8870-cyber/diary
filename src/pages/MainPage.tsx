import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Moon,
  Sun,
  RefreshCw,
  List,
  LayoutGrid,
  HelpCircle,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Character, DailyTotalWithPieces, BossClear, ItemDrop } from "@/types";
import { DailyDashboardDialog } from "@/components/DailyDashboardDialog";
import { EquipmentDialog } from "@/components/EquipmentDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { BossSettingsDialog } from "@/components/BossSettingsDialog";
import { PiecePriceDialog } from "@/components/PiecePriceDialog";
import { RevenueChart } from "@/components/RevenueChart";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { formatMeso, formatMesoDetailed } from "@/data/bossData";
import { formatExpShort } from "@/data/expTable";

interface MainPageProps {
  character: Character;
  onCharacterChange: (character: Character) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MainPage({ character, onCharacterChange }: MainPageProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [dailyTotals, setDailyTotals] = useState<Map<string, DailyTotalWithPieces>>(
    new Map()
  );
  const [bossClears, setBossClears] = useState<Map<string, BossClear[]>>(
    new Map()
  );
  const [itemDropsMap, setItemDropsMap] = useState<Map<string, ItemDrop[]>>(
    new Map()
  );
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showBossSettingsDialog, setShowBossSettingsDialog] = useState(false);
  const [showPiecePriceDialog, setShowPiecePriceDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"summary" | "detail">("detail");
  const [pageMode, setPageMode] = useState<"calendar" | "chart">("calendar");
  const [chartPeriod, setChartPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [monthsWithData, setMonthsWithData] = useState<Set<number>>(new Set());
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [yearlyData, setYearlyData] = useState<Array<{ month: number; label: string; hunting: number; pieces: number; boss: number; itemDrop: number; total: number }>>([]);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadDailyData();
  }, [year, month, character.id]);

  // 연간 데이터 로드
  useEffect(() => {
    if (chartPeriod !== "yearly") return;

    async function loadYearlyData() {
      try {
        const promises = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          return Promise.all([
            invoke<DailyTotalWithPieces[]>("get_daily_totals_with_pieces", { characterId: character.id, year, month: m }),
            invoke<BossClear[]>("get_monthly_boss_clears", { characterId: character.id, year, month: m }),
            invoke<ItemDrop[]>("get_monthly_item_drops", { characterId: character.id, year, month: m }),
          ]);
        });
        const results = await Promise.all(promises);

        const data = results.map(([totals, clears, drops], i) => {
          const hunting = totals.reduce((s, t) => s + t.total_meso_gained, 0);
          const pieces = totals.reduce((s, t) => s + t.total_pieces * t.avg_piece_price, 0);
          const boss = clears.reduce((s, c) => s + Math.floor(c.crystal_price / c.party_size), 0);
          const itemDrop = drops.reduce((s, d) => s + d.price, 0);
          return {
            month: i + 1,
            label: `${i + 1}월`,
            hunting,
            pieces,
            boss,
            itemDrop,
            total: hunting + pieces + boss + itemDrop,
          };
        });
        setYearlyData(data);
      } catch (error) {
        console.error("Failed to load yearly data:", error);
      }
    }

    loadYearlyData();
  }, [chartPeriod, year, character.id]);

  // 월 선택기 년도 변경 시 데이터 있는 월 조회
  useEffect(() => {
    if (showMonthPicker) {
      invoke<number[]>("get_months_with_data", {
        characterId: character.id,
        year: pickerYear,
      }).then((months) => {
        console.log("[MonthPicker] months with data:", months);
        setMonthsWithData(new Set(months));
      }).catch((err) => {
        console.error("[MonthPicker] failed to load months:", err);
        setMonthsWithData(new Set());
      });
    }
  }, [showMonthPicker, pickerYear, character.id]);

  // 월 선택기 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    }
    if (showMonthPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMonthPicker]);

  function handleMonthSelect(selectedMonth: number) {
    setCurrentDate(new Date(pickerYear, selectedMonth, 1));
    setShowMonthPicker(false);
  }

  function openMonthPicker() {
    setPickerYear(year);
    setShowMonthPicker(!showMonthPicker);
  }

  async function loadDailyData() {
    try {
      // 사냥 데이터 로드 (조각 정보 포함)
      const totals = await invoke<DailyTotalWithPieces[]>("get_daily_totals_with_pieces", {
        characterId: character.id,
        year,
        month: month + 1,
      });

      const totalsMap = new Map<string, DailyTotalWithPieces>();
      totals.forEach((total) => {
        totalsMap.set(total.date, total);
      });
      setDailyTotals(totalsMap);

      // 보스 클리어 데이터 로드
      const clears = await invoke<BossClear[]>("get_monthly_boss_clears", {
        characterId: character.id,
        year,
        month: month + 1,
      });

      const clearsMap = new Map<string, BossClear[]>();
      clears.forEach((clear) => {
        const existing = clearsMap.get(clear.cleared_date) || [];
        existing.push(clear);
        clearsMap.set(clear.cleared_date, existing);
      });
      setBossClears(clearsMap);

      // 아이템 드랍 데이터 로드
      const drops = await invoke<ItemDrop[]>("get_monthly_item_drops", {
        characterId: character.id,
        year,
        month: month + 1,
      });

      const dropsMap = new Map<string, ItemDrop[]>();
      drops.forEach((drop) => {
        const existing = dropsMap.get(drop.date) || [];
        existing.push(drop);
        dropsMap.set(drop.date, existing);
      });
      setItemDropsMap(dropsMap);
    } catch (error) {
      console.error("Failed to load daily data:", error);
    }
  }

  function getCalendarDays() {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // 이전 달의 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 현재 달의 날짜
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }

  function formatDate(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function handleDateClick(day: number) {
    const dateStr = formatDate(day);
    setSelectedDate(dateStr);
    setShowDashboardDialog(true);
  }

  function handleDataChanged() {
    loadDailyData();
  }

  async function handleRefreshCharacter() {
    setIsRefreshing(true);
    try {
      const refreshedCharacter = await invoke<Character>("refresh_character");
      onCharacterChange(refreshedCharacter);
    } catch (error) {
      console.error("Failed to refresh character:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  // 일별 보스 수익 계산
  function getDailyBossIncome(clears: BossClear[]): number {
    return clears.reduce((total, clear) => {
      return total + Math.floor(clear.crystal_price / clear.party_size);
    }, 0);
  }

  // 일별 득템 합계 계산
  function getDailyItemDropTotal(drops: ItemDrop[]): number {
    return drops.reduce((total, drop) => total + drop.price, 0);
  }

  // 월간 총 메소 수익 계산
  const monthlyTotalIncome = useMemo(() => {
    let total = 0;

    // 사냥 메소 + 조각 가치
    dailyTotals.forEach((dt) => {
      total += dt.total_meso_gained;
      total += dt.total_pieces * dt.avg_piece_price;
    });

    // 보스 메소
    bossClears.forEach((clears) => {
      clears.forEach((clear) => {
        total += Math.floor(clear.crystal_price / clear.party_size);
      });
    });

    // 득템 메소
    itemDropsMap.forEach((drops) => {
      drops.forEach((drop) => {
        total += drop.price;
      });
    });

    return total;
  }, [dailyTotals, bossClears, itemDropsMap]);

  const calendarDays = useMemo(() => getCalendarDays(), [year, month]);

  // 주차 범위 계산 (차트 주간 모드용)
  const weekRanges = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const ranges: { week: number; startDay: number; endDay: number }[] = [];
    let weekNum = 1;
    let startDay = 1;
    for (let i = 0; i < daysInMonth; i++) {
      const dayOfWeek = (firstDayOfWeek + i) % 7;
      const isLastDay = i === daysInMonth - 1;
      if (dayOfWeek === 6 || isLastDay) {
        ranges.push({ week: weekNum, startDay, endDay: i + 1 });
        weekNum++;
        startDay = i + 2;
      }
    }
    return ranges;
  }, [year, month]);

  // 월 변경 시 주차 선택 초기화
  useEffect(() => {
    setSelectedWeek(null);
  }, [year, month]);

  return (
  <>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-4 xl:px-8 2xl:px-12 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="relative h-16 w-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm ring-1 ring-border/40 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/60 transition-all"
              onClick={() => setShowEquipmentDialog(true)}
              title="장비 정보 보기"
            >
              <img
                src={character.character_image}
                alt={character.character_name}
                className="h-full w-full object-cover scale-[3] -translate-y-[5%]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight">
                  {character.character_name}
                  <span className="text-sm text-muted-foreground font-medium ml-1">({character.world_name})</span>
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary/20 hover:text-primary transition-colors"
                  onClick={handleRefreshCharacter}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Lv.{character.character_level}
                {character.character_exp_rate && (
                  <span className="text-primary font-semibold"> ({character.character_exp_rate}%)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pageMode === "calendar" ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg h-8 px-3 border-border/80 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all"
                onClick={() => setPageMode("chart")}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-semibold">수익 차트</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg h-8 px-3 border-border/80 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all"
                onClick={() => setPageMode("calendar")}
              >
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm font-semibold">캘린더</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2 rounded-lg h-8 px-3 border-border/80 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all" onClick={() => setShowPiecePriceDialog(true)}>
              <img src="/images/icons/솔에르다조각.png" alt="조각" className="w-4 h-4" />
              <span className="text-sm font-semibold">조각 가격</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2 rounded-lg h-8 px-3 border-border/80 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all" onClick={() => setShowBossSettingsDialog(true)}>
              <img src="/images/icons/주간결정석.png" alt="보스" className="w-4 h-4" />
              <span className="text-sm font-semibold">보스 설정</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg h-8 w-8 text-gray-400 cursor-not-allowed opacity-50"
              disabled
              title="준비 중"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={() => setShowSettingsDialog(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={() => setShowHelpDialog(true)}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 xl:px-8 2xl:px-12 py-4 flex-1">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {chartPeriod === "yearly" && pageMode === "chart" ? (
              <>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={() => setCurrentDate(new Date(year - 1, month, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl xl:text-2xl font-bold tracking-tight min-w-[140px] text-center select-none">
                  {year}년
                </h2>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={() => setCurrentDate(new Date(year + 1, month, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative" ref={monthPickerRef}>
              <h2
                className="text-xl xl:text-2xl font-bold tracking-tight min-w-[140px] text-center cursor-pointer hover:text-primary transition-colors select-none"
                onClick={openMonthPicker}
              >
                {year}년 {month + 1}월
              </h2>
              {showMonthPicker && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-popover border-2 border-border rounded-xl shadow-lg p-3 w-[220px]" style={{ backgroundColor: "hsl(var(--popover))" }}>
                  {/* 년도 선택 */}
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" className="rounded-full h-7 w-7 hover:bg-primary/20" onClick={() => setPickerYear(prev => prev - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-base font-bold">{pickerYear}년</span>
                    <Button variant="ghost" size="icon" className="rounded-full h-7 w-7 hover:bg-primary/20" onClick={() => setPickerYear(prev => prev + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* 월 선택 그리드 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => {
                      const hasData = monthsWithData.has(i + 1);
                      return (
                        <button
                          key={i}
                          className={cn(
                            "h-9 rounded-lg text-sm transition-all hover:scale-110 hover:bg-muted",
                            hasData
                              ? "text-amber-600 dark:text-amber-400 font-bold"
                              : "text-muted-foreground font-medium"
                          )}
                          onClick={() => handleMonthSelect(i)}
                        >
                          {i + 1}월
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/20 hover:text-primary transition-colors" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
              </>
            )}
          </div>
          {/* 중간 영역: 캘린더=월간수익, 차트+주간=주차선택 */}
          {pageMode === "calendar" ? (
            <div className="flex items-center gap-2">
              <img src="/images/icons/메소.png" alt="" className="w-5 h-5" />
              <span className="text-sm font-semibold text-muted-foreground">월간 메소 수익:</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {formatMesoDetailed(monthlyTotalIncome)}
              </span>
            </div>
          ) : chartPeriod === "weekly" ? (
            <div className="flex items-center rounded-lg overflow-hidden border-2 border-border">
              <button
                className={cn(
                  "h-8 px-3 text-sm font-bold transition-all",
                  selectedWeek === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setSelectedWeek(null)}
              >
                전체
              </button>
              {weekRanges.map((w) => (
                <button
                  key={w.week}
                  className={cn(
                    "h-8 px-3 text-sm font-bold transition-all border-l border-border",
                    selectedWeek === w.week
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                  )}
                  onClick={() => setSelectedWeek(w.week)}
                >
                  {w.week}주차
                  <span className="text-[10px] font-normal ml-1 opacity-70">
                    ({w.startDay}~{w.endDay}일)
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}
          {/* View Mode Toggle / Chart Period Toggle */}
          {pageMode === "calendar" ? (
            <div className="flex items-center rounded-lg overflow-hidden border-2 border-border">
              <button
                className={cn(
                  "h-9 px-5 gap-2 text-sm font-bold transition-all flex items-center",
                  viewMode === "summary"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setViewMode("summary")}
              >
                <LayoutGrid className="h-4 w-4" />
                요약
              </button>
              <button
                className={cn(
                  "h-9 px-5 gap-2 text-sm font-bold transition-all flex items-center",
                  viewMode === "detail"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setViewMode("detail")}
              >
                <List className="h-4 w-4" />
                상세
              </button>
            </div>
          ) : (
            <div className="flex items-center rounded-lg overflow-hidden border-2 border-border">
              <button
                className={cn(
                  "h-9 px-5 gap-2 text-sm font-bold transition-all flex items-center",
                  chartPeriod === "weekly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setChartPeriod("weekly")}
              >
                <BarChart3 className="h-4 w-4" />
                주간
              </button>
              <button
                className={cn(
                  "h-9 px-5 gap-2 text-sm font-bold transition-all flex items-center",
                  chartPeriod === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setChartPeriod("monthly")}
              >
                <BarChart3 className="h-4 w-4" />
                월간
              </button>
              <button
                className={cn(
                  "h-9 px-5 gap-2 text-sm font-bold transition-all flex items-center",
                  chartPeriod === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/40 dark:text-gray-500"
                )}
                onClick={() => setChartPeriod("yearly")}
              >
                <BarChart3 className="h-4 w-4" />
                연간
              </button>
            </div>
          )}
        </div>

        {pageMode === "calendar" ? (
        /* Calendar Grid */
        <Card className="p-4 xl:p-6 shadow-lg">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 xl:gap-2.5 mb-2">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-center text-xs xl:text-sm font-bold py-2 rounded-lg",
                  i === 0 && "text-red-500 bg-red-500/5",
                  i === 6 && "text-blue-500 bg-blue-500/5",
                  i !== 0 && i !== 6 && "text-muted-foreground"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1.5 xl:gap-2.5">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="calendar-cell" />;
              }

              const dateStr = formatDate(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dailyTotal = dailyTotals.get(dateStr);
              const dailyBossClears = bossClears.get(dateStr) || [];
              const dailyItemDrops = itemDropsMap.get(dateStr) || [];
              const bossIncome = getDailyBossIncome(dailyBossClears);
              const itemDropIncome = getDailyItemDropTotal(dailyItemDrops);
              const dayOfWeek = (index % 7);

              // 상세보기용 계산: 사냥메소 + 보스메소 + 조각값 + 득템
              const huntingMeso = dailyTotal?.total_meso_gained ?? 0;
              const pieceValue = dailyTotal ? dailyTotal.total_pieces * dailyTotal.avg_piece_price : 0;
              const totalIncome = huntingMeso + bossIncome + pieceValue + itemDropIncome;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    "calendar-cell p-1.5 rounded-lg border text-left transition-all duration-200 cursor-pointer flex flex-col",
                    "hover:bg-primary/15 hover:shadow-lg hover:scale-[1.02] hover:border-primary/60",
                    isToday && "border-primary border-2 bg-primary/5 shadow-sm",
                    isSelected && "bg-accent ring-2 ring-primary ring-offset-1 border-primary",
                    !isToday && !isSelected && "border-border/50"
                  )}
                >
                  {/* 날짜 - 좌측상단 고정 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center h-5 w-5 xl:h-6 xl:w-6 rounded-full text-[10px] cal-text-xs font-bold transition-colors",
                        dayOfWeek === 0 && "text-red-500",
                        dayOfWeek === 6 && "text-blue-500",
                        isToday && "bg-primary text-primary-foreground",
                        !isToday && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-foreground"
                      )}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="relative text-[7px] font-bold text-white bg-sky-500 pr-1.5 py-0.5 rounded-r-sm ml-2" style={{paddingLeft: '8px', clipPath: 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)'}}>
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* 데이터 표시 영역 */}
                  <div className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden mt-0.5">
                    {viewMode === "summary" ? (
                      // 요약 뷰: 경험치 위, 메소 아래
                      <>
                        {/* 경험치 - 상단 */}
                        <div>
                          {dailyTotal && dailyTotal.total_exp_gained > 0 && (
                            <p className="text-[10px] cal-text-sm font-bold text-green-600 dark:text-green-400 truncate flex items-center gap-0.5">
                              <img src="/images/icons/경험치.png" alt="" className="w-3 h-3 cal-icon-sm flex-shrink-0" />
                              <span className="truncate">{formatExpShort(character.character_level, dailyTotal.total_exp_gained)}</span>
                            </p>
                          )}
                        </div>
                        {/* 메소 - 하단 (왼쪽 정렬) */}
                        <div>
                          {(dailyTotal || dailyBossClears.length > 0 || dailyItemDrops.length > 0) && totalIncome > 0 && (
                            <div className="flex flex-col items-start">
                              <span className="text-[9px] cal-text-xs text-gray-400 font-semibold">Total</span>
                              <p className="text-[10px] cal-text-sm font-bold text-amber-600 dark:text-amber-400 truncate flex items-center gap-0.5">
                                <img src="/images/icons/메소.png" alt="" className="w-3 h-3 cal-icon-sm flex-shrink-0" />
                                <span className="truncate">{formatMeso(totalIncome)}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      // 상세 뷰: 경험치, 사냥메소, 보스메소, 조각개수 (위에서부터)
                      <div className="flex flex-col justify-start space-y-0">
                        {dailyTotal && dailyTotal.total_exp_gained > 0 && (
                          <p className="text-[9px] cal-text-xs font-bold text-green-600 dark:text-green-400 truncate flex items-center gap-0.5 leading-tight">
                            <img src="/images/icons/경험치.png" alt="" className="w-2.5 h-2.5 cal-icon-xs flex-shrink-0" />
                            <span className="truncate">{formatExpShort(character.character_level, dailyTotal.total_exp_gained)}</span>
                          </p>
                        )}
                        {dailyTotal && huntingMeso > 0 && (
                          <p className="text-[9px] cal-text-xs font-bold text-amber-600 dark:text-amber-400 truncate flex items-center gap-0.5 leading-tight">
                            <img src="/images/icons/메소.png" alt="" className="w-2.5 h-2.5 cal-icon-xs flex-shrink-0" />
                            <span className="truncate">{formatMeso(huntingMeso)}</span>
                          </p>
                        )}
                        {dailyBossClears.length > 0 && (
                          <p className="text-[9px] cal-text-xs font-bold text-purple-600 dark:text-purple-400 truncate flex items-center gap-0.5 leading-tight">
                            <img src="/images/icons/주간결정석.png" alt="" className="w-2.5 h-2.5 cal-icon-xs flex-shrink-0" />
                            <span className="truncate">{formatMeso(bossIncome)}</span>
                          </p>
                        )}
                        {dailyTotal && dailyTotal.total_pieces > 0 && (
                          <p className="text-[9px] cal-text-xs font-bold text-violet-600 dark:text-violet-400 truncate flex items-center gap-0.5 leading-tight">
                            <img src="/images/icons/솔에르다조각.png" alt="" className="w-2.5 h-2.5 cal-icon-xs flex-shrink-0" />
                            <span className="truncate">{dailyTotal.total_pieces.toLocaleString()}개</span>
                          </p>
                        )}
                        {dailyItemDrops.length > 0 && (
                          <p className="text-[9px] cal-text-xs font-bold text-pink-600 dark:text-pink-400 truncate flex items-center gap-0.5 leading-tight">
                            <span className="text-[8px] cal-icon-xs flex-shrink-0">🎁</span>
                            <span className="truncate">{formatMeso(itemDropIncome)}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        ) : (
        /* Revenue Chart */
        <RevenueChart
          period={chartPeriod}
          selectedWeek={selectedWeek}
          dailyTotals={dailyTotals}
          bossClears={bossClears}
          itemDropsMap={itemDropsMap}
          yearlyData={yearlyData}
          year={year}
          month={month}
        />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-1 px-4 sticky bottom-0 z-40" style={{ backgroundColor: 'hsl(var(--background))' }}>
        <div className="px-4 xl:px-8 2xl:px-12 flex items-center justify-between text-xs text-muted-foreground">
          <span>made by 규복</span>
          <span>v0.2.0 개발버전</span>
        </div>
      </footer>
    </div>

    {/* Daily Dashboard Dialog */}
    {selectedDate && (
      <DailyDashboardDialog
        open={showDashboardDialog}
        onOpenChange={setShowDashboardDialog}
        date={selectedDate}
        character={character}
        onDataChanged={handleDataChanged}
      />
    )}

    {/* Settings Dialog */}
    <SettingsDialog
      open={showSettingsDialog}
      onOpenChange={setShowSettingsDialog}
      onCharacterChange={onCharacterChange}
    />

    {/* Boss Settings Dialog */}
    <BossSettingsDialog
      open={showBossSettingsDialog}
      onOpenChange={setShowBossSettingsDialog}
      character={character}
    />

    {/* Piece Price Dialog */}
    <PiecePriceDialog
      open={showPiecePriceDialog}
      onOpenChange={setShowPiecePriceDialog}
      onSaved={loadDailyData}
    />

    {/* Equipment Dialog */}
    <EquipmentDialog
      open={showEquipmentDialog}
      onOpenChange={setShowEquipmentDialog}
      character={character}
    />

    {/* Help Dialog */}
    <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            프로그램 안내
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="font-bold text-green-600 dark:text-green-400 mb-2">✅ 안전한 프로그램입니다</p>
            <p className="text-muted-foreground">이 프로그램은 게임 제재 대상이 아닙니다.</p>
          </div>

          <div>
            <p className="font-semibold mb-2">이 프로그램이 하는 것:</p>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• 넥슨 공식 Open API 사용</li>
              <li>• 사용자가 직접 데이터 수동 입력</li>
              <li>• 로컬에 기록 저장</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">이 프로그램이 하지 않는 것:</p>
            <ul className="space-y-1 text-muted-foreground ml-4">
              <li>• 게임 클라이언트 접근 ❌</li>
              <li>• 게임 메모리 읽기/쓰기 ❌</li>
              <li>• 패킷 조작 ❌</li>
              <li>• 자동 사냥/매크로 ❌</li>
              <li>• 게임 파일 수정 ❌</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p>메이플GG, 메이플인벤 캐릭터 조회와 동일한 방식으로</p>
            <p>넥슨이 공개한 API를 사용하는 개인 기록장입니다.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
