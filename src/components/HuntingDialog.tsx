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
import { Loader2, Save, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { HuntingSession } from "@/types";

interface HuntingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  characterId: number;
  onSaved: () => void;
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
  memo: string;
}

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
  memo: "",
};

export function HuntingDialog({
  open,
  onOpenChange,
  date,
  characterId,
  onSaved,
}: HuntingDialogProps) {
  const [sessions, setSessions] = useState<HuntingSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSession, setNewSession] = useState<SessionFormData>(defaultFormData);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  useEffect(() => {
    if (open && date) {
      loadSessions();
    }
  }, [open, date]);

  async function loadSessions() {
    setIsLoading(true);
    try {
      const data = await invoke<HuntingSession[]>("get_hunting_sessions", {
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
          start_screenshot: null,
          end_screenshot: null,
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
          <DialogTitle>사냥 기록</DialogTitle>
          <DialogDescription>{date.replace(/-/g, ".")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
                    onClick={() =>
                      setExpandedSession(isExpanded ? null : session.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        #{session.session_order}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {session.duration_minutes}분 ({gains.sojaebi.toFixed(1)} 소재비)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        +{gains.expGain.toFixed(2)}%
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-3 border-t">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">레벨:</span>{" "}
                          {session.start_level} → {session.end_level}
                        </div>
                        <div>
                          <span className="text-muted-foreground">경험치:</span>{" "}
                          {session.start_exp_percent.toFixed(2)}% →{" "}
                          {session.end_exp_percent.toFixed(2)}%
                        </div>
                        <div>
                          <span className="text-muted-foreground">메소:</span>{" "}
                          {session.start_meso.toLocaleString()} →{" "}
                          {session.end_meso.toLocaleString()}
                        </div>
                        <div>
                          <span className="text-muted-foreground">획득:</span>{" "}
                          <span className="text-green-600 dark:text-green-400">
                            +{gains.mesoGain.toLocaleString()}
                          </span>
                        </div>
                        {(gains.solErdaGain !== 0 || gains.solErdaPieceGain !== 0) && (
                          <>
                            <div>
                              <span className="text-muted-foreground">솔 에르다:</span>{" "}
                              <span className="text-purple-600 dark:text-purple-400">
                                +{gains.solErdaGain.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">솔 에르다 조각:</span>{" "}
                              <span className="text-purple-600 dark:text-purple-400">
                                +{gains.solErdaPieceGain.toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {session.memo && (
                        <p className="text-sm text-muted-foreground">
                          {session.memo}
                        </p>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* New Session Form */}
            {showNewForm ? (
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <h4 className="font-medium">새 사냥 기록</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>시작 레벨</Label>
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
                    <Label>종료 레벨</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>시작 경험치 (%)</Label>
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
                    <Label>종료 경험치 (%)</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>시작 메소</Label>
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
                    <Label>종료 메소</Label>
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
                <div className="space-y-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <h5 className="text-sm font-medium text-purple-600 dark:text-purple-400">솔 에르다</h5>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>시작 솔 에르다 조각</Label>
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
                    <Label>종료 솔 에르다 조각</Label>
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
                  <Label>소재비</Label>
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

                {/* Preview */}
                {(newSession.startLevel > 0 || newSession.startExpPercent > 0 ||
                  newSession.startSolErda > 0 || newSession.startSolErdaGauge > 0 ||
                  newSession.startSolErdaPiece > 0) && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-sm">
                      예상 획득:{" "}
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +{calculateGains(newSession).expGain.toFixed(2)}% 경험치
                      </span>
                      ,{" "}
                      <span className="font-medium">
                        +{calculateGains(newSession).mesoGain.toLocaleString()} 메소
                      </span>
                    </p>
                    {(calculateGains(newSession).solErdaGain !== 0 ||
                      calculateGains(newSession).solErdaPieceGain !== 0) && (
                      <p className="text-sm">
                        <span className="font-medium text-purple-600 dark:text-purple-400">
                          +{calculateGains(newSession).solErdaGain.toFixed(2)} 솔 에르다
                        </span>
                        ,{" "}
                        <span className="font-medium text-purple-600 dark:text-purple-400">
                          +{calculateGains(newSession).solErdaPieceGain.toLocaleString()} 솔 에르다 조각
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveNewSession}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    저장
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewForm(false);
                      setNewSession(defaultFormData);
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                사냥 기록 추가
              </Button>
            )}

            {/* Total Summary */}
            {sessions.length > 0 && (
              <div className="rounded-lg border bg-primary/5 p-4">
                <h4 className="font-medium mb-2">일일 합계</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">총 경험치:</span>{" "}
                    <span className="font-medium text-green-600 dark:text-green-400">
                      +
                      {sessions
                        .reduce((sum, s) => sum + s.exp_gained, 0)
                        .toFixed(2)}
                      %
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">총 메소:</span>{" "}
                    <span className="font-medium">
                      +
                      {sessions
                        .reduce((sum, s) => sum + s.meso_gained, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">총 소재비:</span>{" "}
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {sessions.reduce((sum, s) => sum + s.sojaebi, 0).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">사냥 횟수:</span>{" "}
                    <span className="font-medium">{sessions.length}회</span>
                  </div>
                  {sessions.reduce((sum, s) => sum + s.sol_erda_gained, 0) !== 0 && (
                    <div>
                      <span className="text-muted-foreground">총 솔 에르다:</span>{" "}
                      <span className="font-medium text-purple-600 dark:text-purple-400">
                        +{sessions.reduce((sum, s) => sum + s.sol_erda_gained, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {sessions.reduce((sum, s) => sum + s.sol_erda_piece_gained, 0) !== 0 && (
                    <div>
                      <span className="text-muted-foreground">총 솔 에르다 조각:</span>{" "}
                      <span className="font-medium text-purple-600 dark:text-purple-400">
                        +{sessions.reduce((sum, s) => sum + s.sol_erda_piece_gained, 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
