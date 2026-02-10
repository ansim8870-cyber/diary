# Maple Diary - 메이플스토리 다이어리 프로그램

## 프로젝트 개요
메이플스토리 API를 활용한 개인 사냥/보스 기록 다이어리 애플리케이션

---

## 기술 스택 (선정 완료)

### Frontend & Desktop Framework
- **Tauri v2** + **React + TypeScript**
  - 선정 이유: Electron 대비 메모리 사용량 10배 이상 적음, 번들 크기 작음
  - 네이티브에 가까운 성능으로 렉 최소화
  - Rust 백엔드로 이미지 처리 등 무거운 작업 처리 가능

### Database
- **SQLite** (via better-sqlite3 또는 Tauri의 sql 플러그인)
  - 로컬 저장, 가볍고 빠름
  - 단일 파일로 백업/이동 용이

### 이미지 분석 (OCR)
- **Tesseract OCR** (Rust 바인딩 또는 로컬 실행)
  - 스크린샷에서 레벨, 경험치, 재화, 아이템 수량 추출

### API
- **Nexon Open API** (메이플스토리)
  - 캐릭터 정보 조회 (이미지, 레벨, 경험치)

---

## 핵심 기능 요구사항

### 1. 사용자 등록 ✅
- [x] **Nexon Open API Key 입력** (최초 1회, 로컬 DB에 저장)
- [x] 캐릭터 닉네임 입력
- [x] 메이플스토리 API 호출하여 캐릭터 정보 조회
  - 캐릭터 이미지
  - 레벨
  - 현재 경험치
- [x] 최초 1회 등록 후 유지
- [x] 다른 캐릭터로 재등록 가능
- [x] API Key 변경 가능 (설정에서)

### 2. 메인 UI - 달력 ✅
- [x] 달력 형태의 메인 화면
- [x] 날짜 클릭 시 모달/패널 표시
  - 피드 버튼 (미구현)
  - 사냥 버튼 ✅
  - 보스 버튼 (설정만 완료)
- [x] 각 날짜에 사냥 총합(Total) 표시

### 3. 보스 설정 ✅ (신규)
- [x] 보스 목록 표시 (주간/월간)
- [x] 난이도 드롭다운 선택
- [x] 결정석 가격 수정 기능
- [x] 파티 인원 설정
- [x] 주간 예상 수익 계산

### 4. 사냥 기능 (진행 예정)
- [ ] 시작 스크린샷 업로드
- [ ] 종료 스크린샷 업로드
- [ ] OCR 분석으로 추출할 데이터:
  - 레벨
  - 경험치 (%)
  - 게임 내 재화 (메소)
  - 특정 아이템 개수
- [ ] 시작 사진: 기존 보유량
- [ ] 종료 사진: 최종 보유량 → 증가량 자동 계산
- [ ] 저장 버튼으로 DB 저장
- [ ] 날짜별 수정 가능
- [ ] 하루 여러 번 사냥 중첩 가능
  - 개별 사냥 기록 유지
  - 달력에는 Total 값 표기

### 5. 단위 시스템
- **소재비**: 사냥 시간 단위
  - 1 소재비 = 30분
- **메소**: 모든 재화 단위에 "메소" 표기

---

## 데이터 모델 (초안)

### Settings (설정)
```
- id: INTEGER PRIMARY KEY
- api_key: TEXT (Nexon API Key, 암호화 저장)
- created_at: DATETIME
- updated_at: DATETIME
```

### Character (등록된 캐릭터)
```
- id: INTEGER PRIMARY KEY
- character_name: TEXT (캐릭터 닉네임)
- character_image: TEXT (이미지 URL)
- ocid: TEXT (API용 캐릭터 식별자)
- world_name: TEXT (서버명)
- character_class: TEXT (직업)
- is_active: BOOLEAN (현재 선택된 캐릭터)
- created_at: DATETIME
- updated_at: DATETIME
```

### HuntingSession (사냥 기록)
```
- id: INTEGER PRIMARY KEY
- character_id: INTEGER (FK → Character)
- date: DATE (사냥 날짜)
- session_order: INTEGER (같은 날 몇 번째 사냥인지)

- start_level: INTEGER
- end_level: INTEGER
- start_exp_percent: REAL
- end_exp_percent: REAL
- exp_gained: REAL (계산값)

- start_meso: BIGINT
- end_meso: BIGINT
- meso_gained: BIGINT (계산값)

- duration_minutes: INTEGER (사냥 시간)
- sojaebi: REAL (소재비 = duration / 30)

- start_screenshot: TEXT (파일 경로)
- end_screenshot: TEXT (파일 경로)

- items: JSON (아이템별 시작/종료 수량)
- memo: TEXT

- created_at: DATETIME
- updated_at: DATETIME
```

### DailyTotal (일별 집계 - 뷰 또는 캐시)
```
- date: DATE
- total_exp_gained: REAL
- total_meso_gained: BIGINT
- total_sojaebi: REAL
- session_count: INTEGER
```

### BossSetting (보스 설정) ✅ 구현 완료
```
- id: INTEGER PRIMARY KEY
- character_id: INTEGER (FK → Character)
- boss_id: TEXT (보스 식별자)
- difficulty: TEXT (easy/normal/hard/chaos/extreme)
- party_size: INTEGER (1-6)
- enabled: BOOLEAN
- created_at: DATETIME
- updated_at: DATETIME
- UNIQUE(character_id, boss_id, difficulty)
```

