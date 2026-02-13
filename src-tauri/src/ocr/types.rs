//! OCR 관련 타입 정의

use serde::{Deserialize, Serialize};

/// 스크린샷에서 추출된 사냥 정보
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HuntingScreenshotData {
    pub level: Option<i32>,
    pub exp_percent: Option<f64>,
    pub meso: Option<i64>,
    pub sol_erda_count: Option<i32>,
    pub sol_erda_gauge: Option<i32>,
    pub sol_erda_piece: Option<i64>,
}

/// 두 스크린샷을 비교하여 계산된 사냥 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuntingResult {
    pub start_level: i32,
    pub end_level: i32,
    pub start_exp_percent: f64,
    pub end_exp_percent: f64,
    pub exp_gained: f64,
    pub start_meso: i64,
    pub end_meso: i64,
    pub meso_gained: i64,
    pub start_sol_erda: i32,
    pub end_sol_erda: i32,
    pub start_sol_erda_gauge: i32,
    pub end_sol_erda_gauge: i32,
    pub sol_erda_gained: f64,
    pub start_sol_erda_piece: i64,
    pub end_sol_erda_piece: i64,
    pub sol_erda_piece_gained: i64,
}

/// 아이콘 위치 정보
#[derive(Debug, Clone, Default)]
pub struct IconPositions {
    pub meso: Option<(u32, u32)>,
    pub sol_erda: Option<(u32, u32)>,
    pub sol_erda_piece: Option<(u32, u32)>,
}

/// 크롭된 영역들
#[derive(Debug, Default)]
pub struct CroppedRegions {
    pub level: Option<image::DynamicImage>,
    pub exp: Option<image::DynamicImage>,
    pub meso: Option<image::DynamicImage>,
    pub sol_erda: Option<image::DynamicImage>,
    pub sol_erda_piece: Option<image::DynamicImage>,
}

/// OCR 에러 타입
#[derive(Debug, thiserror::Error)]
pub enum OcrError {
    #[error("이미지 로드 실패: {0}")]
    ImageLoadError(String),

    #[error("템플릿 매칭 실패: {0}")]
    TemplateMatchError(String),

    #[error("OCR 모델 초기화 실패: {0}")]
    ModelInitError(String),

    #[error("텍스트 인식 실패: {0}")]
    RecognitionError(String),

    #[error("파싱 실패: {0}")]
    ParseError(String),

    #[error("리소스 경로 오류: {0}")]
    ResourcePathError(String),
}
