use crate::api::MapleApi;
use crate::db::{AppSettings, BossClear, BossSetting, Character, DailyTotal, Database, ExpHistory, HuntingSession, Settings, WeeklyBossSummary};
use crate::ocr::{self, HuntingScreenshotData, HuntingResult};
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
    // 솔 에르다 (개수 0-20, 게이지 0-1000)
    pub start_sol_erda: i32,
    pub end_sol_erda: i32,
    pub start_sol_erda_gauge: i32,
    pub end_sol_erda_gauge: i32,
    // 솔 에르다 조각
    pub start_sol_erda_piece: i64,
    pub end_sol_erda_piece: i64,
    pub sol_erda_piece_price: i64, // 해당 사냥 시점의 조각 가격
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
    character_id: i64,
    date: String,
) -> Result<Vec<HuntingSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_hunting_sessions(character_id, &date).map_err(|e| e.to_string())
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

    // 솔 에르다 획득량 계산 (개수 + 게이지/1000)
    let start_sol_erda_total = input.start_sol_erda as f64 + (input.start_sol_erda_gauge as f64 / 1000.0);
    let end_sol_erda_total = input.end_sol_erda as f64 + (input.end_sol_erda_gauge as f64 / 1000.0);
    let sol_erda_gained = end_sol_erda_total - start_sol_erda_total;

    // 솔 에르다 조각 획득량
    let sol_erda_piece_gained = input.end_sol_erda_piece - input.start_sol_erda_piece;

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
        start_sol_erda: input.start_sol_erda,
        end_sol_erda: input.end_sol_erda,
        start_sol_erda_gauge: input.start_sol_erda_gauge,
        end_sol_erda_gauge: input.end_sol_erda_gauge,
        sol_erda_gained,
        start_sol_erda_piece: input.start_sol_erda_piece,
        end_sol_erda_piece: input.end_sol_erda_piece,
        sol_erda_piece_gained,
        sol_erda_piece_price: input.sol_erda_piece_price,
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
    character_id: i64,
    year: i32,
    month: i32,
) -> Result<Vec<DailyTotal>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_daily_totals(character_id, year, month).map_err(|e| e.to_string())
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

// Boss Clear Commands
#[derive(Debug, Serialize, Deserialize)]
pub struct SaveBossClearInput {
    pub character_id: i64,
    pub boss_id: String,
    pub difficulty: String,
    pub cleared_date: String,
    pub crystal_price: i64,
    pub party_size: i32,
    pub is_monthly: bool,
}

