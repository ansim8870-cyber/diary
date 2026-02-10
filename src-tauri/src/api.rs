use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

const MAPLE_API_BASE: &str = "https://open.api.nexon.com/maplestory/v1";

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("HTTP 요청 실패: {0}")]
    RequestError(#[from] reqwest::Error),
    #[error("API 오류: {0}")]
    ApiError(String),
    #[error("캐릭터를 찾을 수 없습니다")]
    CharacterNotFound,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcidResponse {
    pub ocid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterBasic {
    pub character_name: String,
    pub world_name: String,
    pub character_gender: String,
    pub character_class: String,
    pub character_class_level: String,
    pub character_level: i32,
    pub character_exp: i64,
    pub character_exp_rate: String,
    pub character_guild_name: Option<String>,
    pub character_image: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiErrorResponse {
    pub error: Option<ApiErrorDetail>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiErrorDetail {
    pub name: String,
    pub message: String,
}

pub struct MapleApi {
    client: Client,
    api_key: String,
}

impl MapleApi {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(),
            api_key: api_key.to_string(),
        }
    }

    pub async fn get_ocid(&self, character_name: &str) -> Result<String, ApiError> {
        let url = format!("{}/id", MAPLE_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("x-nxopen-api-key", &self.api_key)
            .query(&[("character_name", character_name)])
            .send()
            .await?;

        if response.status().is_success() {
            let ocid_response: OcidResponse = response.json().await?;
            Ok(ocid_response.ocid)
        } else {
            let error_response: ApiErrorResponse = response.json().await.unwrap_or(ApiErrorResponse { error: None });
            if let Some(error) = error_response.error {
                if error.name == "OPENAPI00004" {
                    return Err(ApiError::CharacterNotFound);
                }
                Err(ApiError::ApiError(error.message))
            } else {
                Err(ApiError::CharacterNotFound)
            }
        }
    }

    pub async fn get_character_basic(&self, ocid: &str) -> Result<CharacterBasic, ApiError> {
        let url = format!("{}/character/basic", MAPLE_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("x-nxopen-api-key", &self.api_key)
            .query(&[("ocid", ocid)])
            .send()
            .await?;

        if response.status().is_success() {
            let character: CharacterBasic = response.json().await?;
            Ok(character)
        } else {
            let error_response: ApiErrorResponse = response.json().await.unwrap_or(ApiErrorResponse { error: None });
            if let Some(error) = error_response.error {
                Err(ApiError::ApiError(error.message))
            } else {
                Err(ApiError::ApiError("Unknown error".to_string()))
            }
        }
    }

    // 특정 날짜의 캐릭터 정보 조회
    pub async fn get_character_basic_by_date(&self, ocid: &str, date: &str) -> Result<CharacterBasic, ApiError> {
        let url = format!("{}/character/basic", MAPLE_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("x-nxopen-api-key", &self.api_key)
            .query(&[("ocid", ocid), ("date", date)])
            .send()
            .await?;

        if response.status().is_success() {
            let character: CharacterBasic = response.json().await?;
            Ok(character)
        } else {
            let error_response: ApiErrorResponse = response.json().await.unwrap_or(ApiErrorResponse { error: None });
            if let Some(error) = error_response.error {
                Err(ApiError::ApiError(error.message))
            } else {
                Err(ApiError::ApiError("Unknown error".to_string()))
            }
        }
    }

    pub async fn search_character(&self, character_name: &str) -> Result<CharacterBasic, ApiError> {
        let ocid = self.get_ocid(character_name).await?;
        self.get_character_basic(&ocid).await
    }
}
