//! OCR 결과 텍스트 파싱

use regex::Regex;

/// 레벨 파싱: "Lv.287", "LV287", "Lv 287" 등
pub fn parse_level(text: &str) -> Option<i32> {
    let re = Regex::new(r"[Ll][Vv]\.?\s*(\d+)").ok()?;
    re.captures(text)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
}

/// 경험치 파싱: "67.432%", "67.432 %", "67%" 등
pub fn parse_exp(text: &str) -> Option<f64> {
    // 소수점 포함 퍼센트
    let re = Regex::new(r"(\d+\.?\d*)\s*%").ok()?;
    re.captures(text)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
}

/// 메소 파싱: "25억 2758만 6086" → 2527586086
pub fn parse_meso(text: &str) -> Option<i64> {
    // 오타 처리: 역 → 억
    let text = text.replace("역", "억");
    let text = text.replace(",", "");

    let mut total: i64 = 0;
    let mut found = false;

    // 억 단위
    if let Some(caps) = Regex::new(r"(\d+)\s*억").ok()?.captures(&text) {
        if let Ok(n) = caps[1].parse::<i64>() {
            total += n * 100_000_000;
            found = true;
        }
    }

    // 만 단위
    if let Some(caps) = Regex::new(r"(\d+)\s*만").ok()?.captures(&text) {
        if let Ok(n) = caps[1].parse::<i64>() {
            total += n * 10_000;
            found = true;
        }
    }

    // 일 단위 (만 뒤에 오는 숫자 또는 단독 숫자)
    // "25억 2758만 6086" 에서 6086 추출
    if let Some(caps) = Regex::new(r"만\s*(\d+)").ok()?.captures(&text) {
        if let Ok(n) = caps[1].parse::<i64>() {
            total += n;
            found = true;
        }
    } else if !found {
        // 억/만 없이 순수 숫자만 있는 경우
        if let Some(caps) = Regex::new(r"^[\s]*(\d+)[\s]*$").ok()?.captures(&text) {
            if let Ok(n) = caps[1].parse::<i64>() {
                return Some(n);
            }
        }
    }

    if found { Some(total) } else { None }
}

/// 솔 에르다 개수 파싱: "19", "0" 등 (0-20 범위)
pub fn parse_sol_erda_count(text: &str) -> Option<i32> {
    let re = Regex::new(r"(\d{1,2})").ok()?;
    re.captures(text.trim())
        .and_then(|c| c[1].parse().ok())
        .filter(|&n: &i32| n >= 0 && n <= 20)
}

/// 솔 에르다 게이지 파싱: "348/1000", "348 / 1000" 등
pub fn parse_sol_erda_gauge(text: &str) -> Option<i32> {
    let re = Regex::new(r"(\d+)\s*/\s*1000").ok()?;
    re.captures(text)
        .and_then(|c| c[1].parse().ok())
        .filter(|&n: &i32| n >= 0 && n < 1000)
}

/// 솔 에르다 조각 파싱: 순수 숫자
pub fn parse_sol_erda_piece(text: &str) -> Option<i64> {
    let cleaned = text.trim().replace(",", "");
    cleaned.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_level() {
        assert_eq!(parse_level("Lv.287"), Some(287));
        assert_eq!(parse_level("LV287"), Some(287));
        assert_eq!(parse_level("Lv 300"), Some(300));
        assert_eq!(parse_level("lv.250 규빅"), Some(250));
        assert_eq!(parse_level("invalid"), None);
    }

    #[test]
    fn test_parse_exp() {
        assert_eq!(parse_exp("67.432%"), Some(67.432));
        assert_eq!(parse_exp("67.432 %"), Some(67.432));
        assert_eq!(parse_exp("50%"), Some(50.0));
        assert_eq!(parse_exp("invalid"), None);
    }

    #[test]
    fn test_parse_meso() {
        assert_eq!(parse_meso("25억 2758만 6086"), Some(2527586086));
        assert_eq!(parse_meso("25역 2758만 6086"), Some(2527586086)); // 오타 처리
        assert_eq!(parse_meso("1억"), Some(100000000));
        assert_eq!(parse_meso("5000만"), Some(50000000));
        assert_eq!(parse_meso("1234"), Some(1234));
        assert_eq!(parse_meso("invalid"), None);
    }

    #[test]
    fn test_parse_sol_erda_count() {
        assert_eq!(parse_sol_erda_count("19"), Some(19));
        assert_eq!(parse_sol_erda_count("0"), Some(0));
        assert_eq!(parse_sol_erda_count("20"), Some(20));
        assert_eq!(parse_sol_erda_count("21"), None); // 범위 초과
    }

    #[test]
    fn test_parse_sol_erda_gauge() {
        assert_eq!(parse_sol_erda_gauge("348/1000"), Some(348));
        assert_eq!(parse_sol_erda_gauge("348 / 1000"), Some(348));
        assert_eq!(parse_sol_erda_gauge("0/1000"), Some(0));
        assert_eq!(parse_sol_erda_gauge("invalid"), None);
    }

    #[test]
    fn test_parse_sol_erda_piece() {
        assert_eq!(parse_sol_erda_piece("41"), Some(41));
        assert_eq!(parse_sol_erda_piece("1,234"), Some(1234));
        assert_eq!(parse_sol_erda_piece("invalid"), None);
    }
}