---

## 폴더 구조 (현재)
```
Maple_Diary/
├── src-tauri/              # Rust 백엔드
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs          # Tauri 앱 설정
│   │   ├── db.rs           # SQLite 연결 및 데이터 모델
│   │   ├── api.rs          # 메이플 API 호출
│   │   └── commands.rs     # Tauri 커맨드 정의
│   └── Cargo.toml
├── src/                    # React 프론트엔드
│   ├── components/
│   │   ├── ui/             # shadcn/ui 컴포넌트
│   │   ├── BossSettingsDialog.tsx
│   │   ├── DailyDashboardDialog.tsx
│   │   └── SettingsDialog.tsx
│   ├── data/
│   │   └── bossData.ts     # 보스 데이터 (가격, 난이도)
│   ├── pages/
│   │   └── MainPage.tsx    # 메인 달력 페이지
│   ├── hooks/
│   │   └── useTheme.ts     # 테마 훅
│   ├── types/
│   │   └── index.ts        # TypeScript 타입 정의
│   ├── lib/
│   │   └── utils.ts        # 유틸리티 함수
│   └── App.tsx
├── public/
├── package.json
└── CLAUDE.md               # 이 파일
```

---

## 개발 우선순위

### Phase 1: 기반 구축 ✅ 완료
1. ✅ Tauri + React 프로젝트 초기화
2. ✅ SQLite 연결 및 테이블 생성
3. ✅ 기본 UI 레이아웃 (달력)
4. ✅ 다크모드/라이트모드 테마

### Phase 2: 캐릭터 등록 ✅ 완료
1. ✅ 메이플스토리 API 연동
2. ✅ 캐릭터 검색 및 등록 UI
3. ✅ 캐릭터 정보 저장
4. ✅ 캐릭터 새로고침 기능
5. ✅ 설정 다이얼로그 (캐릭터 변경, 백업/복원, 초기화)

### Phase 3: 보스 설정 ✅ 완료
1. ✅ 보스 데이터 정의 (주간/월간 보스, 난이도별 결정석 가격)
   - 그란디스 보스: 세렌, 칼로스, 카링, 흉성, 림보, 발드릭스
   - 일반 보스: 스우, 데미안, 루시드, 윌, 더스크, 진힐라, 듄켈, 가엔슬, 시그너스
   - 월간 보스: 검은 마법사
2. ✅ 보스 설정 UI (한 줄 레이아웃: 체크박스 | 이름 | 난이도 드롭다운 | 가격 | 파티 인원)
3. ✅ 보스별 결정석 가격 수정 기능 (전체 메소 금액 입력)
4. ✅ 보스 설정 DB 저장 (boss_settings 테이블)
5. ✅ 주간 예상 수익 계산 (파티 인원 반영)
6. ✅ 재화 단위 "메소" 표기 (억/만 메소)

### Phase 4: 사냥 기록 (진행 예정)
1. ⬜ 스크린샷 업로드 UI
2. ⬜ OCR 이미지 분석 구현 (Tesseract)
3. ⬜ 사냥 기록 저장/수정/삭제
4. ⬜ 일별 중첩 및 Total 계산
5. ⬜ 주간 경험치 추이 차트 (현재 비활성화 상태)

### Phase 5: 고도화 (추후)
1. ⬜ 피드 기능
2. ⬜ 보스 클리어 기록
3. ⬜ 통계/차트
4. ⬜ 보스/난이도 이미지 추가

---

## 메이플스토리 API 정보

### Base URL
```
https://open.api.nexon.com/maplestory/v1
```

### 필요한 엔드포인트
1. **캐릭터 식별자 조회**
   - GET `/id?character_name={name}`
   - Response: `{ "ocid": "..." }`

2. **캐릭터 기본 정보**
   - GET `/character/basic?ocid={ocid}`
   - Response: 캐릭터 이름, 레벨, 경험치, 이미지 등

### API Key
- Nexon Open API에서 사용자가 직접 발급
- 앱 최초 실행 시 사용자가 입력
- 로컬 SQLite DB에 암호화 저장
- 설정에서 변경 가능

---

## 참고사항
- OCR 정확도 향상을 위해 메이플스토리 UI 특성 고려 필요
- 스크린샷 해상도/UI 스케일에 따른 대응 필요
- 오프라인 우선 설계 (로컬 DB)

---

## 현재 상태 및 다음 작업

### 현재 완료된 기능
- Tauri v2 + React + TypeScript 기반 앱
- SQLite 데이터베이스 (settings, characters, hunting_sessions, boss_settings)
- 메이플스토리 API 연동 (캐릭터 조회, 경험치 히스토리)
- 달력 기반 메인 UI
- 다크/라이트 테마
- 보스 설정 (난이도 선택, 가격 수정, 파티 인원, 예상 수익)
- 데이터 백업/복원/초기화

### 대기 중인 사용자 제공 항목
- 보스 이미지
- 난이도 이미지

### 다음 작업 후보
1. OCR 사냥 기록 기능
2. 보스 클리어 기록 (체크리스트)
3. 주간 경험치 추이 차트 활성화
4. 피드 기능
