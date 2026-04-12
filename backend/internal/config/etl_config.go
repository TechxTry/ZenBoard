package config

import (
	"log"
	"os"

	"gopkg.in/yaml.v3"
)

// WatermarkType defines how incremental sync is tracked.
type WatermarkType string

const (
	WatermarkNone WatermarkType = "none" // full re-sync every run
	WatermarkTime WatermarkType = "time" // by lastEditedDate or similar timestamp
	WatermarkID   WatermarkType = "id"   // by auto-increment id
)

// ETLTableConfig describes one source→target sync pair.
type ETLTableConfig struct {
	// Name is the local PG target table name (also used as watermark key).
	Name string `yaml:"name"`
	// Source is the Zentao MySQL source table name.
	Source string `yaml:"source"`
	// Enabled allows disabling a table without removing the config entry.
	Enabled bool `yaml:"enabled"`
	// Watermark describes how to detect new/changed rows.
	Watermark struct {
		Type  WatermarkType `yaml:"type"`
		Field string        `yaml:"field"` // MySQL column name used as watermark
	} `yaml:"watermark"`
	// ExtraFilter is an optional SQL WHERE clause appended to every source query.
	// Example: "type IN ('sprint','stage','kanban')"
	ExtraFilter string `yaml:"extra_filter"`
}

// ETLConfig is the top-level structure of etl_tables.yaml.
type ETLConfig struct {
	Tables []ETLTableConfig `yaml:"tables"`
}

// ETL holds the loaded ETL table configs (indexed by Name for fast lookup).
var ETL ETLConfig

// ETLTableMap provides fast lookup by target table name.
var ETLTableMap map[string]ETLTableConfig

// LoadETLConfig loads config/etl_tables.yaml relative to the working directory.
// Path can be overridden via ETL_CONFIG_PATH env var.
func LoadETLConfig() {
	path := getEnv("ETL_CONFIG_PATH", "config/etl_tables.yaml")

	data, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("[config] failed to read etl_tables.yaml at %s: %v", path, err)
	}

	if err := yaml.Unmarshal(data, &ETL); err != nil {
		log.Fatalf("[config] failed to parse etl_tables.yaml: %v", err)
	}

	// Build lookup map
	ETLTableMap = make(map[string]ETLTableConfig, len(ETL.Tables))
	for _, t := range ETL.Tables {
		ETLTableMap[t.Name] = t
	}

	log.Printf("[config] ETL table config loaded: %d tables", len(ETL.Tables))
	for _, t := range ETL.Tables {
		status := "✓"
		if !t.Enabled {
			status = "✗ disabled"
		}
		log.Printf("[config]   %s  %s → %s  (watermark: %s/%s) %s",
			status, t.Source, t.Name, t.Watermark.Type, t.Watermark.Field, t.ExtraFilter)
	}
}
