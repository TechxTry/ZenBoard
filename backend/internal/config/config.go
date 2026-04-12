package config

import (
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string

	// PostgreSQL (read-write)
	PGDSN string

	// Admin credentials
	AdminUser string
	AdminPass string
	JWTSecret string

	// Redis
	RedisAddr string

	// Zentao MySQL (read-only, runtime-configurable)
	ZentaoHost   string
	ZentaoPort   string
	ZentaoUser   string
	ZentaoPass   string
	ZentaoDBName string

	// ETL
	SyncIntervalMinutes int
}

var Global Config

func Load() {
	loadDotEnv()

	Global = Config{
		Port:      getEnv("PORT", "8080"),
		PGDSN:     getEnv("PG_DSN", "host=localhost user=zenboard password=zenboard123 dbname=zenboard port=5432 sslmode=disable TimeZone=Asia/Shanghai"),
		AdminUser: getEnv("ADMIN_USER", "admin"),
		AdminPass: getEnv("ADMIN_PASS", "admin123"),
		JWTSecret: getEnv("JWT_SECRET", "zenboard-secret-change-me"),
		RedisAddr: getEnv("REDIS_ADDR", "localhost:6379"),

		ZentaoHost:   getEnv("ZT_HOST", ""),
		ZentaoPort:   getEnv("ZT_PORT", "3306"),
		ZentaoUser:   getEnv("ZT_USER", ""),
		ZentaoPass:   getEnv("ZT_PASS", ""),
		ZentaoDBName: getEnv("ZT_DBNAME", "zentao"),

		SyncIntervalMinutes: ClampSyncIntervalMinutes(getEnvInt("SYNC_INTERVAL_MINUTES", 15)),
	}

	log.Println("[config] loaded successfully")
}

// ClampSyncIntervalMinutes limits sync interval to [1, 1440] minutes (1 min … 24 h).
func ClampSyncIntervalMinutes(n int) int {
	if n < 1 {
		return 1
	}
	if n > 1440 {
		return 1440
	}
	return n
}

// loadDotEnv 从当前工作目录逐级向上加载 .env（外层先加载、内层后加载，便于在 backend/ 下 go run 时使用仓库根目录 .env）
func loadDotEnv() {
	wd, err := os.Getwd()
	if err != nil {
		return
	}
	var chain []string
	for d := wd; ; {
		chain = append(chain, d)
		parent := filepath.Dir(d)
		if parent == d {
			break
		}
		d = parent
	}
	for i := len(chain) - 1; i >= 0; i-- {
		p := filepath.Join(chain[i], ".env")
		if err := godotenv.Load(p); err == nil {
			log.Println("[config] loaded .env from", p)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return ClampSyncIntervalMinutes(n)
}

// ZentaoDSN builds the MySQL DSN from current config.
// parseTime=true and loc=Local are required to handle Zentao's time format.
func (c *Config) ZentaoDSN() string {
	return c.ZentaoUser + ":" + c.ZentaoPass +
		"@tcp(" + c.ZentaoHost + ":" + c.ZentaoPort + ")/" +
		c.ZentaoDBName +
		"?charset=utf8mb4&parseTime=true&loc=Local"
}
