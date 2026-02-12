use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use image::{GenericImageView, imageops::FilterType};

#[cfg(windows)]
use windows::{
    core::HSTRING,
    Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::{FileAccessMode, StorageFile},
    Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
};

#[cfg(windows)]
use std::fs;

/// 스크린샷에서 추출된 사냥 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuntingScreenshotData {
    pub level: Option<i32>,
    pub exp_percent: Option<f64>,
    pub meso: Option<i64>,
    pub sol_erda_count: Option<i32>,
    pub sol_erda_gauge: Option<i32>,
    pub sol_erda_piece: Option<i64>,
}

impl Default for HuntingScreenshotData {
    fn default() -> Self {
        Self {
            level: None,
            exp_percent: None,
            meso: None,
            sol_erda_count: None,
            sol_erda_gauge: None,
            sol_erda_piece: None,
        }
    }
}

/// 이미지 크롭 및 확대
#[cfg(windows)]
fn crop_and_scale_image(image_path: &str, x: u32, y: u32, width: u32, height: u32, scale: f32) -> Result<String> {
    let img = image::open(image_path)
        .map_err(|e| anyhow!("이미지 로드 실패: {}", e))?;

    let (img_width, img_height) = img.dimensions();

    // 경계 체크
    let x = x.min(img_width.saturating_sub(1));
    let y = y.min(img_height.saturating_sub(1));
    let width = width.min(img_width - x);
    let height = height.min(img_height - y);

    // 크롭
    let cropped = img.crop_imm(x, y, width, height);

    // 확대
    let new_width = (width as f32 * scale) as u32;
    let new_height = (height as f32 * scale) as u32;
    let scaled = cropped.resize(new_width, new_height, FilterType::Lanczos3);

    // 임시 파일로 저장
    let temp_dir = std::env::temp_dir();
    let temp_filename = format!("maple_ocr_crop_{}_{}.png", std::process::id(), std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());
    let temp_path = temp_dir.join(&temp_filename);

    scaled.save(&temp_path)
        .map_err(|e| anyhow!("크롭 이미지 저장 실패: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
}

/// 솔 에르다 영역 크롭 OCR
#[cfg(windows)]
pub async fn extract_sol_erda_from_image(image_path: &str) -> Result<(Option<i32>, Option<i32>, Option<i64>)> {
    println!("[OCR] 솔 에르다 영역 OCR 시작");

    let img = image::open(image_path)
        .map_err(|e| anyhow!("이미지 로드 실패: {}", e))?;

    let (width, height) = img.dimensions();
    println!("[OCR] 이미지 크기: {}x{}", width, height);

    // 솔 에르다 UI는 인벤토리 창 오른쪽 상단에 위치
    // 대략 화면의 우측 상단 25% 영역에서 찾음
    let crop_x = (width as f32 * 0.55) as u32;
    let crop_y = (height as f32 * 0.25) as u32;
    let crop_width = (width as f32 * 0.25) as u32;
    let crop_height = (height as f32 * 0.15) as u32;

    println!("[OCR] 솔 에르다 크롭 영역: x={}, y={}, w={}, h={}", crop_x, crop_y, crop_width, crop_height);

    // 크롭 및 3배 확대
    let cropped_path = crop_and_scale_image(image_path, crop_x, crop_y, crop_width, crop_height, 3.0)?;

    // OCR 수행
    let text = extract_text_from_image(&cropped_path).await?;
    println!("[OCR] 솔 에르다 영역 텍스트: {}", text);

    // 임시 파일 삭제
    let _ = fs::remove_file(&cropped_path);

    // 파싱
    let (count, gauge) = parse_sol_erda(&text).unwrap_or((0, 0));
    let piece = parse_sol_erda_piece(&text);

    // 솔 에르다 개수/게이지 추가 패턴
    let count = if count == 0 {
        // 단독 숫자 패턴 (0-20 범위의 숫자)
        let re = regex::Regex::new(r"(?:^|\s)(\d{1,2})(?:\s|$)").ok();
        re.and_then(|r| {
            r.captures_iter(&text)
                .filter_map(|caps| caps.get(1))
                .filter_map(|m| m.as_str().parse::<i32>().ok())
                .find(|&n| n <= 20)
        }).unwrap_or(0)
    } else {
        count
    };

    let gauge = if gauge == 0 {
        // "/1000" 앞의 숫자 또는 단독 3자리 숫자
        let re = regex::Regex::new(r"(\d{1,3})\s*/\s*1000").ok();
        re.and_then(|r| {
            r.captures(&text)
                .and_then(|caps| caps.get(1))
                .and_then(|m| m.as_str().parse::<i32>().ok())
        }).unwrap_or(0)
    } else {
        gauge
    };

    Ok((
        if count > 0 { Some(count) } else { None },
        if gauge > 0 { Some(gauge) } else { None },
        piece
    ))
}

/// 경험치 바 영역 크롭 OCR
#[cfg(windows)]
pub async fn extract_exp_from_image(image_path: &str) -> Result<Option<f64>> {
    println!("[OCR] 경험치 영역 OCR 시작");

    let img = image::open(image_path)
        .map_err(|e| anyhow!("이미지 로드 실패: {}", e))?;

    let (width, height) = img.dimensions();

    // 경험치 바는 화면 하단에 위치
    let crop_x = (width as f32 * 0.3) as u32;
    let crop_y = (height as f32 * 0.92) as u32;
    let crop_width = (width as f32 * 0.4) as u32;
    let crop_height = (height as f32 * 0.08) as u32;

    println!("[OCR] 경험치 크롭 영역: x={}, y={}, w={}, h={}", crop_x, crop_y, crop_width, crop_height);

    // 크롭 및 3배 확대
    let cropped_path = crop_and_scale_image(image_path, crop_x, crop_y, crop_width, crop_height, 3.0)?;

    // OCR 수행
    let text = extract_text_from_image(&cropped_path).await?;
    println!("[OCR] 경험치 영역 텍스트: {}", text);

    // 임시 파일 삭제
    let _ = fs::remove_file(&cropped_path);

    // 파싱
    Ok(parse_exp_percent(&text))
}

/// Windows OCR을 사용하여 이미지에서 텍스트 추출
#[cfg(windows)]
pub async fn extract_text_from_image(image_path: &str) -> Result<String> {
    println!("[OCR] extract_text_from_image 시작: {}", image_path);

    let path = Path::new(image_path);
    if !path.exists() {
        println!("[OCR] 파일 없음: {}", image_path);
        return Err(anyhow!("이미지 파일을 찾을 수 없습니다: {}", image_path));
    }

    // 한글 경로 문제 해결: 임시 파일로 복사
    let temp_dir = std::env::temp_dir();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
    let temp_filename = format!("maple_ocr_temp_{}.{}", std::process::id(), ext);
    let temp_path = temp_dir.join(&temp_filename);
    let temp_path_str = temp_path.to_string_lossy().to_string();

    println!("[OCR] 임시 파일로 복사: {} -> {}", image_path, temp_path_str);

    // 파일 복사
    if let Err(e) = fs::copy(image_path, &temp_path) {
        println!("[OCR] 파일 복사 실패: {}", e);
        return Err(anyhow!("파일 복사 실패: {}", e));
    }
    println!("[OCR] 파일 복사 완료");

    // 동기 작업을 별도 스레드에서 실행 (UI 블로킹 방지)
    println!("[OCR] spawn_blocking 시작");
    let result = tokio::task::spawn_blocking(move || -> Result<String> {
        // COM 초기화 (Windows API 사용을 위해 필요)
        println!("[OCR] COM 초기화 시작");
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            if hr.is_err() {
                // 이미 초기화된 경우는 무시 (S_FALSE = 0x00000001)
                if hr.0 != 0x00000001 {
                    println!("[OCR] COM 초기화 실패: {:?}", hr);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("COM 초기화 실패"));
                }
            }
        }
        println!("[OCR] COM 초기화 완료");

        println!("[OCR] 파일 열기 시작: {}", temp_path_str);

        // 파일 열기
        let file = match StorageFile::GetFileFromPathAsync(&HSTRING::from(&temp_path_str)) {
            Ok(op) => match op.get() {
                Ok(f) => f,
                Err(e) => {
                    println!("[OCR] 파일 열기 실패 (get): {}", e);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("파일 열기 실패: {}", e));
                }
            },
            Err(e) => {
                println!("[OCR] 파일 열기 실패 (async): {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("파일 열기 실패: {}", e));
            }
        };
        println!("[OCR] 파일 열기 완료");

        // 이미지 디코더로 열기
        println!("[OCR] 스트림 열기 시작");
        let stream = match file.OpenAsync(FileAccessMode::Read) {
            Ok(op) => match op.get() {
                Ok(s) => s,
                Err(e) => {
                    println!("[OCR] 스트림 열기 실패 (get): {}", e);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("스트림 열기 실패: {}", e));
                }
            },
            Err(e) => {
                println!("[OCR] 스트림 열기 실패 (async): {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("스트림 열기 실패: {}", e));
            }
        };
        println!("[OCR] 스트림 열기 완료");

        println!("[OCR] 디코더 생성 시작");
        let decoder = match BitmapDecoder::CreateAsync(&stream) {
            Ok(op) => match op.get() {
                Ok(d) => d,
                Err(e) => {
                    println!("[OCR] 디코더 생성 실패 (get): {}", e);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("디코더 생성 실패: {}", e));
                }
            },
            Err(e) => {
                println!("[OCR] 디코더 생성 실패 (async): {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("디코더 생성 실패: {}", e));
            }
        };
        println!("[OCR] 디코더 생성 완료");

        // SoftwareBitmap으로 변환 (Gray8 포맷으로 변환하여 OCR 호환성 향상)
        println!("[OCR] 비트맵 변환 시작");
        let bitmap = match decoder.GetSoftwareBitmapAsync() {
            Ok(op) => match op.get() {
                Ok(b) => {
                    // OCR이 지원하는 형식으로 변환
                    match SoftwareBitmap::Convert(&b, BitmapPixelFormat::Gray8) {
                        Ok(converted) => converted,
                        Err(_) => b, // 변환 실패 시 원본 사용
                    }
                },
                Err(e) => {
                    println!("[OCR] 비트맵 변환 실패 (get): {}", e);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("비트맵 변환 실패: {}", e));
                }
            },
            Err(e) => {
                println!("[OCR] 비트맵 변환 실패 (async): {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("비트맵 변환 실패: {}", e));
            }
        };
        println!("[OCR] 비트맵 변환 완료");

        // OCR 엔진 생성 (한국어 우선, 없으면 기본)
        println!("[OCR] OCR 엔진 생성 시작");
        let engine = match OcrEngine::TryCreateFromUserProfileLanguages() {
            Ok(e) => e,
            Err(e) => {
                println!("[OCR] OCR 엔진 생성 실패: {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("OCR 엔진 생성 실패: {}", e));
            }
        };
        println!("[OCR] OCR 엔진 생성 완료");

        // OCR 실행
        println!("[OCR] OCR 인식 시작");
        let result = match engine.RecognizeAsync(&bitmap) {
            Ok(op) => match op.get() {
                Ok(r) => r,
                Err(e) => {
                    println!("[OCR] OCR 인식 실패 (get): {}", e);
                    let _ = fs::remove_file(&temp_path);
                    return Err(anyhow!("OCR 인식 실패: {}", e));
                }
            },
            Err(e) => {
                println!("[OCR] OCR 인식 실패 (async): {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("OCR 인식 실패: {}", e));
            }
        };
        println!("[OCR] OCR 인식 완료");

        let text = match result.Text() {
            Ok(t) => t.to_string(),
            Err(e) => {
                println!("[OCR] 텍스트 추출 실패: {}", e);
                let _ = fs::remove_file(&temp_path);
                return Err(anyhow!("텍스트 추출 실패: {}", e));
            }
        };
        println!("[OCR] 텍스트 추출 완료, 길이: {}", text.len());

        // 임시 파일 삭제
        let _ = fs::remove_file(&temp_path);

        // COM 해제
        unsafe {
            CoUninitialize();
        }

        Ok(text)
    }).await.map_err(|e| {
        println!("[OCR] spawn_blocking 실패: {}", e);
        anyhow!("OCR 작업 실행 실패: {}", e)
    })??;

    println!("[OCR] extract_text_from_image 완료");
    Ok(result)
}

#[cfg(not(windows))]
pub async fn extract_text_from_image(_image_path: &str) -> Result<String> {
    Err(anyhow!("OCR은 Windows에서만 지원됩니다"))
}

/// 추출된 텍스트에서 사냥 정보 파싱
pub fn parse_hunting_data(text: &str) -> HuntingScreenshotData {
    let mut data = HuntingScreenshotData::default();

    // 레벨 파싱: "Lv.287" 또는 "LV.287" 또는 "Lv 287"
    if let Some(level) = parse_level(text) {
        data.level = Some(level);
    }

    // 경험치 파싱: "24.394%" 또는 "24.394 %"
    if let Some(exp) = parse_exp_percent(text) {
        data.exp_percent = Some(exp);
    }

    // 메소 파싱: "29억 1300만 9385" 또는 "2,913,009,385"
    if let Some(meso) = parse_meso(text) {
        data.meso = Some(meso);
    }

    // 솔 에르다 파싱 (개수와 게이지)
    if let Some((count, gauge)) = parse_sol_erda(text) {
        data.sol_erda_count = Some(count);
        data.sol_erda_gauge = Some(gauge);
    }

    // 솔 에르다 조각 파싱
    if let Some(piece) = parse_sol_erda_piece(text) {
        data.sol_erda_piece = Some(piece);
    }

    data
}

/// 레벨 파싱
fn parse_level(text: &str) -> Option<i32> {
    // "Lv.287", "LV.287", "LⅥ287", "Lv 287" 등 다양한 패턴
    // OCR이 "Lv"를 "LⅥ", "LVI", "Lⅴ" 등으로 인식할 수 있음
    let patterns = [
        r"(?i)L[vⅥⅤVI]+\.?\s*(\d{2,3})",  // LⅥ287, Lv.287, LV287
        r"(?i)Lv\.?\s*(\d{2,3})",           // Lv.287, Lv 287
        r"레벨\s*(\d{2,3})",                 // 레벨 287
    ];

    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(level) = m.as_str().parse::<i32>() {
                        if level >= 200 && level <= 300 {
                            return Some(level);
                        }
                    }
                }
            }
        }
    }
    None
}

