import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { SetupPage } from "./pages/SetupPage";
import { MainPage } from "./pages/MainPage";
import { UpdateDialog } from "./components/UpdateDialog";
import type { Settings, Character } from "./types";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [settingsData, characterData] = await Promise.all([
        invoke<Settings | null>("get_settings"),
        invoke<Character | null>("get_character"),
      ]);
      setSettings(settingsData);

      // 캐릭터가 있으면 API에서 최신 정보로 업데이트
      if (characterData && settingsData?.api_key) {
        try {
          const refreshedCharacter = await invoke<Character>("refresh_character");
          setCharacter(refreshedCharacter);
        } catch {
          // 새로고침 실패 시 기존 데이터 사용
          setCharacter(characterData);
        }
      } else {
        setCharacter(characterData);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSetupComplete(newSettings: Settings, newCharacter: Character) {
    setSettings(newSettings);
    setCharacter(newCharacter);
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // API Key나 캐릭터가 없으면 Setup 페이지 표시
  if (!settings?.api_key || !character) {
    return (
      <SetupPage
        existingApiKey={settings?.api_key}
        onComplete={handleSetupComplete}
      />
    );
  }

  return (
    <>
      <UpdateDialog />
      <MainPage character={character} onCharacterChange={setCharacter} />
    </>
  );
}

export default App;
