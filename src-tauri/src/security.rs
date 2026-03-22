use serde_json::Value;

const REDACTED: &str = "***REDACTED***";

pub fn sanitize_json_for_persistence(
    field_name: &str,
    value: Option<String>,
) -> Result<Option<String>, String> {
    let Some(raw) = normalize_optional_text(value) else {
        return Ok(None);
    };

    let mut parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| format!("{field_name} must be valid JSON: {err}"))?;
    redact_json_value(&mut parsed);
    serde_json::to_string(&parsed)
        .map(Some)
        .map_err(|err| format!("failed to serialize sanitized {field_name}: {err}"))
}

pub fn redact_text_secrets(input: &str) -> String {
    let mut text = input.to_string();
    text = redact_bearer_tokens(&text);
    text = redact_env_style_pairs(&text);
    text
}

fn redact_json_value(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, nested) in map.iter_mut() {
                if is_sensitive_key(key) {
                    *nested = Value::String(REDACTED.to_string());
                    continue;
                }
                redact_json_value(nested);
            }
        }
        Value::Array(items) => {
            for item in items {
                redact_json_value(item);
            }
        }
        Value::String(s) => {
            *s = redact_text_secrets(s);
        }
        _ => {}
    }
}

fn is_sensitive_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    let exact = [
        "authorization",
        "token",
        "access_token",
        "refresh_token",
        "api_key",
        "apikey",
        "secret",
        "client_secret",
        "password",
        "private_key",
        "github_token",
        "openai_api_key",
        "anthropic_api_key",
    ];

    if exact.contains(&key.as_str()) {
        return true;
    }

    key.ends_with("_token")
        || key.ends_with("_secret")
        || key.ends_with("_password")
        || key.ends_with("_api_key")
        || key.contains("private_key")
}

fn redact_bearer_tokens(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        let Some(remaining) = input.get(i..) else {
            break;
        };

        if remaining
            .get(..7)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("bearer "))
        {
            out.push_str("Bearer ");
            i += 7;

            while i < input.len() {
                let Some(next_remaining) = input.get(i..) else {
                    break;
                };
                let Some(ch) = next_remaining.chars().next() else {
                    break;
                };
                if ch.is_whitespace() || ch == '"' || ch == '\'' || ch == ',' {
                    break;
                }
                i += ch.len_utf8();
            }
            out.push_str(REDACTED);
            continue;
        }

        if let Some(ch) = remaining.chars().next() {
            out.push(ch);
            i += ch.len_utf8();
        } else {
            break;
        }
    }
    out
}

fn redact_env_style_pairs(input: &str) -> String {
    input
        .split_whitespace()
        .map(redact_env_style_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn redact_env_style_token(token: &str) -> String {
    for separator in ['=', ':'] {
        if let Some(idx) = token.find(separator) {
            let (key, value) = token.split_at(idx);
            let stripped_key = key.trim_matches(|c| c == '"' || c == '\'');
            if is_sensitive_key(stripped_key) {
                return format!("{key}{separator}{}", REDACTED);
            }
            if stripped_key.eq_ignore_ascii_case("authorization")
                && value.to_ascii_lowercase().contains("bearer")
            {
                return format!("{key}{separator} Bearer {}", REDACTED);
            }
        }
    }
    token.to_string()
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_json_for_persistence_redacts_sensitive_keys() {
        let raw = Some(r#"{"api_key":"abc","nested":{"password":"p@ss","safe":"ok"}}"#.to_string());
        let sanitized = sanitize_json_for_persistence("config", raw)
            .expect("sanitize should succeed")
            .expect("sanitized json should exist");
        let value: Value = serde_json::from_str(&sanitized).expect("must remain valid json");
        assert_eq!(value["api_key"], Value::String(REDACTED.to_string()));
        assert_eq!(
            value["nested"]["password"],
            Value::String(REDACTED.to_string())
        );
        assert_eq!(value["nested"]["safe"], Value::String("ok".to_string()));
    }

    #[test]
    fn redact_text_secrets_masks_bearer_and_env_pairs() {
        let line = "Authorization: Bearer sk-test token=abc normal=value";
        let redacted = redact_text_secrets(line);
        assert!(redacted.contains("Bearer ***REDACTED***"));
        assert!(redacted.contains("token=***REDACTED***"));
        assert!(redacted.contains("normal=value"));
    }

    #[test]
    fn redact_text_secrets_handles_utf8_without_panicking() {
        let line = r#"{"type":"item.completed","item":{"text":"I’m ready Authorization: Bearer sk-test"}}"#;
        let redacted = redact_text_secrets(line);
        assert!(redacted.contains("I’m ready"));
        assert!(redacted.contains("Bearer ***REDACTED***"));
    }
}
