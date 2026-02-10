use crate::api::MapleApi;
use crate::db::{BossSetting, Character, DailyTotal, ExpHistory, HuntingSession, Settings};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchCharacterResult {
    pub ocid: String,
    pub character_name: String,
    pub character_image: String,
    pub world_name: String,
    pub character_class: String,
    pub character_level: i32,
    pub character_exp_rate: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveHuntingSessionInput {
    pub character_id: i64,
    pub date: String,
    pub start_level: i32,
    pub end_level: i32,
    pub start_exp_percent: f64,
    pub end_exp_percent: f64,
    pub start_meso: i64,
    pub end_meso: i64,
    pub duration_minutes: i32,
    pub start_screenshot: Option<String>,
    pub end_screenshot: Option<String>,
    pub items: String,
    pub memo: Option<String>,
}

// Settings Commands
#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Option<Settings>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_api_key(state: State<AppState>, api_key: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_api_key(&api_key).map_err(|e| e.to_string())
}

// Character Commands
#[tauri::command]
pub fn get_character(state: State<AppState>) -> Result<Option<Character>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_active_character().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_character(
    state: State<'_, AppState>,
    character_name: String,
) -> Result<SearchCharacterResult, String> {
    // API Key 조회
    let api_key = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let settings = db.get_settings().map_err(|e| e.to_string())?;
        settings.ok_or("API Key가 설정되지 않았습니다")?.api_key
    };

    let api = MapleApi::new(&api_key);

    // OCID 조회
    let ocid = api.get_ocid(&character_name).await.map_err(|e| e.to_string())?;

    // 캐릭터 정보 조회
    let character = api.get_character_basic(&ocid).await.map_err(|e| e.to_string())?;

    Ok(SearchCharacterResult {
        ocid,
        character_name: character.character_name,
        character_image: character.character_image,
        world_name: character.world_name,
        character_class: character.character_class,
        character_level: character.character_level,
        character_exp_rate: character.character_exp_rate,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterCharacterInput {
    pub ocid: String,
    pub character_name: String,
    pub character_image: String,
    pub world_name: String,
    pub character_class: String,
    pub character_level: i32,
    pub character_exp_rate: Option<String>,
}

#[tauri::command]
pub fn register_character(
    state: State<AppState>,
    input: RegisterCharacterInput,
) -> Result<Character, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let character = Character {
        id: 0,
        character_name: input.character_name,
        character_image: input.character_image,
        ocid: input.ocid,
        world_name: input.world_name,
        character_class: input.character_class,
        character_level: input.character_level,
        character_exp_rate: input.character_exp_rate,
        is_active: true,
        created_at: String::new(),
        updated_at: String::new(),
    };

    db.register_character(&character).map_err(|e| e.to_string())?;

    // 등록된 캐릭터 정보 반환
    db.get_active_character()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "캐릭터 등록에 실패했습니다".to_string())
}

// Refresh character info from API
#[tauri::command]
pub async fn refresh_character(
    state: State<'_, AppState>,
) -> Result<Character, String> {
    // 현재 활성 캐릭터 조회
    let (character, api_key) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let char = db.get_active_character().map_err(|e| e.to_string())?
            .ok_or("활성 캐릭터가 없습니다")?;
        let settings = db.get_settings().map_err(|e| e.to_string())?
            .ok_or("API Key가 설정되지 않았습니다")?;
        (char, settings.api_key)
    };

    // API에서 최신 정보 가져오기
    let api = MapleApi::new(&api_key);
    let latest = api.get_character_basic(&character.ocid).await.map_err(|e| e.to_string())?;

    // 경험치 rate를 숫자로 파싱
    let exp_rate: f64 = latest.character_exp_rate.parse().unwrap_or(0.0);

    // DB 업데이트 및 경험치 히스토리 저장
    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.update_character(
            character.id,
            latest.character_level,
            &latest.character_exp_rate,
            &latest.character_image,
        ).map_err(|e| e.to_string())?;

        // 경험치 히스토리 저장
        db.save_exp_history(character.id, latest.character_level, exp_rate)
            .map_err(|e| e.to_string())?;
    }

    // 업데이트된 캐릭터 반환
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_active_character()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "캐릭터를 찾을 수 없습니다".to_string())
}

