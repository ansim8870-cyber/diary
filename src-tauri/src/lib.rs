mod db;
mod api;
mod commands;

use std::sync::Mutex;
use db::Database;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Database::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            db: Mutex::new(database),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_api_key,
            commands::get_character,
            commands::register_character,
            commands::search_character,
            commands::get_character_list,
            commands::refresh_character,
            commands::get_character_equipment,
            commands::get_hunting_sessions,
            commands::save_hunting_session,
            commands::update_hunting_session,
            commands::delete_hunting_session,
            commands::get_daily_totals,
            commands::get_exp_history,
            commands::get_weekly_exp_from_api,
            commands::export_data,
            commands::import_data,
            commands::reset_data,
            commands::get_boss_settings,
            commands::save_boss_setting,
            commands::delete_boss_setting,
            commands::update_boss_party_size,
            // Boss Clear Commands
            commands::save_boss_clear,
            commands::delete_boss_clear,
            commands::get_boss_clears_by_week,
            commands::get_boss_clears_by_date,
            commands::get_weekly_boss_summary,
            commands::get_monthly_boss_clears,
            commands::get_week_start_date,
            commands::get_month_start_date,
            // App Settings Commands
            commands::get_app_settings,
            commands::save_app_settings,
            commands::save_screenshot_folder_path,
            commands::get_daily_totals_with_pieces,
            // Item Drop Commands
            commands::save_item_drop,
            commands::get_item_drops,
            commands::update_item_drop,
            commands::delete_item_drop,
            commands::get_monthly_item_drops,
            commands::get_months_with_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
