//! 템플릿 매칭으로 아이콘 위치 탐지

use std::path::Path;
use image::{DynamicImage, GrayImage, imageops::FilterType};
use imageproc::template_matching::{match_template, MatchTemplateMethod, Extremes, find_extremes};

use super::types::{IconPositions, CroppedRegions, OcrError};

/// 매칭 신뢰도 임계값
const MATCH_THRESHOLD: f32 = 0.5;

/// 검색 속도를 위한 스케일 (4 = 1/4 크기로 축소)
const SEARCH_SCALE: u32 = 4;

/// 이미지를 그레이스케일로 변환
fn to_grayscale(image: &DynamicImage) -> GrayImage {
    image.to_luma8()
}

/// 이미지를 축소
fn scale_down(image: &DynamicImage, scale: u32) -> DynamicImage {
    let new_width = image.width() / scale;
    let new_height = image.height() / scale;
    image.resize(new_width, new_height, FilterType::Triangle)
}

/// 특정 영역에서만 템플릿 매칭 (속도 최적화)
fn find_icon_in_region(
    image: &DynamicImage,
    template: &DynamicImage,
    search_region: Option<(u32, u32, u32, u32)>,  // (x, y, width, height)
) -> Option<(u32, u32)> {
    // 검색 영역 크롭 (없으면 전체 이미지)
    let search_image = if let Some((x, y, w, h)) = search_region {
        image.crop_imm(x, y, w.min(image.width() - x), h.min(image.height() - y))
    } else {
        image.clone()
    };

    // 축소하여 검색 (속도 향상)
    let scaled_image = scale_down(&search_image, SEARCH_SCALE);
    let scaled_template = scale_down(template, SEARCH_SCALE);

    let gray_image = to_grayscale(&scaled_image);
    let gray_template = to_grayscale(&scaled_template);

    // 템플릿이 이미지보다 크면 실패
    if gray_template.width() >= gray_image.width() || gray_template.height() >= gray_image.height() {
        return None;
    }

    let result = match_template(
        &gray_image,
        &gray_template,
        MatchTemplateMethod::CrossCorrelationNormalized,
    );

    let extremes: Extremes<f32> = find_extremes(&result);

    // 매칭 신뢰도 체크
    if extremes.max_value > MATCH_THRESHOLD {
        // 원본 좌표로 변환
        let (sx, sy) = extremes.max_value_location;
        let (offset_x, offset_y) = search_region.map(|(x, y, _, _)| (x, y)).unwrap_or((0, 0));
        Some((sx * SEARCH_SCALE + offset_x, sy * SEARCH_SCALE + offset_y))
    } else {
        None
    }
}

/// 모든 아이콘 위치 탐지
pub fn find_all_icons(
    image: &DynamicImage,
    templates_dir: &Path,
) -> Result<IconPositions, OcrError> {
    let mut positions = IconPositions::default();
    let (width, height) = (image.width(), image.height());

    // 메소 아이콘 - 우상단 영역에서 검색 (인벤토리 또는 스탯창)
    let meso_template_path = templates_dir.join("meso_icon.png");
    if meso_template_path.exists() {
        if let Ok(template) = image::open(&meso_template_path) {
            // 우측 절반, 상단 2/3 영역에서 검색
            let search_region = Some((width / 2, 0, width / 2, height * 2 / 3));
            positions.meso = find_icon_in_region(image, &template, search_region);
        }
    }

    // 솔 에르다 아이콘 - 이동 가능 창이므로 전체 검색 (축소된 이미지)
    let sol_erda_template_path = templates_dir.join("sol_erda_icon.png");
    if sol_erda_template_path.exists() {
        if let Ok(template) = image::open(&sol_erda_template_path) {
            // 전체 화면에서 검색 (축소 후)
            positions.sol_erda = find_icon_in_region(image, &template, None);
        }
    }

    // 솔 에르다 조각 아이콘 - 솔 에르다 찾았으면 그 주변에서 검색
    let piece_template_path = templates_dir.join("sol_erda_piece_icon.png");
    if piece_template_path.exists() {
        if let Ok(template) = image::open(&piece_template_path) {
            // 솔 에르다를 찾았으면 그 오른쪽 영역에서 검색
            let search_region = if let Some((sol_x, sol_y)) = positions.sol_erda {
                // 솔 에르다 우측 300px 영역
                Some((sol_x, sol_y.saturating_sub(50), 400, 200))
            } else {
                // 못 찾았으면 전체 검색
                None
            };
            positions.sol_erda_piece = find_icon_in_region(image, &template, search_region);
        }
    }

    Ok(positions)
}

/// 이미지 크기 정보
struct ImageDimensions {
    width: u32,
    height: u32,
}

/// 해상도별 영역 좌표 설정
struct RegionConfig {
    /// 레벨 영역 (좌측 하단)
    level: (u32, u32, u32, u32),  // (x, y, width, height)
    /// 경험치 바 영역 (하단)
    exp_bar: (u32, u32, u32, u32),
    /// 메소 아이콘 기준 텍스트 오프셋
    meso_offset: (i32, i32, u32, u32),  // (x_offset, y_offset, width, height)
    /// 솔 에르다 아이콘 기준 텍스트 오프셋
    sol_erda_offset: (i32, i32, u32, u32),
    /// 솔 에르다 조각 아이콘 기준 텍스트 오프셋
    sol_erda_piece_offset: (i32, i32, u32, u32),
}

