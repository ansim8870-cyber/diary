import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Star, ChevronLeft } from "lucide-react";
import type { Character, EquipmentItem, EquipmentResponse } from "@/types";
import { cn } from "@/lib/utils";

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
}

const PART_ORDER = [
  "무기", "보조무기", "엠블렘",
  "모자", "상의", "하의", "신발", "장갑", "망토",
  "어깨장식", "훈장", "포켓 아이템", "뱃지",
  "얼굴장식", "눈장식", "귀고리",
  "반지1", "반지2", "반지3", "반지4",
  "펜던트", "펜던트2", "벨트", "기계 심장",
];

function getPartIndex(part: string): number {
  const idx = PART_ORDER.indexOf(part);
  return idx === -1 ? PART_ORDER.length : idx;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "레어": return "text-blue-500";
    case "에픽": return "text-purple-500";
    case "유니크": return "text-amber-500";
    case "레전드리": return "text-green-500";
    default: return "text-muted-foreground";
  }
}

function getGradeBorderColor(grade: string): string {
  switch (grade) {
    case "레어": return "border-blue-500/40";
    case "에픽": return "border-purple-500/40";
    case "유니크": return "border-amber-500/40";
    case "레전드리": return "border-green-500/40";
    default: return "border-border/50";
  }
}

function getGradeBgColor(grade: string): string {
  switch (grade) {
    case "레어": return "bg-blue-500/5";
    case "에픽": return "bg-purple-500/5";
    case "유니크": return "bg-amber-500/5";
    case "레전드리": return "bg-green-500/5";
    default: return "";
  }
}

function formatStatValue(key: string, value: string): string {
  if (!value || value === "0") return "";
  if (key === "boss_damage" || key === "ignore_monster_armor" || key === "damage" || key === "all_stat") {
    return `${value}%`;
  }
  return value;
}

const STAT_LABELS: Record<string, string> = {
  str: "STR",
  dex: "DEX",
  int: "INT",
  luk: "LUK",
  max_hp: "HP",
  max_mp: "MP",
  attack_power: "공격력",
  magic_power: "마력",
  armor: "방어력",
  speed: "이동속도",
  jump: "점프력",
  boss_damage: "보스 공격력",
  ignore_monster_armor: "방어율 무시",
  all_stat: "올스탯",
  damage: "데미지",
};

