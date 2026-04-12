package db

import (
	"errors"
	"strconv"
	"strings"

	"zenboard/internal/config"

	"gorm.io/gorm"
)

const settingKeySyncInterval = "sync_interval_minutes"

// EnsureAppSettings creates app_settings if missing and seeds default sync interval.
func EnsureAppSettings() error {
	if err := PG.Exec(`
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`).Error; err != nil {
		return err
	}
	def := strconv.Itoa(config.ClampSyncIntervalMinutes(config.Global.SyncIntervalMinutes))
	return PG.Exec(`
INSERT INTO app_settings (setting_key, value) VALUES (?, ?)
ON CONFLICT (setting_key) DO NOTHING`, settingKeySyncInterval, def).Error
}

// GetSyncIntervalMinutes reads persisted interval or falls back to config.Global (env default).
func GetSyncIntervalMinutes() int {
	var row struct {
		Value string `gorm:"column:value"`
	}
	err := PG.Table("app_settings").Select("value").Where("setting_key = ?", settingKeySyncInterval).Scan(&row).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return config.ClampSyncIntervalMinutes(config.Global.SyncIntervalMinutes)
	}
	if strings.TrimSpace(row.Value) == "" {
		return config.ClampSyncIntervalMinutes(config.Global.SyncIntervalMinutes)
	}
	n, err := strconv.Atoi(strings.TrimSpace(row.Value))
	if err != nil {
		return config.ClampSyncIntervalMinutes(config.Global.SyncIntervalMinutes)
	}
	return config.ClampSyncIntervalMinutes(n)
}

// SetSyncIntervalMinutes persists the interval (minutes).
func SetSyncIntervalMinutes(n int) error {
	n = config.ClampSyncIntervalMinutes(n)
	return PG.Exec(`
INSERT INTO app_settings (setting_key, value, updated_at) VALUES (?, ?, NOW())
ON CONFLICT (setting_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
		settingKeySyncInterval, strconv.Itoa(n)).Error
}