/// 경험치 퍼센트 파싱
fn parse_exp_percent(text: &str) -> Option<f64> {
    // 패턴 1: "24.394%" - 소수점 포함
    let re = regex::Regex::new(r"(\d+\.\d+)\s*%").ok()?;
    for caps in re.captures_iter(text) {
        if let Some(m) = caps.get(1) {
            if let Ok(exp) = m.as_str().parse::<f64>() {
                // 경험치는 보통 0~100 범위
                if exp >= 0.0 && exp < 100.0 {
                    return Some(exp);
                }
            }
        }
    }

    // 패턴 2: "24%" - 정수만 있는 경우
    let re_int = regex::Regex::new(r"(\d{1,2})\s*%").ok()?;
    for caps in re_int.captures_iter(text) {
        if let Some(m) = caps.get(1) {
            if let Ok(exp) = m.as_str().parse::<f64>() {
                if exp >= 0.0 && exp < 100.0 {
                    return Some(exp);
                }
            }
        }
    }

    // 패턴 3: "EXP" 또는 "경험치" 근처의 숫자
    let patterns = [
        r"(?i)EXP[:\s]*(\d+\.?\d*)",
        r"경험치[:\s]*(\d+\.?\d*)",
    ];
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(exp) = m.as_str().parse::<f64>() {
                        if exp >= 0.0 && exp < 100.0 {
                            return Some(exp);
                        }
                    }
                }
            }
        }
    }

    None
}

