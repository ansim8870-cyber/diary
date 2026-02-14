import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DailyTotalWithPieces, BossClear, ItemDrop } from "@/types";
import { formatMeso } from "@/data/bossData";

interface YearlyMonthData {
  month: number;
  label: string;
  hunting: number;
  pieces: number;
  boss: number;
  itemDrop: number;
  total: number;
}

interface RevenueChartProps {
  period: "weekly" | "monthly" | "yearly";
  selectedWeek: number | null;
  dailyTotals: Map<string, DailyTotalWithPieces>;
  bossClears: Map<string, BossClear[]>;
  itemDropsMap: Map<string, ItemDrop[]>;
  yearlyData: YearlyMonthData[];
  year: number;
  month: number; // 0-indexed
}

interface DayData {
  day: number;
  label: string;
  hunting: number;
  pieces: number;
  boss: number;
  itemDrop: number;
  total: number;
}

interface WeekData {
  week: number;
  label: string;
  startDay: number;
  endDay: number;
  hunting: number;
  pieces: number;
  boss: number;
  itemDrop: number;
  total: number;
}

const COLORS = {
  hunting: "#f59e0b",  // amber-500
  pieces: "#8b5cf6",   // violet-500
  boss: "#a855f7",     // purple-500
  itemDrop: "#ec4899", // pink-500
};

function formatShortMeso(value: number): string {
  const billion = 100000000;
  const tenThousand = 10000;
  if (value >= billion) {
    return `${(value / billion).toFixed(1)}억`;
  } else if (value >= tenThousand) {
    return `${Math.floor(value / tenThousand)}만`;
  }
  return value.toLocaleString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md" style={{ backgroundColor: "hsl(var(--popover))" }}>
      <p className="font-bold text-sm mb-2">{label}</p>
      {payload.map((entry, i) => (
        entry.value > 0 && (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold">{formatMeso(entry.value)}</span>
          </div>
        )
      ))}
      {total > 0 && (
        <div className="border-t mt-1.5 pt-1.5 flex items-center gap-2 text-xs font-bold">
          <span>합계:</span>
          <span className="text-amber-600 dark:text-amber-400">{formatMeso(total)}</span>
        </div>
      )}
    </div>
  );
}

