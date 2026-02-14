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
  - 보스 버튼 ✅
- [x] 각 날짜에 사냥 총합(Total) 표시
- [x] 각 날짜에 보스 수익 표시

### 3. 보스 설정 ✅ (신규)

- [x] 보스 목록 표시 (주간/월간)
- [x] 난이도 드롭다운 선택
- [x] 결정석 가격 수정 기능
- [x] 파티 인원 설정
- [x] 주간 예상 수익 계산

### 4. 사냥 기록 ✅ (수동 입력 완료)

- [x] 수동 입력 방식으로 구현
  - 시작/종료 레벨
  - 시작/종료 경험치 (%)
  - 시작/종료 메소
  - 시작/종료 솔 에르다 (개수 + 게이지)
  - 시작/종료 솔 에르다 조각
  - 소재비 (정수 단위, 위/아래 버튼)
  - 메모
- [x] 저장 버튼으로 DB 저장
- [x] 날짜별 삭제 가능
- [x] 하루 여러 번 사냥 중첩 가능
  - 개별 사냥 기록 유지
  - 달력에는 Total 값 표기
- [x] 일일 합계 표시 (경험치, 메소, 소재비, 솔 에르다)
- [ ] 스크린샷 업로드 (미구현)
- [ ] OCR 이미지 분석 (미구현)

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

### HuntingSession (사냥 기록) ✅ 구현 완료

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

- start_sol_erda: INTEGER (시작 솔 에르다 개수, 0-20)
- end_sol_erda: INTEGER (종료 솔 에르다 개수, 0-20)
- start_sol_erda_gauge: INTEGER (시작 게이지, 0-999)
- end_sol_erda_gauge: INTEGER (종료 게이지, 0-999)
- sol_erda_gained: REAL (획득량 = 종료 - 시작, 게이지 포함 계산)

- start_sol_erda_piece: BIGINT (시작 솔 에르다 조각)
- end_sol_erda_piece: BIGINT (종료 솔 에르다 조각)
- sol_erda_piece_gained: BIGINT (획득량)

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

### BossClear (보스 클리어 기록) ✅ 구현 완료