/// 메소 파싱
fn parse_meso(text: &str) -> Option<i64> {
    // OCR이 "억"을 "역", "의", " " 등으로 인식할 수 있음
    // 패턴: "29억 1309만 9366", "29 역 1309 만 9366", "26 7758 만 6006" (억 누락)

    // 패턴 1: 억/역/의가 있는 경우
    let patterns_with_eok = [
        r"(\d{1,2})\s*[억역의]\s*(\d{1,4})\s*만\s*(\d{1,4})",  // 29억 1309만 9366
        r"(\d{1,2})\s*[억역의]\s*(\d{1,4})\s*만",              // 29억 1309만
    ];

    for (idx, pattern) in patterns_with_eok.iter().enumerate() {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                let billion: i64 = caps.get(1)?.as_str().parse().ok()?;
                let million: i64 = caps.get(2)?.as_str().parse().ok()?;

                if idx == 0 {
                    let remainder: i64 = caps.get(3)?.as_str().parse().ok()?;
                    return Some(billion * 100_000_000 + million * 10_000 + remainder);
                } else {
                    return Some(billion * 100_000_000 + million * 10_000);
                }
            }
        }
    }

    // 패턴 2: "억"이 누락된 경우 - "26 7758 만 6006" (숫자 숫자 만 숫자)
    // 첫 번째 숫자가 1-2자리(억), 두 번째 숫자가 1-4자리(만), "만" 뒤에 숫자(나머지)
    if let Ok(re) = regex::Regex::new(r"(\d{1,2})\s+(\d{1,4})\s*만\s*(\d{1,4})") {
        if let Some(caps) = re.captures(text) {
            let billion: i64 = caps.get(1)?.as_str().parse().ok()?;
            let million: i64 = caps.get(2)?.as_str().parse().ok()?;
            let remainder: i64 = caps.get(3)?.as_str().parse().ok()?;

            // 억 단위가 합리적인지 확인 (10억 ~ 99억 정도)
            if billion >= 1 && billion <= 99 && million >= 0 && million <= 9999 {
                return Some(billion * 100_000_000 + million * 10_000 + remainder);
            }
        }
    }

    // 콤마 구분 숫자 패턴: "2,913,009,385"
    let re_comma = regex::Regex::new(r"(\d{1,3}(?:,\d{3})+)").ok()?;
    for caps in re_comma.captures_iter(text) {
        if let Some(m) = caps.get(1) {
            let num_str = m.as_str().replace(",", "");
            if let Ok(meso) = num_str.parse::<i64>() {
                if meso >= 100_000_000 {
                    return Some(meso);
                }
            }
        }
    }

    None
}

