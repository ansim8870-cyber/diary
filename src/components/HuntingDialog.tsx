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
  durationMinutes: number;
  memo: string;
}

const defaultFormData: SessionFormData = {
  startLevel: 0,
  endLevel: 0,
  startExpPercent: 0,
  endExpPercent: 0,
  startMeso: 0,
  endMeso: 0,
  durationMinutes: 30,
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
          duration_minutes: newSession.durationMinutes,
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

  function calculateGains(session: SessionFormData | HuntingSession) {
    const levelDiff = ('endLevel' in session ? session.endLevel : session.end_level) -
                      ('startLevel' in session ? session.startLevel : session.start_level);
    const expStart = 'startExpPercent' in session ? session.startExpPercent : session.start_exp_percent;
    const expEnd = 'endExpPercent' in session ? session.endExpPercent : session.end_exp_percent;
    const expGain = (levelDiff * 100) + (expEnd - expStart);

    const mesoStart = 'startMeso' in session ? session.startMeso : session.start_meso;
    const mesoEnd = 'endMeso' in session ? session.endMeso : session.end_meso;
    const mesoGain = mesoEnd - mesoStart;

    const duration = 'durationMinutes' in session ? session.durationMinutes : session.duration_minutes;
    const sojaebi = duration / 30;

    return { expGain, mesoGain, sojaebi };
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

                <div className="space-y-2">
                  <Label>사냥 시간 (분)</Label>
                  <Input
                    type="number"
                    value={newSession.durationMinutes || ""}
                    onChange={(e) =>
                      setNewSession({
                        ...newSession,
                        durationMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    = {(newSession.durationMinutes / 30).toFixed(1)} 소재비
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
                {(newSession.startLevel > 0 || newSession.startExpPercent > 0) && (
                  <div className="p-3 rounded-lg bg-muted/50">
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
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
