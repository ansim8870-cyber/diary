//! OCR 모듈 - 스크린샷에서 사냥 정보 추출
//!
//! PaddleOCR + ONNX Runtime 기반 텍스트 인식

mod engine;
mod parser;
mod template_matcher;
mod types;

pub use types::{HuntingResult, HuntingScreenshotData, OcrError};

use std::path::Path;

/// 스크린샷 분석 - 메인 함수
pub fn analyze_screenshot(
    image_path: &str,
    resources_dir: &Path,
) -> Result<HuntingScreenshotData, OcrError> {
    // 1. 이미지 로드
    let image = engine::load_image(image_path)?;

    // 2. 템플릿 매칭으로 아이콘 위치 탐지
    let templates_dir = resources_dir.join("templates");
    let positions = template_matcher::find_all_icons(&image, &templates_dir)?;

    // 3. 영역 크롭
    let regions = template_matcher::crop_regions(&image, &positions)?;

    // 4. OCR 엔진 초기화 (Tesseract)
    // tessdata 폴더가 있으면 사용, 없으면 시스템 기본 경로 사용
    let tessdata_dir = resources_dir.join("tessdata");
    let mut ocr = engine::OcrEngine::new(&tessdata_dir)?;

    // 5. 각 영역 인식 및 파싱
    let mut data = HuntingScreenshotData::default();

    // 레벨 인식
    if let Some(level_img) = &regions.level {
        if let Ok(text) = ocr.recognize(level_img) {
            data.level = parser::parse_level(&text);
        }
    }

    // 경험치 인식
    if let Some(exp_img) = &regions.exp {
        if let Ok(text) = ocr.recognize(exp_img) {
            data.exp_percent = parser::parse_exp(&text);
        }
    }

    // 메소 인식
    if let Some(meso_img) = &regions.meso {
        if let Ok(text) = ocr.recognize(meso_img) {
            data.meso = parser::parse_meso(&text);
        }
    }

    // 솔 에르다 인식
    if let Some(sol_img) = &regions.sol_erda {
        if let Ok(text) = ocr.recognize(sol_img) {
            // 개수와 게이지 모두 시도
            data.sol_erda_count = parser::parse_sol_erda_count(&text);
            data.sol_erda_gauge = parser::parse_sol_erda_gauge(&text);
        }
    }

    // 솔 에르다 조각 인식
    if let Some(piece_img) = &regions.sol_erda_piece {
        if let Ok(text) = ocr.recognize(piece_img) {
            data.sol_erda_piece = parser::parse_sol_erda_piece(&text);
        }
    }

    Ok(data)
}

/// 두 스크린샷 데이터를 비교하여 사냥 결과 계산
pub fn calculate_hunting_result(
    start: &HuntingScreenshotData,
    end: &HuntingScreenshotData,
) -> Option<HuntingResult> {
    let start_level = start.level.unwrap_or(0);
    let end_level = end.level.unwrap_or(0);
    let start_exp = start.exp_percent.unwrap_or(0.0);
    let end_exp = end.exp_percent.unwrap_or(0.0);

    // 경험치 계산 (레벨업 고려)
    let level_diff = end_level - start_level;
    let exp_gained = if level_diff > 0 {
        (100.0 - start_exp) + ((level_diff - 1) as f64 * 100.0) + end_exp
    } else {
        end_exp - start_exp
    };

    let start_meso = start.meso.unwrap_or(0);
    let end_meso = end.meso.unwrap_or(0);
    let meso_gained = end_meso - start_meso;

    let start_sol = start.sol_erda_count.unwrap_or(0);
    let end_sol = end.sol_erda_count.unwrap_or(0);
    let start_gauge = start.sol_erda_gauge.unwrap_or(0);
    let end_gauge = end.sol_erda_gauge.unwrap_or(0);

    // 솔 에르다 계산 (개수 + 게이지/1000)
    let start_sol_total = start_sol as f64 + (start_gauge as f64 / 1000.0);
    let end_sol_total = end_sol as f64 + (end_gauge as f64 / 1000.0);
    let sol_erda_gained = end_sol_total - start_sol_total;

    let start_piece = start.sol_erda_piece.unwrap_or(0);
    let end_piece = end.sol_erda_piece.unwrap_or(0);
    let piece_gained = end_piece - start_piece;

    Some(HuntingResult {
        start_level,
        end_level,
        start_exp_percent: start_exp,
        end_exp_percent: end_exp,
        exp_gained,
        start_meso,
        end_meso,
        meso_gained,
        start_sol_erda: start_sol,
        end_sol_erda: end_sol,
        start_sol_erda_gauge: start_gauge,
        end_sol_erda_gauge: end_gauge,
        sol_erda_gained,
        start_sol_erda_piece: start_piece,
        end_sol_erda_piece: end_piece,
        sol_erda_piece_gained: piece_gained,
    })
}