/// 솔 에르다 개수와 게이지 파싱
fn parse_sol_erda(text: &str) -> Option<(i32, i32)> {
    // 패턴 1: "19 348/1000" 또는 "19개 348/1000"
    let re = regex::Regex::new(r"(\d{1,2})\s*(?:개)?\s*(\d{1,3})\s*/\s*1000").ok()?;
    if let Some(caps) = re.captures(text) {
        let count: i32 = caps.get(1)?.as_str().parse().ok()?;
        let gauge: i32 = caps.get(2)?.as_str().parse().ok()?;
        if count <= 20 && gauge <= 1000 {
            return Some((count, gauge));
        }
    }

    // 패턴 2: "솔 에르다" 또는 "Sol Erda" 근처에서 숫자 찾기
    let sol_erda_patterns = [
        r"(?i)솔\s*에르다[:\s]*(\d{1,2})\s*(?:개)?",
        r"(?i)Sol\s*Erda[:\s]*(\d{1,2})",
        r"(?i)에르다[:\s]*(\d{1,2})\s*(?:개)?",
    ];
    let mut count: Option<i32> = None;
    for pattern in sol_erda_patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(c) = m.as_str().parse::<i32>() {
                        if c <= 20 {
                            count = Some(c);
                            break;
                        }
                    }
                }
            }
        }
    }

    // 게이지 패턴: "348/1000", "348 / 1000"
    let gauge_patterns = [
        r"(\d{1,3})\s*/\s*1,?000",
        r"(\d{1,3})\s*/\s*1000",
    ];
    let mut gauge: Option<i32> = None;
    for pattern in gauge_patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(g) = m.as_str().parse::<i32>() {
                        if g <= 1000 {
                            gauge = Some(g);
                            break;
                        }
                    }
                }
            }
        }
    }

    // 개수와 게이지 중 하나라도 있으면 반환
    if count.is_some() || gauge.is_some() {
        return Some((count.unwrap_or(0), gauge.unwrap_or(0)));
    }

    None
}

