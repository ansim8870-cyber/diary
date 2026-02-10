use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub id: i64,
    pub api_key: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Character {
    pub id: i64,
    pub character_name: String,
    pub character_image: String,
    pub ocid: String,
    pub world_name: String,
    pub character_class: String,
    pub character_level: i32,
    pub character_exp_rate: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HuntingSession {
    pub id: i64,
    pub character_id: i64,
    pub date: String,
    pub session_order: i32,
    pub start_level: i32,
    pub end_level: i32,
    pub start_exp_percent: f64,
    pub end_exp_percent: f64,
    pub exp_gained: f64,
    pub start_meso: i64,
    pub end_meso: i64,
    pub meso_gained: i64,
    pub duration_minutes: i32,
    pub sojaebi: f64,
    // 솔 에르다 (개수 0-20, 게이지 0-1000)
    pub start_sol_erda: i32,
    pub end_sol_erda: i32,
    pub start_sol_erda_gauge: i32,
    pub end_sol_erda_gauge: i32,
    pub sol_erda_gained: f64,
    // 솔 에르다 조각
    pub start_sol_erda_piece: i64,
    pub end_sol_erda_piece: i64,
    pub sol_erda_piece_gained: i64,
    pub start_screenshot: Option<String>,
    pub end_screenshot: Option<String>,
    pub items: String, // JSON string
    pub memo: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyTotal {
    pub date: String,
    pub total_exp_gained: f64,
    pub total_meso_gained: i64,
    pub total_sojaebi: f64,
    pub session_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExpHistory {
    pub id: i64,
    pub character_id: i64,
    pub date: String,
    pub level: i32,
    pub exp_rate: f64,
    pub total_exp: f64, // level * 100 + exp_rate
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BossSetting {
    pub id: i64,
    pub character_id: i64,
    pub boss_id: String,
    pub difficulty: String,
    pub party_size: i32,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path();

        // 디렉토리 생성
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;
        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn get_db_path() -> PathBuf {
        let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("MapleDiary");
        path.push("maple_diary.db");
        path
    }

    fn init_tables(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_key TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_name TEXT NOT NULL,
                character_image TEXT NOT NULL,
                ocid TEXT NOT NULL,
                world_name TEXT NOT NULL,
                character_class TEXT NOT NULL,
                character_level INTEGER NOT NULL,
                character_exp_rate TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;

        // 기존 테이블에 컬럼이 없으면 추가
        let _ = self.conn.execute(
            "ALTER TABLE characters ADD COLUMN character_exp_rate TEXT",
            [],
        );

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS hunting_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                session_order INTEGER NOT NULL,
                start_level INTEGER NOT NULL,
                end_level INTEGER NOT NULL,
                start_exp_percent REAL NOT NULL,
                end_exp_percent REAL NOT NULL,
                exp_gained REAL NOT NULL,
                start_meso INTEGER NOT NULL,
                end_meso INTEGER NOT NULL,
                meso_gained INTEGER NOT NULL,
                duration_minutes INTEGER NOT NULL,
                sojaebi REAL NOT NULL,
                start_screenshot TEXT,
                end_screenshot TEXT,
                items TEXT NOT NULL DEFAULT '[]',
                memo TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (character_id) REFERENCES characters(id)
            )",
            [],
        )?;

        // 솔 에르다 관련 컬럼 추가 (기존 테이블 마이그레이션)
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN start_sol_erda INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN end_sol_erda INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN start_sol_erda_gauge INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN end_sol_erda_gauge INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN sol_erda_gained REAL NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN start_sol_erda_piece INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN end_sol_erda_piece INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = self.conn.execute(
            "ALTER TABLE hunting_sessions ADD COLUMN sol_erda_piece_gained INTEGER NOT NULL DEFAULT 0",
            [],
        );

        // 인덱스 생성
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_hunting_date ON hunting_sessions(date)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_hunting_character ON hunting_sessions(character_id)",
            [],
        )?;

        // 경험치 히스토리 테이블
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS exp_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                level INTEGER NOT NULL,
                exp_rate REAL NOT NULL,
                total_exp REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (character_id) REFERENCES characters(id),
                UNIQUE(character_id, date)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_exp_history_date ON exp_history(date)",
            [],
        )?;

        // 보스 설정 테이블
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS boss_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                boss_id TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                party_size INTEGER NOT NULL DEFAULT 1,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (character_id) REFERENCES characters(id),
                UNIQUE(character_id, boss_id, difficulty)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_boss_settings_character ON boss_settings(character_id)",
            [],
        )?;

        Ok(())
    }

    // Settings
    pub fn get_settings(&self) -> Result<Option<Settings>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, api_key, created_at, updated_at FROM settings ORDER BY id DESC LIMIT 1"
        )?;

        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Settings {
                id: row.get(0)?,
                api_key: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_api_key(&self, api_key: &str) -> Result<()> {
        // 기존 설정 삭제 후 새로 저장
        self.conn.execute("DELETE FROM settings", [])?;
        self.conn.execute(
            "INSERT INTO settings (api_key) VALUES (?1)",
            params![api_key],
        )?;
        Ok(())
    }

    // Characters
    pub fn get_active_character(&self) -> Result<Option<Character>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, character_name, character_image, ocid, world_name,
                    character_class, character_level, character_exp_rate, is_active, created_at, updated_at
             FROM characters WHERE is_active = 1 LIMIT 1"
        )?;

        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(Some(Character {
                id: row.get(0)?,
                character_name: row.get(1)?,
                character_image: row.get(2)?,
                ocid: row.get(3)?,
                world_name: row.get(4)?,
                character_class: row.get(5)?,
                character_level: row.get(6)?,
                character_exp_rate: row.get(7)?,
                is_active: row.get::<_, i32>(8)? == 1,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn register_character(&self, character: &Character) -> Result<i64> {
        // 기존 활성 캐릭터 비활성화
        self.conn.execute("UPDATE characters SET is_active = 0", [])?;

        self.conn.execute(
            "INSERT INTO characters (character_name, character_image, ocid, world_name,
                                    character_class, character_level, character_exp_rate, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
            params![
                character.character_name,
                character.character_image,
                character.ocid,
                character.world_name,
                character.character_class,
                character.character_level,
                character.character_exp_rate,
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_character(&self, id: i64, level: i32, exp_rate: &str, image: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE characters SET character_level = ?1, character_exp_rate = ?2,
             character_image = ?3, updated_at = datetime('now') WHERE id = ?4",
            params![level, exp_rate, image, id],
        )?;
        Ok(())
    }

    // Hunting Sessions
    pub fn get_hunting_sessions(&self, date: &str) -> Result<Vec<HuntingSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, character_id, date, session_order, start_level, end_level,
                    start_exp_percent, end_exp_percent, exp_gained, start_meso, end_meso,
                    meso_gained, duration_minutes, sojaebi,
                    start_sol_erda, end_sol_erda, start_sol_erda_gauge, end_sol_erda_gauge, sol_erda_gained,
                    start_sol_erda_piece, end_sol_erda_piece, sol_erda_piece_gained,
                    start_screenshot, end_screenshot, items, memo, created_at, updated_at
             FROM hunting_sessions WHERE date = ?1 ORDER BY session_order"
        )?;

        let sessions = stmt.query_map(params![date], |row| {
            Ok(HuntingSession {
                id: row.get(0)?,
                character_id: row.get(1)?,
                date: row.get(2)?,
                session_order: row.get(3)?,
                start_level: row.get(4)?,
                end_level: row.get(5)?,
                start_exp_percent: row.get(6)?,
                end_exp_percent: row.get(7)?,
                exp_gained: row.get(8)?,
                start_meso: row.get(9)?,
                end_meso: row.get(10)?,
                meso_gained: row.get(11)?,
                duration_minutes: row.get(12)?,
                sojaebi: row.get(13)?,
                start_sol_erda: row.get(14)?,
                end_sol_erda: row.get(15)?,
                start_sol_erda_gauge: row.get(16)?,
                end_sol_erda_gauge: row.get(17)?,
                sol_erda_gained: row.get(18)?,
                start_sol_erda_piece: row.get(19)?,
                end_sol_erda_piece: row.get(20)?,
                sol_erda_piece_gained: row.get(21)?,
                start_screenshot: row.get(22)?,
                end_screenshot: row.get(23)?,
                items: row.get(24)?,
                memo: row.get(25)?,
                created_at: row.get(26)?,
                updated_at: row.get(27)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(sessions)
    }

    pub fn save_hunting_session(&self, session: &HuntingSession) -> Result<i64> {
        // 해당 날짜의 마지막 session_order 조회
        let next_order: i32 = self.conn.query_row(
            "SELECT COALESCE(MAX(session_order), 0) + 1 FROM hunting_sessions WHERE date = ?1",
            params![session.date],
            |row| row.get(0),
        )?;

        self.conn.execute(
            "INSERT INTO hunting_sessions (character_id, date, session_order, start_level, end_level,
                start_exp_percent, end_exp_percent, exp_gained, start_meso, end_meso, meso_gained,
                duration_minutes, sojaebi,
                start_sol_erda, end_sol_erda, start_sol_erda_gauge, end_sol_erda_gauge, sol_erda_gained,
                start_sol_erda_piece, end_sol_erda_piece, sol_erda_piece_gained,
                start_screenshot, end_screenshot, items, memo)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
            params![
                session.character_id, session.date, next_order, session.start_level, session.end_level,
                session.start_exp_percent, session.end_exp_percent, session.exp_gained,
                session.start_meso, session.end_meso, session.meso_gained,
                session.duration_minutes, session.sojaebi,
                session.start_sol_erda, session.end_sol_erda, session.start_sol_erda_gauge, session.end_sol_erda_gauge, session.sol_erda_gained,
                session.start_sol_erda_piece, session.end_sol_erda_piece, session.sol_erda_piece_gained,
                session.start_screenshot, session.end_screenshot, session.items, session.memo
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_hunting_session(&self, session: &HuntingSession) -> Result<()> {
        self.conn.execute(
            "UPDATE hunting_sessions SET
                start_level = ?1, end_level = ?2, start_exp_percent = ?3, end_exp_percent = ?4,
                exp_gained = ?5, start_meso = ?6, end_meso = ?7, meso_gained = ?8,
                duration_minutes = ?9, sojaebi = ?10,
                start_sol_erda = ?11, end_sol_erda = ?12, start_sol_erda_gauge = ?13, end_sol_erda_gauge = ?14, sol_erda_gained = ?15,
                start_sol_erda_piece = ?16, end_sol_erda_piece = ?17, sol_erda_piece_gained = ?18,
                start_screenshot = ?19, end_screenshot = ?20, items = ?21, memo = ?22, updated_at = datetime('now')
             WHERE id = ?23",
            params![
                session.start_level, session.end_level, session.start_exp_percent, session.end_exp_percent,
                session.exp_gained, session.start_meso, session.end_meso, session.meso_gained,
                session.duration_minutes, session.sojaebi,
                session.start_sol_erda, session.end_sol_erda, session.start_sol_erda_gauge, session.end_sol_erda_gauge, session.sol_erda_gained,
                session.start_sol_erda_piece, session.end_sol_erda_piece, session.sol_erda_piece_gained,
                session.start_screenshot, session.end_screenshot, session.items, session.memo, session.id
            ],
        )?;
        Ok(())
    }

    pub fn delete_hunting_session(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM hunting_sessions WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_daily_totals(&self, year: i32, month: i32) -> Result<Vec<DailyTotal>> {
        let start_date = format!("{:04}-{:02}-01", year, month);
        let end_date = format!("{:04}-{:02}-31", year, month);

        let mut stmt = self.conn.prepare(
            "SELECT date,
                    SUM(exp_gained) as total_exp,
                    SUM(meso_gained) as total_meso,
                    SUM(sojaebi) as total_sojaebi,
                    COUNT(*) as session_count
             FROM hunting_sessions
             WHERE date >= ?1 AND date <= ?2
             GROUP BY date
             ORDER BY date"
        )?;

        let totals = stmt.query_map(params![start_date, end_date], |row| {
            Ok(DailyTotal {
                date: row.get(0)?,
                total_exp_gained: row.get(1)?,
                total_meso_gained: row.get(2)?,
                total_sojaebi: row.get(3)?,
                session_count: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(totals)
    }

    // Exp History
    pub fn save_exp_history(&self, character_id: i64, level: i32, exp_rate: f64) -> Result<()> {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let total_exp = (level as f64) * 100.0 + exp_rate;

        // UPSERT: 오늘 기록이 있으면 업데이트, 없으면 삽입
        self.conn.execute(
            "INSERT INTO exp_history (character_id, date, level, exp_rate, total_exp)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(character_id, date) DO UPDATE SET
                level = excluded.level,
                exp_rate = excluded.exp_rate,
                total_exp = excluded.total_exp",
            params![character_id, today, level, exp_rate, total_exp],
        )?;
        Ok(())
    }

    pub fn get_exp_history(&self, character_id: i64, days: i32) -> Result<Vec<ExpHistory>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, character_id, date, level, exp_rate, total_exp, created_at
             FROM exp_history
             WHERE character_id = ?1
             ORDER BY date DESC
             LIMIT ?2"
        )?;

        let history = stmt.query_map(params![character_id, days], |row| {
            Ok(ExpHistory {
                id: row.get(0)?,
                character_id: row.get(1)?,
                date: row.get(2)?,
                level: row.get(3)?,
                exp_rate: row.get(4)?,
                total_exp: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(history)
    }

    // Data Export/Import/Reset
    pub fn export_data(&self) -> Result<String> {
        let settings = self.get_settings()?;
        let character = self.get_active_character()?;

        // 모든 사냥 세션 가져오기
        let mut stmt = self.conn.prepare(
            "SELECT id, character_id, date, session_order, start_level, end_level,
                    start_exp_percent, end_exp_percent, exp_gained, start_meso, end_meso,
                    meso_gained, duration_minutes, sojaebi,
                    start_sol_erda, end_sol_erda, start_sol_erda_gauge, end_sol_erda_gauge, sol_erda_gained,
                    start_sol_erda_piece, end_sol_erda_piece, sol_erda_piece_gained,
                    start_screenshot, end_screenshot, items, memo, created_at, updated_at
             FROM hunting_sessions ORDER BY date, session_order"
        )?;

        let sessions = stmt.query_map([], |row| {
            Ok(HuntingSession {
                id: row.get(0)?,
                character_id: row.get(1)?,
                date: row.get(2)?,
                session_order: row.get(3)?,
                start_level: row.get(4)?,
                end_level: row.get(5)?,
                start_exp_percent: row.get(6)?,
                end_exp_percent: row.get(7)?,
                exp_gained: row.get(8)?,
                start_meso: row.get(9)?,
                end_meso: row.get(10)?,
                meso_gained: row.get(11)?,
                duration_minutes: row.get(12)?,
                sojaebi: row.get(13)?,
                start_sol_erda: row.get(14)?,
                end_sol_erda: row.get(15)?,
                start_sol_erda_gauge: row.get(16)?,
                end_sol_erda_gauge: row.get(17)?,
                sol_erda_gained: row.get(18)?,
                start_sol_erda_piece: row.get(19)?,
                end_sol_erda_piece: row.get(20)?,
                sol_erda_piece_gained: row.get(21)?,
                start_screenshot: row.get(22)?,
                end_screenshot: row.get(23)?,
                items: row.get(24)?,
                memo: row.get(25)?,
                created_at: row.get(26)?,
                updated_at: row.get(27)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        let export = serde_json::json!({
            "version": 1,
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "settings": settings,
            "character": character,
            "hunting_sessions": sessions,
        });

        Ok(serde_json::to_string_pretty(&export).unwrap_or_default())
    }

    pub fn import_data(&self, json_data: &str) -> Result<()> {
        let data: serde_json::Value = serde_json::from_str(json_data)
            .map_err(|_| rusqlite::Error::InvalidQuery)?;

        // API Key 복원
        if let Some(settings) = data.get("settings") {
            if let Some(api_key) = settings.get("api_key").and_then(|v| v.as_str()) {
                self.save_api_key(api_key)?;
            }
        }

        // 캐릭터 복원
        if let Some(char_data) = data.get("character") {
            if !char_data.is_null() {
                let character = Character {
                    id: 0,
                    character_name: char_data.get("character_name").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    character_image: char_data.get("character_image").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    ocid: char_data.get("ocid").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    world_name: char_data.get("world_name").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    character_class: char_data.get("character_class").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    character_level: char_data.get("character_level").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    character_exp_rate: char_data.get("character_exp_rate").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    is_active: true,
                    created_at: String::new(),
                    updated_at: String::new(),
                };
                self.register_character(&character)?;
            }
        }

        // 사냥 세션 복원
        if let Some(sessions) = data.get("hunting_sessions").and_then(|v| v.as_array()) {
            // 기존 세션 삭제
            self.conn.execute("DELETE FROM hunting_sessions", [])?;

            for session_data in sessions {
                let session = HuntingSession {
                    id: 0,
                    character_id: session_data.get("character_id").and_then(|v| v.as_i64()).unwrap_or(1),
                    date: session_data.get("date").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                    session_order: session_data.get("session_order").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                    start_level: session_data.get("start_level").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    end_level: session_data.get("end_level").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    start_exp_percent: session_data.get("start_exp_percent").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    end_exp_percent: session_data.get("end_exp_percent").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    exp_gained: session_data.get("exp_gained").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    start_meso: session_data.get("start_meso").and_then(|v| v.as_i64()).unwrap_or(0),
                    end_meso: session_data.get("end_meso").and_then(|v| v.as_i64()).unwrap_or(0),
                    meso_gained: session_data.get("meso_gained").and_then(|v| v.as_i64()).unwrap_or(0),
                    duration_minutes: session_data.get("duration_minutes").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    sojaebi: session_data.get("sojaebi").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    start_sol_erda: session_data.get("start_sol_erda").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    end_sol_erda: session_data.get("end_sol_erda").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    start_sol_erda_gauge: session_data.get("start_sol_erda_gauge").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    end_sol_erda_gauge: session_data.get("end_sol_erda_gauge").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    sol_erda_gained: session_data.get("sol_erda_gained").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    start_sol_erda_piece: session_data.get("start_sol_erda_piece").and_then(|v| v.as_i64()).unwrap_or(0),
                    end_sol_erda_piece: session_data.get("end_sol_erda_piece").and_then(|v| v.as_i64()).unwrap_or(0),
                    sol_erda_piece_gained: session_data.get("sol_erda_piece_gained").and_then(|v| v.as_i64()).unwrap_or(0),
                    start_screenshot: session_data.get("start_screenshot").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    end_screenshot: session_data.get("end_screenshot").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    items: session_data.get("items").and_then(|v| v.as_str()).unwrap_or("[]").to_string(),
                    memo: session_data.get("memo").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    created_at: String::new(),
                    updated_at: String::new(),
                };
                self.save_hunting_session(&session)?;
            }
        }

        Ok(())
    }

    pub fn reset_data(&self) -> Result<()> {
        self.conn.execute("DELETE FROM hunting_sessions", [])?;
        self.conn.execute("DELETE FROM characters", [])?;
        self.conn.execute("DELETE FROM settings", [])?;
        self.conn.execute("DELETE FROM boss_settings", [])?;
        Ok(())
    }

    // Boss Settings
    pub fn get_boss_settings(&self, character_id: i64) -> Result<Vec<BossSetting>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, character_id, boss_id, difficulty, party_size, enabled, created_at, updated_at
             FROM boss_settings
             WHERE character_id = ?1
             ORDER BY boss_id, difficulty"
        )?;

        let settings = stmt.query_map(params![character_id], |row| {
            Ok(BossSetting {
                id: row.get(0)?,
                character_id: row.get(1)?,
                boss_id: row.get(2)?,
                difficulty: row.get(3)?,
                party_size: row.get(4)?,
                enabled: row.get::<_, i32>(5)? == 1,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?.collect::<Result<Vec<_>>>()?;

        Ok(settings)
    }

    pub fn save_boss_setting(&self, setting: &BossSetting) -> Result<i64> {
        // UPSERT: 이미 있으면 업데이트, 없으면 삽입
        self.conn.execute(
            "INSERT INTO boss_settings (character_id, boss_id, difficulty, party_size, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(character_id, boss_id, difficulty) DO UPDATE SET
                party_size = excluded.party_size,
                enabled = excluded.enabled,
                updated_at = datetime('now')",
            params![
                setting.character_id,
                setting.boss_id,
                setting.difficulty,
                setting.party_size,
                if setting.enabled { 1 } else { 0 }
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    pub fn delete_boss_setting(&self, character_id: i64, boss_id: &str, difficulty: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM boss_settings WHERE character_id = ?1 AND boss_id = ?2 AND difficulty = ?3",
            params![character_id, boss_id, difficulty],
        )?;
        Ok(())
    }

    pub fn update_boss_setting_party_size(&self, character_id: i64, boss_id: &str, difficulty: &str, party_size: i32) -> Result<()> {
        self.conn.execute(
            "UPDATE boss_settings SET party_size = ?1, updated_at = datetime('now')
             WHERE character_id = ?2 AND boss_id = ?3 AND difficulty = ?4",
            params![party_size, character_id, boss_id, difficulty],
        )?;
        Ok(())
    }
}
