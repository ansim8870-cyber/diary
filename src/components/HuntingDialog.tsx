import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Plus, Trash2, ChevronDown, ChevronUp, Sword, Pencil, Sparkles } from "lucide-react";
import type { HuntingSession, AppSettings, HuntingOcrResult } from "@/types";
import { formatMeso } from "@/data/bossData";
import { formatExpWithPercent } from "@/data/expTable";

interface HuntingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  characterId: number;
  characterLevel: number;
  onSaved: () => void;
  ocrResult?: HuntingOcrResult | null;
  screenshotPaths?: { start: string; end: string } | null;
}

interface SessionFormData {
  startLevel: number;
  endLevel: number;
  startExpPercent: number;
  endExpPercent: number;
  startMeso: number;
  endMeso: number;
  sojaebi: number;
  // 솔 에르다
  startSolErda: number;
  endSolErda: number;
  startSolErdaGauge: number;
  endSolErdaGauge: number;
  // 솔 에르다 조각
  startSolErdaPiece: number;
  endSolErdaPiece: number;
  solErdaPiecePrice: number; // 조각 가격
  memo: string;
}

const DEFAULT_PIECE_PRICE = 6500000; // 기본 650만 메소

const defaultFormData: SessionFormData = {
  startLevel: 0,
  endLevel: 0,
  startExpPercent: 0,
  endExpPercent: 0,
  startMeso: 0,
  endMeso: 0,
  sojaebi: 1,
  startSolErda: 0,
  endSolErda: 0,
  startSolErdaGauge: 0,
  endSolErdaGauge: 0,
  startSolErdaPiece: 0,
  endSolErdaPiece: 0,
  solErdaPiecePrice: DEFAULT_PIECE_PRICE,
  memo: "",
};