#[tauri::command]
pub fn save_boss_clear(state: State<AppState>, input: SaveBossClearInput) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let period_start = if input.is_monthly {
        Database::get_month_start_date(&input.cleared_date)
    } else {
        Database::get_week_start_date(&input.cleared_date)
    };

    let clear = BossClear {
        id: 0,
        character_id: input.character_id,
        boss_id: input.boss_id,
        difficulty: input.difficulty,
        cleared_date: input.cleared_date.clone(),
        week_start_date: period_start,
        crystal_price: input.crystal_price,
        party_size: input.party_size,
        created_at: String::new(),
    };

    db.save_boss_clear(&clear, input.is_monthly).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_boss_clear(
    state: State<AppState>,
    character_id: i64,
    boss_id: String,
    week_start_date: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_boss_clear(character_id, &boss_id, &week_start_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_boss_clears_by_week(
    state: State<AppState>,
    character_id: i64,
    week_start_date: String,
) -> Result<Vec<BossClear>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_boss_clears_by_week(character_id, &week_start_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_boss_clears_by_date(
    state: State<AppState>,
    character_id: i64,
    date: String,
) -> Result<Vec<BossClear>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_boss_clears_by_date(character_id, &date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_weekly_boss_summary(
    state: State<AppState>,
    character_id: i64,
    week_start_date: String,
) -> Result<WeeklyBossSummary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_weekly_boss_summary(character_id, &week_start_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_monthly_boss_clears(
    state: State<AppState>,
    character_id: i64,
    year: i32,
    month: i32,
) -> Result<Vec<BossClear>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_monthly_boss_clears(character_id, year, month)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_week_start_date(date: String) -> Result<String, String> {
    Ok(Database::get_week_start_date(&date))
}

#[tauri::command]
pub fn get_month_start_date(date: String) -> Result<String, String> {
    Ok(Database::get_month_start_date(&date))
}

// App Settings Commands
#[tauri::command]
pub fn get_app_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_app_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_app_settings(state: State<AppState>, sol_erda_piece_price: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_app_settings(sol_erda_piece_price).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_screenshot_folder_path(state: State<AppState>, path: Option<String>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_screenshot_folder_path(path.as_deref()).map_err(|e| e.to_string())
}

// Daily totals with piece info
#[derive(Debug, Serialize, Deserialize)]
pub struct DailyTotalWithPieces {
    pub date: String,
    pub total_exp_gained: f64,
    pub total_meso_gained: i64,
    pub total_sojaebi: f64,
    pub session_count: i32,
    pub total_pieces: i64,
    pub avg_piece_price: i64,
}

#[tauri::command]
pub fn get_daily_totals_with_pieces(
    state: State<AppState>,
    character_id: i64,
    year: i32,
    month: i32,
) -> Result<Vec<DailyTotalWithPieces>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let totals = db.get_daily_totals_with_pieces(character_id, year, month).map_err(|e| e.to_string())?;

    Ok(totals.into_iter().map(|(daily, pieces, price)| DailyTotalWithPieces {
        date: daily.date,
        total_exp_gained: daily.total_exp_gained,
        total_meso_gained: daily.total_meso_gained,
        total_sojaebi: daily.total_sojaebi,
        session_count: daily.session_count,
        total_pieces: pieces,
        avg_piece_price: price,
    }).collect())
}

// OCR Commands
#[tauri::command]
pub async fn analyze_screenshot(image_path: String) -> Result<HuntingScreenshotData, String> {
    // 이미지에서 텍스트 추출
    let text = ocr::extract_text_from_image(&image_path)
        .await
        .map_err(|e| e.to_string())?;

    // 텍스트에서 사냥 정보 파싱
    let data = ocr::parse_hunting_data(&text);

    Ok(data)
}

#[tauri::command]
pub async fn analyze_hunting_screenshots(
    start_image_path: String,
    end_image_path: String,
) -> Result<HuntingResult, String> {
    println!("[OCR] ========================================");
    println!("[OCR] analyze_hunting_screenshots 호출됨");
    println!("[OCR] 시작 이미지: {}", start_image_path);
    println!("[OCR] 종료 이미지: {}", end_image_path);
    println!("[OCR] ========================================");

    // ===== 시작 스크린샷 분석 =====
    println!("[OCR] 시작 스크린샷 분석 시작...");

    // 1. 전체 이미지 OCR (메소, 레벨)
    let start_text = ocr::extract_text_from_image(&start_image_path)
        .await
        .map_err(|e| {
            println!("[OCR] 시작 스크린샷 분석 실패: {}", e);
            format!("시작 스크린샷 분석 실패: {}", e)
        })?;
    let mut start_data = ocr::parse_hunting_data(&start_text);

    println!("[OCR] ========== 시작 스크린샷 (전체) ==========");
    println!("[OCR] 텍스트:\n{}", start_text);
    println!("[OCR] 파싱 결과:");
    println!("  - 레벨: {:?}", start_data.level);
    println!("  - 메소: {:?}", start_data.meso);

    // 2. 솔 에르다 영역 크롭 OCR
    println!("[OCR] 시작 스크린샷 - 솔 에르다 영역 분석...");
    if let Ok((count, gauge, piece)) = ocr::extract_sol_erda_from_image(&start_image_path).await {
        if count.is_some() { start_data.sol_erda_count = count; }
        if gauge.is_some() { start_data.sol_erda_gauge = gauge; }
        if piece.is_some() { start_data.sol_erda_piece = piece; }
        println!("  - 솔 에르다 개수: {:?}", start_data.sol_erda_count);
        println!("  - 솔 에르다 게이지: {:?}", start_data.sol_erda_gauge);
        println!("  - 솔 에르다 조각: {:?}", start_data.sol_erda_piece);
    }

    // 3. 경험치 영역 크롭 OCR
    println!("[OCR] 시작 스크린샷 - 경험치 영역 분석...");
    if let Ok(exp) = ocr::extract_exp_from_image(&start_image_path).await {
        if exp.is_some() { start_data.exp_percent = exp; }
        println!("  - 경험치: {:?}", start_data.exp_percent);
    }

    // ===== 종료 스크린샷 분석 =====
    println!("[OCR] 종료 스크린샷 분석 시작...");

    // 1. 전체 이미지 OCR (메소, 레벨)
    let end_text = ocr::extract_text_from_image(&end_image_path)
        .await
        .map_err(|e| {
            println!("[OCR] 종료 스크린샷 분석 실패: {}", e);
            format!("종료 스크린샷 분석 실패: {}", e)
        })?;
    let mut end_data = ocr::parse_hunting_data(&end_text);

    println!("[OCR] ========== 종료 스크린샷 (전체) ==========");
    println!("[OCR] 텍스트:\n{}", end_text);
    println!("[OCR] 파싱 결과:");
    println!("  - 레벨: {:?}", end_data.level);
    println!("  - 메소: {:?}", end_data.meso);

    // 2. 솔 에르다 영역 크롭 OCR
    println!("[OCR] 종료 스크린샷 - 솔 에르다 영역 분석...");
    if let Ok((count, gauge, piece)) = ocr::extract_sol_erda_from_image(&end_image_path).await {
        if count.is_some() { end_data.sol_erda_count = count; }
        if gauge.is_some() { end_data.sol_erda_gauge = gauge; }
        if piece.is_some() { end_data.sol_erda_piece = piece; }
        println!("  - 솔 에르다 개수: {:?}", end_data.sol_erda_count);
        println!("  - 솔 에르다 게이지: {:?}", end_data.sol_erda_gauge);
        println!("  - 솔 에르다 조각: {:?}", end_data.sol_erda_piece);
    }

    // 3. 경험치 영역 크롭 OCR
    println!("[OCR] 종료 스크린샷 - 경험치 영역 분석...");
    if let Ok(exp) = ocr::extract_exp_from_image(&end_image_path).await {
        if exp.is_some() { end_data.exp_percent = exp; }
        println!("  - 경험치: {:?}", end_data.exp_percent);
    }

    // 사냥 결과 계산
    let result = ocr::calculate_hunting_result(&start_data, &end_data)
        .ok_or_else(|| "사냥 결과 계산 실패".to_string())?;

    println!("[OCR] ========== 최종 결과 ==========");
    println!("  - 레벨: {} -> {}", result.start_level, result.end_level);
    println!("  - 경험치: {:.3}% -> {:.3}% (획득: {:.3}%)", result.start_exp_percent, result.end_exp_percent, result.exp_gained);
    println!("  - 메소: {} -> {} (획득: {})", result.start_meso, result.end_meso, result.meso_gained);
    println!("  - 솔 에르다: {}개 {}게이지 -> {}개 {}게이지 (획득: {:.3})",
             result.start_sol_erda, result.start_sol_erda_gauge,
             result.end_sol_erda, result.end_sol_erda_gauge, result.sol_erda_gained);
    println!("  - 솔 에르다 조각: {} -> {} (획득: {})",
             result.start_sol_erda_piece, result.end_sol_erda_piece, result.sol_erda_piece_gained);

    Ok(result)
}

// OCR 텍스트만 추출 (디버그용)
#[tauri::command]
pub async fn extract_screenshot_text(image_path: String) -> Result<String, String> {
    ocr::extract_text_from_image(&image_path)
        .await
        .map_err(|e| e.to_string())
}
