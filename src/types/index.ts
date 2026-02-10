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