export function EquipmentDialog({ open, onOpenChange, character }: EquipmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<EquipmentResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);

  useEffect(() => {
    if (open) {
      loadEquipment();
      setSelectedItem(null);
    }
  }, [open]);

  async function loadEquipment() {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<EquipmentResponse>("get_character_equipment");
      setEquipment(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const sortedItems = equipment?.item_equipment
    ? [...equipment.item_equipment].sort((a, b) => getPartIndex(a.item_equipment_slot) - getPartIndex(b.item_equipment_slot))
    : [];


  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open && selectedItem) {
        setSelectedItem(null);
        return;
      }
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedItem ? (
              <>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {selectedItem.item_name}
                <span className="text-sm font-normal text-muted-foreground">({selectedItem.item_equipment_slot})</span>
              </>
            ) : (
              "장비 정보"
            )}
          </DialogTitle>
          {!selectedItem && (
            <DialogDescription>
              {character.character_name} (Lv.{character.character_level})
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">장비 정보를 불러오는 중...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
            </div>
          )}

          {!loading && !error && equipment && (
            selectedItem ? (
              <ItemDetail item={selectedItem} />
            ) : (
              <div className="space-y-3 px-4">
                {/* Title info */}
                {equipment.title && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                    {equipment.title.title_icon && (
                      <img src={equipment.title.title_icon} alt="" className="w-6 h-6" />
                    )}
                    <span className="text-sm font-semibold">{equipment.title.title_name}</span>
                    <span className="text-xs text-muted-foreground">(칭호)</span>
                  </div>
                )}

                {/* Equipment grid */}
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                  {sortedItems.map((item, idx) => (
                    <EquipmentCard
                      key={`${item.item_equipment_slot}-${idx}`}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {!loading && !error && equipment && sortedItems.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              장착된 장비가 없습니다.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// "STR +9%", "공격력 +11", "스킬 재사용 대기시간 -2초" 등 파싱
function parsePotentialOption(opt: string): { name: string; value: number; suffix: string } | null {
  const match = opt.match(/^(.+)\s+([+-]\d+)(초|%)?\s*$/);
  if (!match) return null;
  return { name: match[1].trim(), value: parseInt(match[2]), suffix: match[3] || "" };
}

// 잠재 + 에디셔널 같은 스탯 합산
function getMergedPotentials(item: EquipmentItem): { name: string; value: number; suffix: string }[] {
  const allOptions = [
    item.potential_option_1,
    item.potential_option_2,
    item.potential_option_3,
    item.additional_potential_option_1,
    item.additional_potential_option_2,
    item.additional_potential_option_3,
  ].filter((v): v is string => !!v && v.trim() !== "");

  const map = new Map<string, { value: number; suffix: string }>();
  const order: string[] = [];

  for (const opt of allOptions) {
    const parsed = parsePotentialOption(opt);
    if (!parsed) {
      const key = `__raw__${opt}`;
      if (!map.has(key)) {
        order.push(key);
        map.set(key, { value: 0, suffix: "" });
      }
      continue;
    }
    const existing = map.get(parsed.name);
    if (existing) {
      existing.value += parsed.value;
    } else {
      order.push(parsed.name);
      map.set(parsed.name, { value: parsed.value, suffix: parsed.suffix });
    }
  }

  return order.map((name) => {
    const entry = map.get(name)!;
    if (name.startsWith("__raw__")) {
      return { name: name.replace("__raw__", ""), value: 0, suffix: "" };
    }
    return { name, value: entry.value, suffix: entry.suffix };
  });
}

function EquipmentCard({ item, onClick }: { item: EquipmentItem; onClick: () => void }) {
  const starforce = parseInt(item.starforce) || 0;
  const grade = item.potential_option_grade;
  const addGrade = item.additional_potential_option_grade;
  const merged = getMergedPotentials(item);

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-lg border text-left transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer",
        getGradeBorderColor(grade),
        getGradeBgColor(grade),
        "hover:ring-1 hover:ring-primary/40"
      )}
    >
      <div className="flex items-center gap-1.5">
        <img
          src={item.item_icon}
          alt={item.item_name}
          className="w-8 h-8 object-contain flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-muted-foreground font-medium truncate leading-tight">
            {item.item_equipment_slot}
            {grade && <span className={cn("ml-1 font-bold", getGradeColor(grade))}>{grade}</span>}
            {addGrade && <span className={cn("ml-0.5 font-bold", getGradeColor(addGrade))}> / {addGrade}</span>}
          </p>
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-bold truncate leading-tight">{item.item_name}</p>
            {starforce > 0 && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-[9px] font-bold text-amber-500">{starforce}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 잠재 + 에디 합산 옵션 */}
      {merged.length > 0 && (
        <div className="mt-1 pt-1 border-t border-border/30">
          {merged.map((opt, i) => (
            <p key={i} className="text-[9px] text-muted-foreground truncate leading-tight">
              {opt.value !== 0
                ? `${opt.name} ${opt.value > 0 ? "+" : ""}${opt.value}${opt.suffix}`
                : opt.name}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

function ItemDetail({ item }: { item: EquipmentItem }) {
  const starforce = parseInt(item.starforce) || 0;
  const scrollUpgrade = parseInt(item.scroll_upgrade) || 0;
  const grade = item.potential_option_grade;
  const addGrade = item.additional_potential_option_grade;

  const totalOption = item.item_total_option;

  // Collect non-zero stats
  const statEntries = totalOption
    ? Object.entries(totalOption)
        .filter(([key, val]) => val && val !== "0" && STAT_LABELS[key])
        .map(([key, val]) => ({ label: STAT_LABELS[key], value: formatStatValue(key, val) }))
    : [];

  return (
    <div className="space-y-4">
      {/* Item header */}
      <div className={cn("p-4 rounded-lg border", getGradeBorderColor(grade), getGradeBgColor(grade))}>
        <div className="flex items-start gap-4">
          <img
            src={item.item_icon}
            alt={item.item_name}
            className="w-16 h-16 object-contain flex-shrink-0"
          />
          <div>
            {starforce > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-bold text-amber-500">{starforce}성</span>
              </div>
            )}
            {scrollUpgrade > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                업그레이드 횟수: {scrollUpgrade}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Stats */}
        {statEntries.length > 0 && (
          <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
            <h4 className="text-xs font-bold text-muted-foreground mb-2">총 옵션</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {statEntries.map((stat) => (
                <div key={stat.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="font-semibold">+{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Potential */}
        <div className="space-y-2">
          {grade && (
            <div className={cn("p-3 rounded-lg border", getGradeBorderColor(grade), getGradeBgColor(grade))}>
              <h4 className={cn("text-xs font-bold mb-1.5", getGradeColor(grade))}>
                잠재능력 ({grade})
              </h4>
              <div className="space-y-0.5">
                {item.potential_option_1 && <p className="text-xs">{item.potential_option_1}</p>}
                {item.potential_option_2 && <p className="text-xs">{item.potential_option_2}</p>}
                {item.potential_option_3 && <p className="text-xs">{item.potential_option_3}</p>}
              </div>
            </div>
          )}

          {addGrade && (
            <div className={cn("p-3 rounded-lg border", getGradeBorderColor(addGrade), getGradeBgColor(addGrade))}>
              <h4 className={cn("text-xs font-bold mb-1.5", getGradeColor(addGrade))}>
                에디셔널 잠재능력 ({addGrade})
              </h4>
              <div className="space-y-0.5">
                {item.additional_potential_option_1 && <p className="text-xs">{item.additional_potential_option_1}</p>}
                {item.additional_potential_option_2 && <p className="text-xs">{item.additional_potential_option_2}</p>}
                {item.additional_potential_option_3 && <p className="text-xs">{item.additional_potential_option_3}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Soul */}
      {item.soul_name && (
        <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
          <h4 className="text-xs font-bold text-muted-foreground mb-1">소울</h4>
          <p className="text-sm font-semibold">{item.soul_name}</p>
          {item.soul_option && <p className="text-xs text-muted-foreground">{item.soul_option}</p>}
        </div>
      )}
    </div>
  );
}
