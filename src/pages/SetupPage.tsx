import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KeyRound, Loader2, Search, ArrowLeft, Globe } from "lucide-react";
import type { Settings, Character, CharacterListItem } from "@/types";

interface SetupPageProps {
  existingApiKey?: string;
  onComplete: (settings: Settings, character: Character) => void;
}

type Step = "api-key" | "server" | "character";

export function SetupPage({ existingApiKey, onComplete }: SetupPageProps) {
  const [step, setStep] = useState<Step>(existingApiKey ? "server" : "api-key");
  const [apiKey, setApiKey] = useState(existingApiKey || "");
  const [allCharacters, setAllCharacters] = useState<CharacterListItem[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  // 캐릭터가 있는 서버 목록 추출
  const servers = useMemo(() => {
    const serverMap = new Map<string, number>();
    for (const char of allCharacters) {
      serverMap.set(char.world_name, (serverMap.get(char.world_name) || 0) + 1);
    }
    return Array.from(serverMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allCharacters]);

  // 선택된 서버의 캐릭터 목록 (레벨 내림차순, 검색 필터링)
  const filteredCharacters = useMemo(() => {
    if (!selectedServer) return [];
    return allCharacters
      .filter(
        (c) =>
          c.world_name === selectedServer &&
          (searchQuery === "" ||
            c.character_name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.character_level - a.character_level);
  }, [allCharacters, selectedServer, searchQuery]);

  async function handleApiKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("API Key를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await invoke("save_api_key", { apiKey: apiKey.trim() });
      await loadCharacterList(apiKey.trim());
    } catch (err) {
      setError(`API Key 저장 실패: ${err}`);
      setIsLoading(false);
    }
  }

  async function loadCharacterList(key?: string) {
    setIsLoading(true);
    setError("");
    try {
      const characters = await invoke<CharacterListItem[]>(
        "get_character_list",
        key ? { apiKey: key } : {}
      );
      setAllCharacters(characters);
      setStep("server");
    } catch (err) {
      setError(`캐릭터 목록 조회 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleServerSelect(serverName: string) {
    setSelectedServer(serverName);
    setSearchQuery("");
    setStep("character");
  }

  async function handleCharacterSelect(char: CharacterListItem) {
    setIsRegistering(true);
    setError("");

    try {
      // /character/basic API로 이미지 등 전체 정보 취득
      const fullInfo = await invoke<{
        ocid: string;
        character_name: string;
        character_image: string;
        world_name: string;
        character_class: string;
        character_level: number;
        character_exp_rate: string;
      }>("search_character", {
        characterName: char.character_name,
      });

      const character = await invoke<Character>("register_character", {
        input: {
          ocid: fullInfo.ocid,
          character_name: fullInfo.character_name,
          character_image: fullInfo.character_image,
          world_name: fullInfo.world_name,
          character_class: fullInfo.character_class,
          character_level: fullInfo.character_level,
          character_exp_rate: fullInfo.character_exp_rate,
        },
      });

      const settings = await invoke<Settings>("get_settings");
      if (settings && character) {
        onComplete(settings, character);
      }
    } catch (err) {
      setError(`캐릭터 등록 실패: ${err}`);
    } finally {
      setIsRegistering(false);
    }
  }

  // 초기 로드: API Key가 이미 있으면 캐릭터 목록 자동 조회
  useEffect(() => {
    if (existingApiKey) {
      loadCharacterList();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl rounded-xl border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg">
            {step === "api-key" ? (
              <KeyRound className="h-7 w-7 text-white" />
            ) : (
              <Globe className="h-7 w-7 text-white" />
            )}
          </div>
          <CardTitle className="text-xl font-bold">
            {step === "api-key"
              ? "API Key 설정"
              : step === "server"
                ? "서버 선택"
                : "캐릭터 선택"}
          </CardTitle>
          <CardDescription>
            {step === "api-key"
              ? "Nexon Open API Key를 입력해주세요"
              : step === "server"
                ? "캐릭터가 있는 서버를 선택해주세요"
                : `${selectedServer} 서버의 캐릭터를 선택해주세요`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <p className="text-sm text-destructive font-medium p-3 rounded-lg bg-destructive/10 mb-4">
              {error}
            </p>
          )}

          {step === "api-key" && (
            <form onSubmit={handleApiKeySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">Nexon API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="API Key를 입력하세요"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isLoading}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  <a
                    href="https://openapi.nexon.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Nexon Open API
                  </a>
                  에서 발급받을 수 있습니다.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    캐릭터 목록 조회 중...
                  </>
                ) : (
                  "다음"
                )}
              </Button>
            </form>
          )}

          {step === "server" && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    캐릭터 목록을 불러오는 중...
                  </p>
                </div>
              ) : servers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    캐릭터를 찾을 수 없습니다
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {servers.map((server) => (
                    <Button
                      key={server.name}
                      variant="outline"
                      className="h-auto py-3 px-2 flex flex-col gap-1 rounded-xl border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      onClick={() => handleServerSelect(server.name)}
                    >
                      <span className="font-semibold text-sm">
                        {server.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {server.count}캐릭터
                      </span>
                    </Button>
                  ))}
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => setStep("api-key")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                API Key 변경
              </Button>
            </div>
          )}

          {step === "character" && (
            <div className="space-y-4">
              {/* 검색바 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="캐릭터 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>

              {/* 캐릭터 목록 */}
              <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
                {filteredCharacters.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {searchQuery
                      ? "검색 결과가 없습니다"
                      : "캐릭터가 없습니다"}
                  </p>
                ) : (
                  filteredCharacters.map((char) => (
                    <button
                      key={char.ocid}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                      onClick={() => handleCharacterSelect(char)}
                      disabled={isRegistering}
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                        {char.character_level}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {char.character_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Lv.{char.character_level} · {char.character_class}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {isRegistering && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    캐릭터 정보를 가져오는 중...
                  </span>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => {
                  setStep("server");
                  setSelectedServer(null);
                  setSearchQuery("");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                서버 선택으로 돌아가기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
