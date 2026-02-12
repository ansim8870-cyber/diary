// 설정 타입 (백엔드 응답과 일치)
export interface Settings {
  id: number;
  api_key: string;
  created_at: string;
  updated_at: string;
  // 프론트엔드 편의용
  apiKey?: string;
}

// 캐릭터 타입 (백엔드 응답과 일치)
export interface Character {
  id: number;
  character_name: string;
  character_image: string;
  ocid: string;
  world_name: string;
  character_class: string;
  character_level: number;
  character_exp_rate?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 사냥 세션 타입 (백엔드 응답과 일치)
export interface HuntingSession {
  id: number;
  character_id: number;
  date: string;
  session_order: number;
  start_level: number;
  end_level: number;
  start_exp_percent: number;
  end_exp_percent: number;
  exp_gained: number;
  start_meso: number;
  end_meso: number;
  meso_gained: number;
  duration_minutes: number;
  sojaebi: number;
  // 솔 에르다 (개수 0-20, 게이지 0-1000)
  start_sol_erda: number;
  end_sol_erda: number;
  start_sol_erda_gauge: number;
  end_sol_erda_gauge: number;
  sol_erda_gained: number;
  // 솔 에르다 조각
  start_sol_erda_piece: number;
  end_sol_erda_piece: number;
  sol_erda_piece_gained: number;
  sol_erda_piece_price: number; // 해당 사냥 시점의 조각 가격
  start_screenshot?: string;
  end_screenshot?: string;
  items: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}

// 아이템 기록
export interface ItemRecord {
  itemName: string;
  startCount: number;
  endCount: number;
  gained: number;
}

// 일별 집계 (백엔드 응답과 일치)
export interface DailyTotal {
  date: string;
  total_exp_gained: number;
  total_meso_gained: number;
  total_sojaebi: number;
  session_count: number;
}

// 캐릭터 검색 결과
export interface SearchCharacterResult {
  ocid: string;
  character_name: string;
  character_image: string;
  world_name: string;
  character_class: string;
  character_level: number;
  character_exp_rate: string;
}

// 경험치 히스토리
export interface ExpHistory {
  id: number;
  character_id: number;
  date: string;
  level: number;
  exp_rate: number;
  total_exp: number;
  created_at: string;
}

// API에서 가져온 일별 경험치 데이터
export interface DailyExpData {
  date: string;
  level: number;
  exp: number;  // 실제 경험치 값
}

// 보스 설정 (백엔드 응답과 일치)
export interface BossSetting {
  id: number;
  character_id: number;
  boss_id: string;
  difficulty: string;
  party_size: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// 보스 클리어 기록 (백엔드 응답과 일치)
export interface BossClear {
  id: number;
  character_id: number;
  boss_id: string;
  difficulty: string;
  cleared_date: string;
  week_start_date: string;
  crystal_price: number;
  party_size: number;
  created_at: string;
}

// 주간 보스 요약
export interface WeeklyBossSummary {
  week_start_date: string;
  total_crystal_income: number;
  boss_count: number;
}

// 앱 설정 (조각 가격 등)
export interface AppSettings {
  id: number;
  sol_erda_piece_price: number;
  screenshot_folder_path?: string;
  created_at: string;
  updated_at: string;
}

// 스크린샷 파일 정보
export interface ScreenshotFile {
  name: string;
  path: string;
  timestamp: Date;
  displayTime: string;  // "16:49:26"
}

// 일별 집계 (조각 포함)
export interface DailyTotalWithPieces {
  date: string;
  total_exp_gained: number;
  total_meso_gained: number;
  total_sojaebi: number;
  session_count: number;
  total_pieces: number;
  avg_piece_price: number;
}

// OCR 스크린샷 데이터
export interface HuntingScreenshotData {
  level: number | null;
  exp_percent: number | null;
  meso: number | null;
  sol_erda_count: number | null;
  sol_erda_gauge: number | null;
  sol_erda_piece: number | null;
}

// OCR 사냥 결과
export interface HuntingOcrResult {
  start_level: number;
  end_level: number;
  start_exp_percent: number;
  end_exp_percent: number;
  exp_gained: number;
  start_meso: number;
  end_meso: number;
  meso_gained: number;
  start_sol_erda: number;
  end_sol_erda: number;
  start_sol_erda_gauge: number;
  end_sol_erda_gauge: number;
  sol_erda_gained: number;
  start_sol_erda_piece: number;
  end_sol_erda_piece: number;
  sol_erda_piece_gained: number;
}
