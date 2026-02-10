import { useState, useEffect } from "react";
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
  Skull,
} from "lucide-react";
import type { Character, DailyTotal } from "@/types";
import { DailyDashboardDialog } from "@/components/DailyDashboardDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { BossSettingsDialog } from "@/components/BossSettingsDialog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

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
  const [dailyTotals, setDailyTotals] = useState<Map<string, DailyTotal>>(
    new Map()
  );
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showBossSettingsDialog, setShowBossSettingsDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadDailyTotals();
  }, [year, month]);

  async function loadDailyTotals() {
    try {
      const totals = await invoke<DailyTotal[]>("get_daily_totals", {
        year,
        month: month + 1,
      });

      const totalsMap = new Map<string, DailyTotal>();
      totals.forEach((total) => {
        totalsMap.set(total.date, total);
      });
      setDailyTotals(totalsMap);
    } catch (error) {
      console.error("Failed to load daily totals:", error);
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
    loadDailyTotals();
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

  const calendarDays = getCalendarDays();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={character.character_image}
              alt={character.character_name}
              className="h-12 w-12 rounded-lg bg-muted object-contain"
            />
            <div>
              <div className="flex items-center gap-1">
                <h1 className="font-semibold">{character.character_name}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRefreshCharacter}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {character.world_name} · Lv.{character.character_level}
                {character.character_exp_rate && (
                  <span className="text-primary"> ({character.character_exp_rate}%)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowBossSettingsDialog(true)}>
              <Skull className="h-4 w-4" />
              <span className="text-sm">보스 설정</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-bold">
            {year}년 {month + 1}월
          </h2>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <Card className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "text-center text-sm font-medium py-2",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-24" />;
              }

              const dateStr = formatDate(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dailyTotal = dailyTotals.get(dateStr);
              const dayOfWeek = (index % 7);

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    "h-24 p-2 rounded-lg border text-left transition-colors hover:bg-accent",
                    isToday && "border-primary",
                    isSelected && "bg-accent ring-2 ring-primary",
                    !isToday && !isSelected && "border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      dayOfWeek === 0 && "text-red-500",
                      dayOfWeek === 6 && "text-blue-500",
                      isToday && "text-primary font-bold"
                    )}
                  >
                    {day}
                  </span>

                  {dailyTotal && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-orange-600 dark:text-orange-400 truncate">
                        {dailyTotal.total_sojaebi.toFixed(1)} 소재비
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        +{dailyTotal.total_exp_gained.toFixed(2)}%
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </main>

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
    </div>
  );
}