export function HuntingDialog({
  open,
  onOpenChange,
  date,
  characterId,
  characterLevel,
  onSaved,
  ocrResult,
  screenshotPaths,
}: HuntingDialogProps) {
  const [sessions, setSessions] = useState<HuntingSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSession, setNewSession] = useState<SessionFormData>(defaultFormData);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [editingSession, setEditingSession] = useState<HuntingSession | null>(null);
  const [isOcrApplied, setIsOcrApplied] = useState(false);

  useEffect(() => {
    if (open && date) {
      loadSessions();
      // OCR 결과가 없을 때만 기본 설정 로드 (OCR 결과가 있으면 아래 useEffect에서 처리)
      if (!ocrResult) {
        loadDefaultSettings();
      }
    }
  }, [open, date]);

  // OCR 결과가 있으면 폼에 자동 적용
  useEffect(() => {
    console.log("[HuntingDialog] OCR useEffect - open:", open, "ocrResult:", ocrResult, "isOcrApplied:", isOcrApplied);
    if (open && ocrResult && !isOcrApplied) {
      console.log("[HuntingDialog] ========== OCR 결과 적용 시작 ==========");
      console.log("[HuntingDialog] 레벨:", ocrResult.start_level, "->", ocrResult.end_level);
      console.log("[HuntingDialog] 경험치:", ocrResult.start_exp_percent, "->", ocrResult.end_exp_percent);
      console.log("[HuntingDialog] 메소:", ocrResult.start_meso, "->", ocrResult.end_meso);
      console.log("[HuntingDialog] 솔 에르다:", ocrResult.start_sol_erda, "개", ocrResult.start_sol_erda_gauge, "게이지 ->", ocrResult.end_sol_erda, "개", ocrResult.end_sol_erda_gauge, "게이지");
      console.log("[HuntingDialog] 솔 에르다 조각:", ocrResult.start_sol_erda_piece, "->", ocrResult.end_sol_erda_piece);

      // OCR 결과 적용 시 조각 가격만 기본 설정에서 가져옴
      invoke<AppSettings>("get_app_settings").then((appSettings) => {
        console.log("[HuntingDialog] AppSettings 로드 완료, 폼 데이터 설정 중...");
        const newData = {
          // 0도 유효한 값이므로 ?? 사용 (null/undefined만 대체)
          startLevel: ocrResult.start_level ?? characterLevel,
          endLevel: ocrResult.end_level ?? characterLevel,
          startExpPercent: ocrResult.start_exp_percent ?? 0,
          endExpPercent: ocrResult.end_exp_percent ?? 0,
          startMeso: ocrResult.start_meso ?? 0,
          endMeso: ocrResult.end_meso ?? 0,
          sojaebi: 1,
          startSolErda: ocrResult.start_sol_erda ?? 0,
          endSolErda: ocrResult.end_sol_erda ?? 0,
          startSolErdaGauge: ocrResult.start_sol_erda_gauge ?? 0,
          endSolErdaGauge: ocrResult.end_sol_erda_gauge ?? 0,
          startSolErdaPiece: ocrResult.start_sol_erda_piece ?? 0,
          endSolErdaPiece: ocrResult.end_sol_erda_piece ?? 0,
          solErdaPiecePrice: appSettings.sol_erda_piece_price,
          memo: "",
        };
        console.log("[HuntingDialog] 적용할 폼 데이터:", newData);
        setNewSession(newData);
      }).catch((error) => {
        console.error("[HuntingDialog] AppSettings 로드 실패:", error);
        // 설정 로드 실패 시에도 OCR 결과 적용
        const newData = {
          startLevel: ocrResult.start_level ?? characterLevel,
          endLevel: ocrResult.end_level ?? characterLevel,
          startExpPercent: ocrResult.start_exp_percent ?? 0,
          endExpPercent: ocrResult.end_exp_percent ?? 0,
          startMeso: ocrResult.start_meso ?? 0,
          endMeso: ocrResult.end_meso ?? 0,
          sojaebi: 1,
          startSolErda: ocrResult.start_sol_erda ?? 0,
          endSolErda: ocrResult.end_sol_erda ?? 0,
          startSolErdaGauge: ocrResult.start_sol_erda_gauge ?? 0,
          endSolErdaGauge: ocrResult.end_sol_erda_gauge ?? 0,
          startSolErdaPiece: ocrResult.start_sol_erda_piece ?? 0,
          endSolErdaPiece: ocrResult.end_sol_erda_piece ?? 0,
          solErdaPiecePrice: DEFAULT_PIECE_PRICE,
          memo: "",
        };
        console.log("[HuntingDialog] 적용할 폼 데이터 (기본값):", newData);
        setNewSession(newData);
      });
      setShowNewForm(true);
      setIsOcrApplied(true);
    }
  }, [open, ocrResult, isOcrApplied]);

  // 다이얼로그 닫힐 때 OCR 적용 상태 초기화
  useEffect(() => {
    if (!open) {
      setIsOcrApplied(false);
    }
  }, [open]);

  async function loadDefaultSettings() {
    try {
      const appSettings = await invoke<AppSettings>("get_app_settings");
      setNewSession(prev => ({
        ...prev,
        startLevel: characterLevel,
        endLevel: characterLevel,
        solErdaPiecePrice: appSettings.sol_erda_piece_price,
      }));
    } catch (error) {
      console.error("Failed to load app settings:", error);
    }
  }

  async function loadSessions() {
    setIsLoading(true);
    try {
      const data = await invoke<HuntingSession[]>("get_hunting_sessions", {
        characterId,
        date,
      });
      setSessions(data);
      if (data.length === 0) {
        setShowNewForm(true);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveNewSession() {
    setIsSaving(true);
    try {
      // 소재비를 분으로 변환 (1 소재비 = 30분)
      const durationMinutes = Math.round(newSession.sojaebi * 30);
      await invoke("save_hunting_session", {
        input: {
          character_id: characterId,
          date,
          start_level: newSession.startLevel,
          end_level: newSession.endLevel,
          start_exp_percent: newSession.startExpPercent,
          end_exp_percent: newSession.endExpPercent,
          start_meso: newSession.startMeso,
          end_meso: newSession.endMeso,
          duration_minutes: durationMinutes,
          start_sol_erda: newSession.startSolErda,
          end_sol_erda: newSession.endSolErda,
          start_sol_erda_gauge: newSession.startSolErdaGauge,
          end_sol_erda_gauge: newSession.endSolErdaGauge,
          start_sol_erda_piece: newSession.startSolErdaPiece,
          end_sol_erda_piece: newSession.endSolErdaPiece,
          sol_erda_piece_price: newSession.solErdaPiecePrice,
          start_screenshot: screenshotPaths?.start || null,
          end_screenshot: screenshotPaths?.end || null,
          items: "[]",
          memo: newSession.memo || null,
        },
      });
      setNewSession(defaultFormData);
      setShowNewForm(false);
      await loadSessions();
      onSaved();
    } catch (error) {
      console.error("Failed to save session:", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSession(id: number) {
    if (!confirm("이 사냥 기록을 삭제하시겠습니까?")) return;

    try {
      await invoke("delete_hunting_session", { id });
      await loadSessions();
      onSaved();
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }

  function handleEditSession(session: HuntingSession) {
    setEditingSession(session);
    setNewSession({
      startLevel: session.start_level,
      endLevel: session.end_level,
      startExpPercent: session.start_exp_percent,
      endExpPercent: session.end_exp_percent,
      startMeso: session.start_meso,
      endMeso: session.end_meso,
      sojaebi: session.duration_minutes / 30,
      startSolErda: session.start_sol_erda,
      endSolErda: session.end_sol_erda,
      startSolErdaGauge: session.start_sol_erda_gauge,
      endSolErdaGauge: session.end_sol_erda_gauge,
      startSolErdaPiece: session.start_sol_erda_piece,
      endSolErdaPiece: session.end_sol_erda_piece,
      solErdaPiecePrice: session.sol_erda_piece_price,
      memo: session.memo || "",
    });
    setShowNewForm(true);
    setExpandedSession(null);
  }

  async function handleUpdateSession() {
    if (!editingSession) return;
    setIsSaving(true);
    try {
      const durationMinutes = Math.round(newSession.sojaebi * 30);
      const expGained = (newSession.endLevel - newSession.startLevel) * 100 +
                        (newSession.endExpPercent - newSession.startExpPercent);
      const mesoGained = newSession.endMeso - newSession.startMeso;
      const startSolErdaTotal = newSession.startSolErda + newSession.startSolErdaGauge / 1000;
      const endSolErdaTotal = newSession.endSolErda + newSession.endSolErdaGauge / 1000;
      const solErdaGained = endSolErdaTotal - startSolErdaTotal;
      const solErdaPieceGained = newSession.endSolErdaPiece - newSession.startSolErdaPiece;

      await invoke("update_hunting_session", {
        session: {
          id: editingSession.id,
          character_id: characterId,
          date,
          session_order: editingSession.session_order,
          start_level: newSession.startLevel,
          end_level: newSession.endLevel,
          start_exp_percent: newSession.startExpPercent,
          end_exp_percent: newSession.endExpPercent,
          exp_gained: expGained,
          start_meso: newSession.startMeso,
          end_meso: newSession.endMeso,
          meso_gained: mesoGained,
          duration_minutes: durationMinutes,
          sojaebi: newSession.sojaebi,
          start_sol_erda: newSession.startSolErda,
          end_sol_erda: newSession.endSolErda,
          start_sol_erda_gauge: newSession.startSolErdaGauge,
          end_sol_erda_gauge: newSession.endSolErdaGauge,
          sol_erda_gained: solErdaGained,
          start_sol_erda_piece: newSession.startSolErdaPiece,
          end_sol_erda_piece: newSession.endSolErdaPiece,
          sol_erda_piece_gained: solErdaPieceGained,
          sol_erda_piece_price: newSession.solErdaPiecePrice,
          start_screenshot: editingSession.start_screenshot,
          end_screenshot: editingSession.end_screenshot,
          items: editingSession.items,
          memo: newSession.memo || null,
          created_at: editingSession.created_at,
          updated_at: "",
        },
      });
      setNewSession(defaultFormData);
      setShowNewForm(false);
      setEditingSession(null);
      await loadSessions();
      onSaved();
    } catch (error) {
      console.error("Failed to update session:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function isFormData(session: SessionFormData | HuntingSession): session is SessionFormData {
    return 'endLevel' in session;
  }

  function calculateGains(session: SessionFormData | HuntingSession) {
    if (isFormData(session)) {
      // SessionFormData
      const levelDiff = session.endLevel - session.startLevel;
      const expGain = (levelDiff * 100) + (session.endExpPercent - session.startExpPercent);
      const mesoGain = session.endMeso - session.startMeso;
      const sojaebi = session.sojaebi;
      const startTotal = session.startSolErda + session.startSolErdaGauge / 1000;
      const endTotal = session.endSolErda + session.endSolErdaGauge / 1000;
      const solErdaGain = endTotal - startTotal;
      const solErdaPieceGain = session.endSolErdaPiece - session.startSolErdaPiece;
      return { expGain, mesoGain, sojaebi, solErdaGain, solErdaPieceGain };
    } else {
      // HuntingSession
      const levelDiff = session.end_level - session.start_level;
      const expGain = (levelDiff * 100) + (session.end_exp_percent - session.start_exp_percent);
      const mesoGain = session.end_meso - session.start_meso;
      const sojaebi = session.duration_minutes / 30;
      return {
        expGain,
        mesoGain,
        sojaebi,
        solErdaGain: session.sol_erda_gained,
        solErdaPieceGain: session.sol_erda_piece_gained,
      };
    }
  }

  function handleSojaebiChange(delta: number) {
    const newValue = Math.max(1, newSession.sojaebi + delta);
    setNewSession({ ...newSession, sojaebi: newValue });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5 text-primary" />
            사냥 기록
          </DialogTitle>
          <DialogDescription className="font-medium">{date.replace(/-/g, ".")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground font-medium">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing Sessions */}
            {sessions.map((session) => {
              const gains = calculateGains(session);
              const isExpanded = expandedSession === session.id;

              return (
                <div
                  key={session.id}
                  className="rounded-xl border-2 border-border/60 bg-card overflow-hidden transition-all duration-200 hover:border-border"
                >
                  <button
                    className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                    onClick={() =>
                      setExpandedSession(isExpanded ? null : session.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                        #{session.session_order}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">
                        {session.duration_minutes}분 ({gains.sojaebi.toFixed(1)} 소재비)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatExpWithPercent(session.end_level, gains.expGain)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-4 border-t border-border/60">
                      <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground text-xs font-medium">레벨</span>
                          <p className="font-semibold">{session.start_level} → {session.end_level}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground text-xs font-medium">경험치</span>
                          <p className="font-semibold">{session.start_exp_percent.toFixed(2)}% → {session.end_exp_percent.toFixed(2)}%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <span className="text-muted-foreground text-xs font-medium">메소</span>
                          <p className="font-semibold">{session.start_meso.toLocaleString()} → {session.end_meso.toLocaleString()}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-green-500/10">
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">획득 메소</span>
                          <p className="font-bold text-green-600 dark:text-green-400">+{gains.mesoGain.toLocaleString()}</p>
                        </div>
                        {(gains.solErdaGain !== 0 || gains.solErdaPieceGain !== 0) && (
                          <>
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">솔 에르다</span>
                              <p className="font-bold text-purple-600 dark:text-purple-400">+{gains.solErdaGain.toFixed(2)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">솔 에르다 조각</span>
                              <p className="font-bold text-purple-600 dark:text-purple-400">+{gains.solErdaPieceGain.toLocaleString()}</p>
                            </div>
                          </>
                        )}
                      </div>
                      {session.memo && (
                        <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30 italic">
                          "{session.memo}"
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleEditSession(session)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          수정
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* New Session Form */}
            {showNewForm ? (
              <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-5 space-y-5">
                <h4 className="font-bold text-lg flex items-center gap-2">
                  {editingSession ? (
                    <>
                      <Pencil className="h-5 w-5 text-primary" />
                      사냥 기록 수정 (#{editingSession.session_order})
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 text-primary" />
                      새 사냥 기록
                      {ocrResult && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-semibold ml-2">
                          <Sparkles className="h-3 w-3" />
                          OCR 자동입력
                        </span>
                      )}
                    </>
                  )}
                </h4>

                {/* 레벨 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-primary">Lv.</span>
                      시작 레벨
                    </Label>
                    <Input
                      type="number"
                      value={newSession.startLevel || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          startLevel: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-primary">Lv.</span>
                      종료 레벨
                    </Label>
                    <Input
                      type="number"
                      value={newSession.endLevel || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          endLevel: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 경험치 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <img src="/images/icons/경험치.png" alt="" className="w-4 h-4" />
                      시작 경험치 (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newSession.startExpPercent || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          startExpPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <img src="/images/icons/경험치.png" alt="" className="w-4 h-4" />
                      종료 경험치 (%)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newSession.endExpPercent || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          endExpPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 메소 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <img src="/images/icons/메소.png" alt="" className="w-4 h-4" />
                      시작 메소
                    </Label>
                    <Input
                      type="number"
                      value={newSession.startMeso || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          startMeso: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <img src="/images/icons/메소.png" alt="" className="w-4 h-4" />
                      종료 메소
                    </Label>
                    <Input
                      type="number"
                      value={newSession.endMeso || ""}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          endMeso: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 솔 에르다 */}
                <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/30">
                  <h5 className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <img src="/images/icons/솔에르다.png" alt="" className="w-4 h-4" />
                    솔 에르다
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">시작 (개수 / 게이지)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          placeholder="개수"
                          value={newSession.startSolErda || ""}
                          onChange={(e) =>
                            setNewSession({
                              ...newSession,
                              startSolErda: Math.min(20, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-16"
                        />
                        <Input
                          type="number"
                          min="0"
                          max="999"
                          placeholder="게이지"
                          value={newSession.startSolErdaGauge || ""}
                          onChange={(e) =>
                            setNewSession({
                              ...newSession,
                              startSolErdaGauge: Math.min(999, parseInt(e.target.value) || 0),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">종료 (개수 / 게이지)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          placeholder="개수"
                          value={newSession.endSolErda || ""}
                          onChange={(e) =>
                            setNewSession({
                              ...newSession,
                              endSolErda: Math.min(20, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-16"
                        />
                        <Input
                          type="number"
                          min="0"
                          max="999"
                          placeholder="게이지"
                          value={newSession.endSolErdaGauge || ""}
                          onChange={(e) =>
                            setNewSession({
                              ...newSession,
                              endSolErdaGauge: Math.min(999, parseInt(e.target.value) || 0),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 솔 에르다 조각 */}
                <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/30">
                  <h5 className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <img src="/images/icons/솔에르다조각.png" alt="" className="w-4 h-4" />
                    솔 에르다 조각
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">시작</Label>
                      <Input
                        type="number"
                        value={newSession.startSolErdaPiece || ""}
                        onChange={(e) =>
                          setNewSession({
                            ...newSession,
                            startSolErdaPiece: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">종료</Label>
                      <Input
                        type="number"
                        value={newSession.endSolErdaPiece || ""}
                        onChange={(e) =>
                          setNewSession({
                            ...newSession,
                            endSolErdaPiece: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-2">
                      조각 단가
                      <span className="text-muted-foreground">(현재 시세)</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={Math.floor(newSession.solErdaPiecePrice / 10000) || ""}
                        onChange={(e) =>
                          setNewSession({
                            ...newSession,
                            solErdaPiecePrice: (parseInt(e.target.value) || 0) * 10000,
                          })
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        만 메소
                      </span>
                    </div>
                    {newSession.endSolErdaPiece - newSession.startSolErdaPiece > 0 && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        조각 수익: {formatMeso((newSession.endSolErdaPiece - newSession.startSolErdaPiece) * newSession.solErdaPiecePrice)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <img src="/images/icons/재획비.png" alt="" className="w-4 h-4" />
                    소재비
                  </Label>
                  <div className="flex items-center gap-2 w-32">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={newSession.sojaebi}
                      onChange={(e) =>
                        setNewSession({
                          ...newSession,
                          sojaebi: parseInt(e.target.value) || 1,
                        })
                      }
                      className="text-center font-medium"
                    />
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-5 w-6 rounded-b-none border-b-0"
                        onClick={() => handleSojaebiChange(1)}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-5 w-6 rounded-t-none"
                        onClick={() => handleSojaebiChange(-1)}
                        disabled={newSession.sojaebi <= 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    = {newSession.sojaebi * 30}분
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>메모 (선택)</Label>
                  <Input
                    value={newSession.memo}
                    onChange={(e) =>
                      setNewSession({ ...newSession, memo: e.target.value })
                    }
                    placeholder="사냥터, 드롭 등"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={editingSession ? handleUpdateSession : handleSaveNewSession}
                    disabled={isSaving}
                    className="flex-1 h-11 rounded-xl"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {editingSession ? "수정 완료" : "저장"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setShowNewForm(false);
                      setNewSession(defaultFormData);
                      setEditingSession(null);
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/60 hover:bg-primary/5"
                onClick={() => setShowNewForm(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                <span className="font-semibold">사냥 기록 추가</span>
              </Button>
            )}

            {/* Total Summary */}
            {sessions.length > 0 && (
              <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                <h4 className="font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  일일 합계
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">총 경험치</span>
                    <p className="font-bold text-sm text-green-600 dark:text-green-400">
                      {formatExpWithPercent(characterLevel, sessions.reduce((sum, s) => sum + s.exp_gained, 0))}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">총 메소</span>
                    <p className="font-bold text-sm text-amber-600 dark:text-amber-400">
                      +{formatMeso(sessions.reduce((sum, s) => sum + s.meso_gained, 0))}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                      총 소재비 ({sessions.length}회)
                    </span>
                    <p className="font-bold text-sm text-orange-600 dark:text-orange-400">
                      {Math.round(sessions.reduce((sum, s) => sum + s.sojaebi, 0))}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">솔 에르다</span>
                    <p className="font-bold text-sm text-sky-600 dark:text-sky-400">
                      +{sessions.reduce((sum, s) => sum + s.sol_erda_gained, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 col-span-2">
                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">솔 에르다 조각</span>
                    <p className="font-bold text-sm text-violet-600 dark:text-violet-400">
                      +{sessions.reduce((sum, s) => sum + s.sol_erda_piece_gained, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
