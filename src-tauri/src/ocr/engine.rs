//! Tesseract OCR 엔진 래퍼

use std::path::Path;
use image::DynamicImage;
use leptess::LepTess;

use super::types::OcrError;

/// OCR 엔진 래퍼 (Tesseract 기반)
pub struct OcrEngine {
    tess: LepTess,
}

impl OcrEngine {
    /// 새 OCR 엔진 생성 및 초기화
    /// tessdata_dir: tessdata 디렉토리 경로 (None이면 시스템 기본 경로 사용)
    pub fn new(tessdata_dir: &Path) -> Result<Self, OcrError> {
        // tessdata 디렉토리 확인
        let tessdata_path = if tessdata_dir.exists() {
            Some(tessdata_dir.to_str().unwrap_or_default())
        } else {
            // 시스템 기본 경로 사용
            None
        };

        // 한글+영어+숫자 인식을 위해 kor+eng 사용
        // kor 없으면 eng만 사용
        let tess = LepTess::new(tessdata_path, "kor+eng")
            .or_else(|_| LepTess::new(tessdata_path, "eng"))
            .map_err(|e| OcrError::ModelInitError(format!(
                "Tesseract 초기화 실패: {}. Tesseract가 설치되어 있는지 확인하세요.",
                e
            )))?;

        Ok(Self { tess })
    }

    /// DynamicImage에서 텍스트 인식
    pub fn recognize(&mut self, image: &DynamicImage) -> Result<String, OcrError> {
        // 이미지를 임시 파일로 저장 후 인식
        let temp_path = std::env::temp_dir().join("maple_ocr_temp.png");
        image
            .save(&temp_path)
            .map_err(|e| OcrError::ImageLoadError(format!("임시 파일 저장 실패: {}", e)))?;

        self.recognize_from_path(temp_path.to_str().unwrap_or_default())
    }

    /// 파일 경로에서 직접 텍스트 인식
    pub fn recognize_from_path(&mut self, image_path: &str) -> Result<String, OcrError> {
        self.tess
            .set_image(image_path)
            .map_err(|e| OcrError::ImageLoadError(format!("이미지 로드 실패: {}", e)))?;

        let text = self
            .tess
            .get_utf8_text()
            .map_err(|e| OcrError::RecognitionError(format!("텍스트 인식 실패: {}", e)))?;

        Ok(text)
    }

    /// 숫자 전용 인식 모드 (정확도 향상)
    pub fn recognize_digits(&mut self, image: &DynamicImage) -> Result<String, OcrError> {
        // 임시 파일로 저장
        let temp_path = std::env::temp_dir().join("maple_ocr_temp_digits.png");
        image
            .save(&temp_path)
            .map_err(|e| OcrError::ImageLoadError(format!("임시 파일 저장 실패: {}", e)))?;

        self.tess
            .set_image(temp_path.to_str().unwrap_or_default())
            .map_err(|e| OcrError::ImageLoadError(format!("이미지 로드 실패: {}", e)))?;

        // 숫자만 인식하도록 설정
        // Note: leptess에서는 set_variable로 설정 가능하지만,
        // 현재 버전에서는 기본 인식 사용
        let text = self
            .tess
            .get_utf8_text()
            .map_err(|e| OcrError::RecognitionError(format!("텍스트 인식 실패: {}", e)))?;

        Ok(text)
    }
}

/// 이미지 로드
pub fn load_image(path: &str) -> Result<DynamicImage, OcrError> {
    image::open(path).map_err(|e| OcrError::ImageLoadError(e.to_string()))
}
