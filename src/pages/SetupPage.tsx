import { useState } from "react";
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
import { KeyRound, Search, UserCircle, Loader2 } from "lucide-react";
import type { Settings, Character } from "@/types";

interface SearchResult {
  ocid: string;
  character_name: string;
  character_image: string;
  world_name: string;
  character_class: string;
  character_level: number;
  character_exp_rate: string;
}

interface SetupPageProps {
  existingApiKey?: string;
  onComplete: (settings: Settings, character: Character) => void;
}

export function SetupPage({ existingApiKey, onComplete }: SetupPageProps) {
  const [step, setStep] = useState<"api-key" | "character">(
    existingApiKey ? "character" : "api-key"
  );
  const [apiKey, setApiKey] = useState(existingApiKey || "");
  const [characterName, setCharacterName] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
      setStep("character");
    } catch (err) {
      setError(`API Key 저장 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCharacterSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!characterName.trim()) {
      setError("캐릭터 이름을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSearchResult(null);

    try {
      const result = await invoke<SearchResult>("search_character", {
        characterName: characterName.trim(),
      });
      setSearchResult(result);
    } catch (err) {
      setError(`캐릭터 검색 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCharacterRegister() {
    if (!searchResult) return;

    setIsLoading(true);
    setError("");

    try {
      const character = await invoke<Character>("register_character", {
        input: {
          ocid: searchResult.ocid,
          character_name: searchResult.character_name,
          character_image: searchResult.character_image,
          world_name: searchResult.world_name,
          character_class: searchResult.character_class,
          character_level: searchResult.character_level,
          character_exp_rate: searchResult.character_exp_rate,
        },
      });

      const settings = await invoke<Settings>("get_settings");

      if (settings && character) {
        onComplete(settings, character);
      }
    } catch (err) {
      setError(`캐릭터 등록 실패: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
            {step === "api-key" ? (
              <KeyRound className="h-8 w-8 text-white" />
            ) : (
              <UserCircle className="h-8 w-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "api-key" ? "API Key 설정" : "캐릭터 등록"}
          </CardTitle>
          <CardDescription>
            {step === "api-key"
              ? "Nexon Open API Key를 입력해주세요"
              : "메이플스토리 캐릭터를 검색해주세요"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "api-key" ? (
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

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "다음"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleCharacterSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="characterName">캐릭터 이름</Label>
                  <div className="flex gap-2">
                    <Input
                      id="characterName"
                      placeholder="캐릭터 이름을 입력하세요"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                      disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {searchResult && (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={searchResult.character_image}
                      alt={searchResult.character_name}
                      className="h-24 w-24 rounded-lg bg-muted object-contain"
                    />
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-lg">
                        {searchResult.character_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {searchResult.world_name} · {searchResult.character_class}
                      </p>
                      <p className="text-sm">
                        Lv.{searchResult.character_level}{" "}
                        <span className="text-muted-foreground">
                          ({searchResult.character_exp_rate}%)
                        </span>
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleCharacterRegister}
                    className="w-full mt-4"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        등록 중...
                      </>
                    ) : (
                      "이 캐릭터로 시작하기"
                    )}
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("api-key")}
              >
                API Key 변경
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