/// 솔 에르다 조각 파싱
fn parse_sol_erda_piece(text: &str) -> Option<i64> {
    // 다양한 패턴으로 솔 에르다 조각 파싱
    let patterns = [
        // "조각" 뒤에 숫자
        r"조각[:\s]*(\d+)",
        // 숫자 뒤에 "조각"
        r"(\d+)\s*조각",
        // "솔 에르다 조각" 근처 숫자
        r"솔\s*에르다\s*조각[:\s]*(\d+)",
        r"에르다\s*조각[:\s]*(\d+)",
        // "Fragment" 패턴 (영어)
        r"(?i)fragment[:\s]*(\d+)",
        r"(?i)(\d+)\s*fragment",
    ];

    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(piece) = m.as_str().parse::<i64>() {
                        // 조각 수는 일반적으로 0~9999 범위
                        if piece >= 0 && piece <= 99999 {
                            return Some(piece);
                        }
                    }
                }
            }
        }
    }

    // "조각" 키워드가 있는 줄에서 숫자 찾기
    for line in text.lines() {
        if line.contains("조각") {
            if let Ok(re) = regex::Regex::new(r"(\d+)") {
                if let Some(caps) = re.captures(line) {
                    if let Some(m) = caps.get(1) {
                        if let Ok(piece) = m.as_str().parse::<i64>() {
                            if piece >= 0 && piece <= 99999 {
                                return Some(piece);
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

/// 두 스크린샷을 비교하여 사냥 결과 계산
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
        // 레벨업한 경우: (100 - 시작%) + (레벨업 횟수 - 1) * 100 + 종료%
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