/// 해상도에 따른 설정 가져오기
fn get_region_config(dims: &ImageDimensions) -> RegionConfig {
    // 기본 설정 (1920x1080 기준)
    let base_config = RegionConfig {
        level: (10, dims.height - 50, 150, 40),
        exp_bar: (dims.width / 4, dims.height - 30, dims.width / 2, 25),
        meso_offset: (60, -5, 250, 35),
        sol_erda_offset: (0, 60, 80, 30),
        sol_erda_piece_offset: (0, 60, 100, 30),
    };

    // 해상도에 따른 스케일링
    let scale_x = dims.width as f32 / 1920.0;
    let scale_y = dims.height as f32 / 1080.0;

    RegionConfig {
        level: (
            (base_config.level.0 as f32 * scale_x) as u32,
            (base_config.level.1 as f32 * scale_y) as u32,
            (base_config.level.2 as f32 * scale_x) as u32,
            (base_config.level.3 as f32 * scale_y) as u32,
        ),
        exp_bar: (
            (base_config.exp_bar.0 as f32 * scale_x) as u32,
            (base_config.exp_bar.1 as f32 * scale_y) as u32,
            (base_config.exp_bar.2 as f32 * scale_x) as u32,
            (base_config.exp_bar.3 as f32 * scale_y) as u32,
        ),
        meso_offset: (
            (base_config.meso_offset.0 as f32 * scale_x) as i32,
            (base_config.meso_offset.1 as f32 * scale_y) as i32,
            (base_config.meso_offset.2 as f32 * scale_x) as u32,
            (base_config.meso_offset.3 as f32 * scale_y) as u32,
        ),
        sol_erda_offset: (
            (base_config.sol_erda_offset.0 as f32 * scale_x) as i32,
            (base_config.sol_erda_offset.1 as f32 * scale_y) as i32,
            (base_config.sol_erda_offset.2 as f32 * scale_x) as u32,
            (base_config.sol_erda_offset.3 as f32 * scale_y) as u32,
        ),
        sol_erda_piece_offset: (
            (base_config.sol_erda_piece_offset.0 as f32 * scale_x) as i32,
            (base_config.sol_erda_piece_offset.1 as f32 * scale_y) as i32,
            (base_config.sol_erda_piece_offset.2 as f32 * scale_x) as u32,
            (base_config.sol_erda_piece_offset.3 as f32 * scale_y) as u32,
        ),
    }
}

/// 안전한 크롭 (이미지 경계 체크)
fn safe_crop(
    image: &DynamicImage,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Option<DynamicImage> {
    let img_width = image.width() as i32;
    let img_height = image.height() as i32;

    // 경계 체크
    if x < 0 || y < 0 {
        return None;
    }
    if x + width as i32 > img_width || y + height as i32 > img_height {
        return None;
    }

    Some(image.crop_imm(x as u32, y as u32, width, height))
}

/// 아이콘 위치 기준으로 텍스트 영역 크롭
pub fn crop_regions(
    image: &DynamicImage,
    positions: &IconPositions,
) -> Result<CroppedRegions, OcrError> {
    let dims = ImageDimensions {
        width: image.width(),
        height: image.height(),
    };
    let config = get_region_config(&dims);
    let mut regions = CroppedRegions::default();

    // 레벨 영역 (고정 위치)
    regions.level = safe_crop(
        image,
        config.level.0 as i32,
        config.level.1 as i32,
        config.level.2,
        config.level.3,
    );

    // 경험치 바 영역 (고정 위치)
    regions.exp = safe_crop(
        image,
        config.exp_bar.0 as i32,
        config.exp_bar.1 as i32,
        config.exp_bar.2,
        config.exp_bar.3,
    );

    // 메소 영역 (아이콘 위치 기준)
    if let Some((x, y)) = positions.meso {
        regions.meso = safe_crop(
            image,
            x as i32 + config.meso_offset.0,
            y as i32 + config.meso_offset.1,
            config.meso_offset.2,
            config.meso_offset.3,
        );
    }

    // 솔 에르다 영역 (아이콘 위치 기준)
    if let Some((x, y)) = positions.sol_erda {
        regions.sol_erda = safe_crop(
            image,
            x as i32 + config.sol_erda_offset.0,
            y as i32 + config.sol_erda_offset.1,
            config.sol_erda_offset.2,
            config.sol_erda_offset.3,
        );
    }

    // 솔 에르다 조각 영역 (아이콘 위치 기준)
    if let Some((x, y)) = positions.sol_erda_piece {
        regions.sol_erda_piece = safe_crop(
            image,
            x as i32 + config.sol_erda_piece_offset.0,
            y as i32 + config.sol_erda_piece_offset.1,
            config.sol_erda_piece_offset.2,
            config.sol_erda_piece_offset.3,
        );
    }

    Ok(regions)
}