// Hunting Session Commands
#[tauri::command]
pub fn get_hunting_sessions(
    state: State<AppState>,
    date: String,
) -> Result<Vec<HuntingSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_hunting_sessions(&date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_hunting_session(
    state: State<AppState>,
    input: SaveHuntingSessionInput,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let exp_gained = input.end_exp_percent - input.start_exp_percent
        + ((input.end_level - input.start_level) as f64 * 100.0);
    let meso_gained = input.end_meso - input.start_meso;
    let sojaebi = input.duration_minutes as f64 / 30.0;

    let session = HuntingSession {
        id: 0,
        character_id: input.character_id,
        date: input.date,
        session_order: 0,
        start_level: input.start_level,
        end_level: input.end_level,
        start_exp_percent: input.start_exp_percent,
        end_exp_percent: input.end_exp_percent,
        exp_gained,
        start_meso: input.start_meso,
        end_meso: input.end_meso,
        meso_gained,
        duration_minutes: input.duration_minutes,
        sojaebi,
        start_screenshot: input.start_screenshot,
        end_screenshot: input.end_screenshot,
        items: input.items,
        memo: input.memo,
        created_at: String::new(),
        updated_at: String::new(),
    };

    db.save_hunting_session(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_hunting_session(
    state: State<AppState>,
    session: HuntingSession,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_hunting_session(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_hunting_session(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_hunting_session(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_daily_totals(
    state: State<AppState>,
    year: i32,
    month: i32,
) -> Result<Vec<DailyTotal>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_daily_totals(year, month).map_err(|e| e.to_string())
}

// Exp History Commands
#[tauri::command]
pub fn get_exp_history(
    state: State<AppState>,
    character_id: i64,
    days: i32,
) -> Result<Vec<ExpHistory>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_exp_history(character_id, days).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyExpData {
    pub date: String,
    pub level: i32,
    pub exp: i64,  // 실제 경험치 값
}

// API에서 최근 7일간 경험치 데이터 가져오기
#[tauri::command]
pub async fn get_weekly_exp_from_api(
    state: State<'_, AppState>,
) -> Result<Vec<DailyExpData>, String> {
    // 현재 활성 캐릭터와 API 키 조회
    let (character, api_key) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let char = db.get_active_character().map_err(|e| e.to_string())?
            .ok_or("활성 캐릭터가 없습니다")?;
        let settings = db.get_settings().map_err(|e| e.to_string())?
            .ok_or("API Key가 설정되지 않았습니다")?;
        (char, settings.api_key)
    };

    let api = MapleApi::new(&api_key);
    let mut results: Vec<DailyExpData> = Vec::new();

    // 오늘 데이터 (date 파라미터 없이 현재 데이터 조회)
    let today = chrono::Local::now();
    let today_str = today.format("%Y-%m-%d").to_string();
    match api.get_character_basic(&character.ocid).await {
        Ok(data) => {
            results.push(DailyExpData {
                date: today_str,
                level: data.character_level,
                exp: data.character_exp,
            });
        }
        Err(_) => {}
    }

    // 과거 6일 데이터 조회 (어제부터 6일 전까지)
    for i in 1..=6 {
        let date = chrono::Local::now() - chrono::Duration::days(i);
        let date_str = date.format("%Y-%m-%d").to_string();

        match api.get_character_basic_by_date(&character.ocid, &date_str).await {
            Ok(data) => {
                results.push(DailyExpData {
                    date: date_str,
                    level: data.character_level,
                    exp: data.character_exp,
                });
            }
            Err(_) => {
                // 해당 날짜 데이터가 없으면 스킵
            }
        }
    }

    // 날짜 오름차순 정렬
    results.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(results)
}

// Data Management Commands
#[tauri::command]
pub fn export_data(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.export_data().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_data(state: State<AppState>, data: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.import_data(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_data(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.reset_data().map_err(|e| e.to_string())
}

// Boss Settings Commands
#[tauri::command]
pub fn get_boss_settings(state: State<AppState>, character_id: i64) -> Result<Vec<BossSetting>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_boss_settings(character_id).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveBossSettingInput {
    pub character_id: i64,
    pub boss_id: String,
    pub difficulty: String,
    pub party_size: i32,
    pub enabled: bool,
}

#[tauri::command]
pub fn save_boss_setting(state: State<AppState>, input: SaveBossSettingInput) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let setting = BossSetting {
        id: 0,
        character_id: input.character_id,
        boss_id: input.boss_id,
        difficulty: input.difficulty,
        party_size: input.party_size,
        enabled: input.enabled,
        created_at: String::new(),
        updated_at: String::new(),
    };

    db.save_boss_setting(&setting).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_boss_setting(
    state: State<AppState>,
    character_id: i64,
    boss_id: String,
    difficulty: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_boss_setting(character_id, &boss_id, &difficulty)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_boss_party_size(
    state: State<AppState>,
    character_id: i64,
    boss_id: String,
    difficulty: String,
    party_size: i32,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_boss_setting_party_size(character_id, &boss_id, &difficulty, party_size)
        .map_err(|e| e.to_string())
}