```
- id: INTEGER PRIMARY KEY
- character_id: INTEGER (FK → Character)
- boss_id: TEXT (보스 식별자)
- difficulty: TEXT (easy/normal/hard/chaos/extreme)
- cleared_date: DATE (클리어 날짜)
- week_start_date: DATE (주간/월간 시작일)
- crystal_price: BIGINT (결정석 가격)
- party_size: INTEGER (1-6)
- is_monthly: BOOLEAN (월간 보스 여부)
- created_at: DATETIME
- UNIQUE(character_id, boss_id, week_start_date)
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
│   │   ├── BossClearDialog.tsx
│   │   ├── DailyDashboardDialog.tsx
│   │   ├── HuntingDialog.tsx
│   │   ├── DifficultyBadge.tsx
│   │   └── SettingsDialog.tsx
│   ├── data/
│   │   ├── bossData.ts     # 보스 데이터 (가격, 난이도)
│   │   └── expTable.ts     # 경험치 테이블
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

### Phase 4: 사냥 기록 ✅ 완료 (수동 입력)

1. ✅ 사냥 기록 수동 입력 UI
2. ✅ 사냥 기록 저장/삭제
3. ✅ 일별 중첩 및 Total 계산
4. ✅ 솔 에르다 / 솔 에르다 조각 기록
5. ⬜ 스크린샷 업로드 UI (추후)
6. ⬜ OCR 이미지 분석 구현 (추후)
7. ⬜ 주간 경험치 추이 차트 (현재 비활성화 상태)

### Phase 5: 보스 클리어 ✅ 완료

1. ✅ 보스 클리어 기록 (주간/월간 체크리스트)
2. ✅ 주간/월간 클리어 현황 프로그레스 바
3. ✅ 클리어 날짜별 상태 표시 (오늘 클리어, 다른 날 클리어)
4. ✅ 초기화일 표시 (주간: 목요일, 월간: 1일)
5. ✅ 캐릭터별 데이터 분리

### Phase 6: 고도화 (추후)

1. ⬜ 피드 기능
2. ⬜ 통계/차트
3. ⬜ 보스/난이도 이미지 추가
4. ⬜ 사냥 기록 수정 기능

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

### 현재 완료된 기능 (v0.0.6)

- Tauri v2 + React + TypeScript 기반 앱
- SQLite 데이터베이스 (settings, characters, hunting_sessions, boss_settings, boss_clears)
- 메이플스토리 API 연동 (캐릭터 조회, 경험치 히스토리)
- 달력 기반 메인 UI
- 다크/라이트 테마
- 보스 설정 (난이도 선택, 가격 수정, 파티 인원, 예상 수익)
- 데이터 백업/복원/초기화
- **사냥 기록 수동 입력** (레벨, 경험치, 메소, 솔 에르다, 솔 에르다 조각, 소재비)
- **솔 에르다 시스템** (개수 0-20, 게이지 0-1000, 조각 별도 기록)
- **보스 클리어 기록** (주간/월간 체크리스트, 프로그레스 바, 초기화일 표시)
- **캐릭터별 데이터 분리** (사냥, 보스 클리어 모두 캐릭터별 저장)

### UI/UX 개선 사항

- Select 드롭다운 배경색 수정 (투명 문제 해결)
- number input 기본 스피너 전역 숨김
- 소재비 입력 UI (정수 단위, 위/아래 버튼)
- 보스 클리어 모달 그리드 레이아웃 (보스 설정과 일관성)
- 체크박스 클릭 시 스크롤 위치 유지
- 보스 목록 정렬 (월간 우선, 가격 내림차순)

### 대기 중인 사용자 제공 항목

- 보스 이미지 ✅ (제공 완료)
- 난이도 이미지

### 다음 작업 후보

1. OCR 스크린샷 인식 기능 재구현
2. 주간 경험치 추이 차트 활성화
3. 피드 기능
4. 사냥 기록 수정 기능
5. 통계/차트

---

## OCR 개발 상태 (2026-02-14)

### 현재 상태: 미구현 (백엔드 코드 삭제됨)

OCR 기능을 다양한 방식으로 시도했으나 인식률이 낮아 코드를 삭제함.

- `src-tauri/src/ocr/` 디렉토리 삭제됨 (Rust 백엔드 OCR 코드 전체 삭제)
- OCR 관련 의존성 삭제됨 (`Cargo.toml`)
- UI 컴포넌트는 유지 (`ScreenshotRecognitionDialog.tsx`) - 추후 재사용 가능

### 이전 시도 내역 (참고용)

1. **Windows OCR API**: 레벨/메소는 인식 성공, 경험치/솔에르다는 실패
2. **이미지 크롭 + 확대**: 효과 미미
3. **템플릿 매칭**: 아이콘 위치 찾기는 성공, OCR 인식은 여전히 실패

### 재구현 시 고려사항

1. **Tesseract OCR** 사용 검토 (더 나은 인식률 기대)
2. **게임 내 설정**: 특정 UI 스케일이나 폰트 설정에서 더 잘 인식될 수 있음
3. **사용자 크롭**: 사용자가 직접 인식 영역을 지정하는 방식

### 관련 파일

- `src/components/ScreenshotRecognitionDialog.tsx`: 스크린샷 선택 UI
- `다이어리사용이미지/`: 테스트용 스크린샷

### 이전 시도에서 성공한 항목 (재구현 시 참고)

- **레벨**: `LⅥ287`, `Lv.287` 등 다양한 패턴 인식 성공
- **메소**: `29 역 1309 만 9366` (억→역 오타 처리 포함) 인식 성공

## Rules

- 긴 출력이 예상되는 명령은 반드시 파일로 리다이렉트할 것
- 빌드/설치 결과는 성공/실패 여부만 출력할 것