export function RevenueChart({
  period,
  selectedWeek,
  dailyTotals,
  bossClears,
  itemDropsMap,
  yearlyData,
  year,
  month,
}: RevenueChartProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build daily data for the entire month
  const dailyData = useMemo<DayData[]>(() => {
    const data: DayData[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dt = dailyTotals.get(dateStr);
      const bc = bossClears.get(dateStr) || [];
      const drops = itemDropsMap.get(dateStr) || [];

      const hunting = dt?.total_meso_gained ?? 0;
      const pieces = dt ? dt.total_pieces * dt.avg_piece_price : 0;
      const boss = bc.reduce((sum, c) => sum + Math.floor(c.crystal_price / c.party_size), 0);
      const itemDrop = drops.reduce((sum, d) => sum + d.price, 0);

      data.push({
        day,
        label: `${month + 1}/${day}`,
        hunting,
        pieces,
        boss,
        itemDrop,
        total: hunting + pieces + boss + itemDrop,
      });
    }
    return data;
  }, [dailyTotals, bossClears, itemDropsMap, year, month, daysInMonth]);

  // Group into weeks
  const weeklyData = useMemo<WeekData[]>(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const weeks: WeekData[] = [];
    let weekNum = 1;
    let acc = { hunting: 0, pieces: 0, boss: 0, itemDrop: 0 };
    let startDay = 1;

    for (let i = 0; i < dailyData.length; i++) {
      const d = dailyData[i];
      acc.hunting += d.hunting;
      acc.pieces += d.pieces;
      acc.boss += d.boss;
      acc.itemDrop += d.itemDrop;

      const dayOfWeek = (firstDayOfWeek + i) % 7;
      const isLastDay = i === dailyData.length - 1;
      const isSaturday = dayOfWeek === 6;

      if (isSaturday || isLastDay) {
        weeks.push({
          week: weekNum,
          label: `${weekNum}주차`,
          startDay,
          endDay: d.day,
          ...acc,
          total: acc.hunting + acc.pieces + acc.boss + acc.itemDrop,
        });
        weekNum++;
        startDay = d.day + 1;
        acc = { hunting: 0, pieces: 0, boss: 0, itemDrop: 0 };
      }
    }
    return weeks;
  }, [dailyData, year, month]);

  // 주간 모드에서 선택된 주차의 일별 데이터
  const weekDailyData = useMemo<DayData[]>(() => {
    if (selectedWeek === null) return [];
    const week = weeklyData.find(w => w.week === selectedWeek);
    if (!week) return [];
    return dailyData.filter(d => d.day >= week.startDay && d.day <= week.endDay);
  }, [selectedWeek, weeklyData, dailyData]);

  // Summary: 선택 범위에 따라 계산
  const summary = useMemo(() => {
    const source = period === "yearly"
      ? yearlyData
      : period === "weekly" && selectedWeek !== null
        ? weekDailyData
        : dailyData;
    const s = { hunting: 0, pieces: 0, boss: 0, itemDrop: 0 };
    source.forEach((d) => {
      s.hunting += d.hunting;
      s.pieces += d.pieces;
      s.boss += d.boss;
      s.itemDrop += d.itemDrop;
    });
    const total = s.hunting + s.pieces + s.boss + s.itemDrop;
    const countWithData = source.filter((d) => d.total > 0).length;
    const avg = countWithData > 0 ? Math.floor(total / countWithData) : 0;
    return { ...s, total, countWithData, avg };
  }, [dailyData, weekDailyData, yearlyData, period, selectedWeek]);

  // 차트 데이터 결정
  const chartData = period === "yearly"
    ? yearlyData
    : period === "weekly"
      ? (selectedWeek !== null ? weekDailyData : weeklyData)
      : dailyData;

  return (
    <Card className="p-4 xl:p-6 shadow-lg">
      {/* Chart */}
      <div className="h-[calc(100vh-440px)] min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={period === "monthly" ? "preserveStartEnd" : 0}
            />
            <YAxis
              tickFormatter={formatShortMeso}
              tick={{ fontSize: 11 }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) => <span className="text-xs font-semibold">{value}</span>}
            />
            <Bar dataKey="hunting" stackId="a" fill={COLORS.hunting} name="사냥 메소" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pieces" stackId="a" fill={COLORS.pieces} name="솔 에르다 조각" />
            <Bar dataKey="boss" stackId="a" fill={COLORS.boss} name="결정석" />
            <Bar dataKey="itemDrop" stackId="a" fill={COLORS.itemDrop} name="득템" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <SummaryCard
          label="사냥 메소"
          value={summary.hunting}
          color="amber"
          icon="/images/icons/메소.png"
        />
        <SummaryCard
          label="솔 에르다 조각"
          value={summary.pieces}
          color="violet"
          icon="/images/icons/솔에르다조각.png"
        />
        <SummaryCard
          label="결정석"
          value={summary.boss}
          color="purple"
          icon="/images/icons/주간결정석.png"
        />
        <SummaryCard
          label="득템"
          value={summary.itemDrop}
          color="pink"
        />
      </div>

      {/* Total Card */}
      <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/images/icons/메소.png" alt="" className="w-5 h-5" />
            <span className="font-bold text-sm">
              {period === "yearly"
                ? "연간"
                : period === "weekly"
                  ? (selectedWeek !== null ? `${selectedWeek}주차` : "월간")
                  : "월간"
              } 총 수익
            </span>
          </div>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatMeso(summary.total)}
          </span>
        </div>
        {summary.countWithData > 0 && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              데이터 있는 {period === "yearly" ? "월" : "날"}: {summary.countWithData}{period === "yearly" ? "개월" : "일"}
            </span>
            <span className="text-xs text-muted-foreground">
              {period === "yearly" ? "월평균" : "일평균"}: <span className="font-semibold text-foreground">{formatMeso(summary.avg)}</span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "amber" | "violet" | "purple" | "pink";
  icon?: string;
}) {
  const colorClasses = {
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20",
    pink: "text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20",
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon ? (
          <img src={icon} alt="" className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-xs">🎁</span>
        )}
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-bold ${colorClasses[color].split(" ")[0]} ${colorClasses[color].split(" ")[1]}`}>
        {formatMeso(value)}
      </p>
    </div>
  );
}
