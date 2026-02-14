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

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterListResponse {
    pub account_list: Vec<AccountInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountInfo {
    pub account_id: String,
    pub character_list: Vec<CharacterListItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharacterListItem {
    pub ocid: String,
    pub character_name: String,
    pub world_name: String,
    pub character_class: String,
    pub character_level: i32,
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

    async fn parse_error_response(response: reqwest::Response) -> ApiError {
        let error_response: ApiErrorResponse = response.json().await.unwrap_or(ApiErrorResponse { error: None });
        match error_response.error {
            Some(error) => ApiError::ApiError(error.message),
            None => ApiError::ApiError("Unknown error".to_string()),
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
            match error_response.error {
                Some(error) if error.name == "OPENAPI00004" => Err(ApiError::CharacterNotFound),
                Some(error) => Err(ApiError::ApiError(error.message)),
                None => Err(ApiError::CharacterNotFound),
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
            Err(Self::parse_error_response(response).await)
        }
    }

    pub async fn get_character_list(&self) -> Result<Vec<CharacterListItem>, ApiError> {
        let url = format!("{}/character/list", MAPLE_API_BASE);

        let response = self
            .client
            .get(&url)
            .header("x-nxopen-api-key", &self.api_key)
            .send()
            .await?;

        if response.status().is_success() {
            let list_response: CharacterListResponse = response.json().await?;
            let characters: Vec<CharacterListItem> = list_response
                .account_list
                .into_iter()
                .flat_map(|account| account.character_list)
                .collect();
            Ok(characters)
        } else {
            Err(Self::parse_error_response(response).await)
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
            Err(Self::parse_error_response(response).await)
        }
    }

}
