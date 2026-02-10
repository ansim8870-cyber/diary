import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skull, Users, Coins, Pencil, Check, X } from "lucide-react";
import type { Character, BossSetting } from "@/types";
import {
  bossData,
  difficultyLabels,
  formatMeso,
  type Boss,
  type Difficulty,
} from "@/data/bossData";
import { cn } from "@/lib/utils";

interface BossSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character;
}

interface SelectedBoss {
  bossId: string;
  difficulty: Difficulty;
  partySize: number;
  price: number;
}

export function BossSettingsDialog({
  open,
  onOpenChange,
  character,
}: BossSettingsDialogProps) {
  // bossId를 키로 사용 (한 보스당 하나의 난이도만 선택)
  const [selectedBosses, setSelectedBosses] = useState<Map<string, SelectedBoss>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  // 가격 수정 관련 상태 (bossId-difficulty를 키로 사용)
  const [customPrices, setCustomPrices] = useState<Map<string, number>>(new Map());
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  // 저장된 보스 설정 불러오기
  useEffect(() => {
    if (open && character.id) {
      loadBossSettings();
    }
  }, [open, character.id]);

  async function loadBossSettings() {
    try {
      const settings = await invoke<BossSetting[]>("get_boss_settings", {
        characterId: character.id,
      });

      const newSelected = new Map<string, SelectedBoss>();
      settings.forEach((setting) => {
        const boss = bossData.find((b) => b.id === setting.boss_id);
        const difficultyData = boss?.difficulties.find(
          (d) => d.difficulty === setting.difficulty
        );

        if (boss && difficultyData && setting.enabled) {
          newSelected.set(setting.boss_id, {
            bossId: setting.boss_id,
            difficulty: setting.difficulty as Difficulty,
            partySize: setting.party_size,
            price: difficultyData.price,
          });
        }
      });
      setSelectedBosses(newSelected);
    } catch (error) {
      console.error("Failed to load boss settings:", error);
    }
  }

  function getPriceKey(bossId: string, difficulty: Difficulty): string {
    return `${bossId}-${difficulty}`;
  }

  // 보스 선택/해제 토글
  function handleToggleBoss(boss: Boss) {
    const newSelected = new Map(selectedBosses);

    if (newSelected.has(boss.id)) {
      newSelected.delete(boss.id);
    } else {
      // 첫 번째 난이도(가장 어려운 것)를 기본으로 선택
      const firstDiff = boss.difficulties[0];
      const actualPrice = getPrice(boss.id, firstDiff.difficulty, firstDiff.price);
      newSelected.set(boss.id, {
        bossId: boss.id,
        difficulty: firstDiff.difficulty,
        partySize: 1,
        price: actualPrice,
      });
    }
    setSelectedBosses(newSelected);
  }

  // 난이도 변경
  function handleDifficultyChange(boss: Boss, difficulty: Difficulty) {
    const existing = selectedBosses.get(boss.id);
    if (existing) {
      const diffData = boss.difficulties.find((d) => d.difficulty === difficulty);
      if (diffData) {
        const actualPrice = getPrice(boss.id, difficulty, diffData.price);
        const newSelected = new Map(selectedBosses);
        newSelected.set(boss.id, {
          ...existing,
          difficulty,
          price: actualPrice,
        });
        setSelectedBosses(newSelected);
      }
    }
  }

  // 파티 인원 변경
  function handlePartyChange(bossId: string, partySize: number) {
    const existing = selectedBosses.get(bossId);
    if (existing) {
      const newSelected = new Map(selectedBosses);
      newSelected.set(bossId, { ...existing, partySize });
      setSelectedBosses(newSelected);
    }
  }

  // 현재 가격 가져오기 (커스텀 가격 우선)
  function getPrice(bossId: string, difficulty: Difficulty, defaultPrice: number): number {
    const key = getPriceKey(bossId, difficulty);
    return customPrices.get(key) ?? defaultPrice;
  }

  // 가격 수정 시작
  function handleEditPrice(bossId: string, difficulty: Difficulty, currentPrice: number) {
    const key = getPriceKey(bossId, difficulty);
    setEditingPrice(key);
    // 전체 금액으로 표시
    setEditPriceValue(String(currentPrice));
  }

  // 가격 수정 저장
  function handleSavePrice(bossId: string, difficulty: Difficulty) {
    const key = getPriceKey(bossId, difficulty);
    const value = parseInt(editPriceValue);
    if (!isNaN(value) && value >= 0) {
      const newCustomPrices = new Map(customPrices);
      newCustomPrices.set(key, value);
      setCustomPrices(newCustomPrices);

      // 선택된 보스의 가격도 업데이트
      const existing = selectedBosses.get(bossId);
      if (existing && existing.difficulty === difficulty) {
        const newSelected = new Map(selectedBosses);
        newSelected.set(bossId, { ...existing, price: value });
        setSelectedBosses(newSelected);
      }
    }
    setEditingPrice(null);
    setEditPriceValue("");
  }

  // 가격 수정 취소
  function handleCancelPrice() {
    setEditingPrice(null);
    setEditPriceValue("");
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // 기존 설정 삭제
      const existingSettings = await invoke<BossSetting[]>("get_boss_settings", {
        characterId: character.id,
      });

      for (const setting of existingSettings) {
        await invoke("delete_boss_setting", {
          characterId: character.id,
          bossId: setting.boss_id,
          difficulty: setting.difficulty,
        });
      }

      // 새 설정 저장
      for (const [, selected] of selectedBosses) {
        await invoke("save_boss_setting", {
          input: {
            character_id: character.id,
            boss_id: selected.bossId,
            difficulty: selected.difficulty,
            party_size: selected.partySize,
            enabled: true,
          },
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save boss settings:", error);
    } finally {
      setIsSaving(false);
    }
  }

  // 예상 수익 계산
  const weeklyIncome = useMemo(() => {
    let total = 0;
    let weeklyCount = 0;

    for (const [, selected] of selectedBosses) {
      const boss = bossData.find((b) => b.id === selected.bossId);
      if (!boss?.isMonthly) {
        weeklyCount++;
      }
      // 파티 인원수로 나눈 개인 수익
      total += Math.floor(selected.price / selected.partySize);
    }

    return { total, weeklyCount };
  }, [selectedBosses]);

  function renderBossRow(boss: Boss) {
    const isSelected = selectedBosses.has(boss.id);
    const selectedData = selectedBosses.get(boss.id);
    const currentDifficulty = selectedData?.difficulty || boss.difficulties[0].difficulty;
    const currentDiffData = boss.difficulties.find((d) => d.difficulty === currentDifficulty)!;
    const currentPrice = getPrice(boss.id, currentDifficulty, currentDiffData.price);
    const priceKey = getPriceKey(boss.id, currentDifficulty);
    const isEditing = editingPrice === priceKey;

    return (
      <div
        key={boss.id}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg transition-colors",
          isSelected ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50",
          boss.isMonthly && "border border-amber-500/30"
        )}
      >
        {/* 체크박스 */}
        <Checkbox
          id={boss.id}
          checked={isSelected}
          onCheckedChange={() => handleToggleBoss(boss)}
        />

        {/* 보스 이름 */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Skull className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <label htmlFor={boss.id} className="font-medium cursor-pointer text-sm">
            {boss.name}
          </label>
          {boss.isMonthly && (
            <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">
              월간
            </span>
          )}
        </div>

        {/* 난이도 드롭다운 */}
        <Select
          value={currentDifficulty}
          onValueChange={(value) => handleDifficultyChange(boss, value as Difficulty)}
          disabled={!isSelected}
        >
          <SelectTrigger className={cn("w-24 h-8 text-xs", !isSelected && "opacity-50")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {boss.difficulties.map((diff) => (
              <SelectItem key={diff.difficulty} value={diff.difficulty}>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
                    diff.difficulty === "easy" && "bg-green-500/20 text-green-600 dark:text-green-400",
                    diff.difficulty === "normal" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                    diff.difficulty === "hard" && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                    diff.difficulty === "chaos" && "bg-red-500/20 text-red-600 dark:text-red-400",
                    diff.difficulty === "extreme" && "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                  )}
                >
                  {difficultyLabels[diff.difficulty]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 가격 표시 및 수정 */}
        <div className="flex-1 min-w-[160px]">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={editPriceValue}
                onChange={(e) => setEditPriceValue(e.target.value)}
                className="w-32 h-7 text-xs"
                placeholder="메소"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePrice(boss.id, currentDifficulty);
                  if (e.key === "Escape") handleCancelPrice();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleSavePrice(boss.id, currentDifficulty)}
              >
                <Check className="h-3 w-3 text-green-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancelPrice}
              >
                <X className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-sm",
                  customPrices.has(priceKey) ? "text-primary font-medium" : "text-muted-foreground",
                  !isSelected && "opacity-50"
                )}
              >
                {formatMeso(currentPrice)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-50 hover:opacity-100"
                onClick={() => handleEditPrice(boss.id, currentDifficulty, currentPrice)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* 파티 인원 드롭다운 */}
        {isSelected && (
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={String(selectedData?.partySize || 1)}
              onValueChange={(value) => handlePartyChange(boss.id, parseInt(value))}
            >
              <SelectTrigger className="w-16 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: currentDiffData.partySize }, (_, i) => i + 1).map(
                  (size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}인
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5" />
            보스 설정
          </DialogTitle>
        </DialogHeader>

        {/* 예상 수익 요약 */}
        <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              <span className="font-medium">주간 예상 수익</span>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatMeso(weeklyIncome.total)}
              </p>
              <p className="text-xs text-muted-foreground">
                주간 보스 {weeklyIncome.weeklyCount}개 / 12개
                {weeklyIncome.weeklyCount > 12 && (
                  <span className="text-red-500 ml-1">(초과!)</span>
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* 보스 목록 */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {bossData.map(renderBossRow)}
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
