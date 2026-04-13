package main

import (
	"context"
	"log"
	"net/http"
	"zenboard/internal/config"
	"zenboard/internal/db"
	"zenboard/internal/handlers"
	"zenboard/internal/scheduler"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load config from env
	config.Load()

	// 1b. Load ETL table mapping config (config/etl_tables.yaml)
	config.LoadETLConfig()

	// 2. Connect PostgreSQL
	db.InitPG()
	if err := db.EnsureAppSettings(); err != nil {
		log.Fatalf("[main] app_settings: %v", err)
	}
	config.Global.SyncIntervalMinutes = db.GetSyncIntervalMinutes()
	log.Printf("[main] sync interval: %d min (env default + app_settings)", config.Global.SyncIntervalMinutes)

	// 3. Connect Zentao MySQL (optional at startup — user configures via UI)
	if config.Global.ZentaoHost != "" {
		if err := db.ConnectZentao(config.Global); err != nil {
			log.Printf("[main] Zentao MySQL connection failed (continuing): %v", err)
		}
	}

	// 4. Periodic ETL (interval persisted in PG, configurable via UI / SYNC_INTERVAL_MINUTES)
	scheduler.StartPeriodicETL(context.Background())

	// 5. Build Gin router
	r := gin.Default()
	// 避免直接访问后端端口时只看到 404：浏览器应打开前端 Nginx（WEB_PORT，默认 80），/api 由 Nginx 反代到本服务
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "zenboard-api",
			"hint":    "浏览器请访问前端端口（Docker 中 WEB_PORT，默认 80，例如 http://localhost），勿直接访问本后端端口；REST 接口前缀为 /api。",
		})
	})
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
	}))

	// Public routes
	r.POST("/api/login", handlers.Login)

	// Protected routes
	api := r.Group("/api", handlers.JWTMiddleware())
	{
		// Config
		api.GET("/config/datasource", handlers.GetDatasource)
		api.PUT("/config/datasource", handlers.PutDatasource)
		api.POST("/config/datasource/test", handlers.TestDatasource)
		api.GET("/config/sync-settings", handlers.GetSyncSettings)
		api.PUT("/config/sync-settings", handlers.PutSyncSettings)
		api.GET("/config/local-stats", handlers.GetLocalStats)

		// Users
		api.GET("/users", handlers.ListUsers)

		// Project Groups
		api.GET("/groups", handlers.ListGroups)
		api.POST("/groups", handlers.CreateGroup)
		api.PUT("/groups/:id", handlers.UpdateGroup)
		api.DELETE("/groups/:id", handlers.DeleteGroup)
		api.GET("/groups/:id/members", handlers.GetGroupMembers)
		api.PUT("/groups/:id/members", handlers.UpdateGroupMembers)

		// Analytics
		api.GET("/analytics/effort-heatmap", handlers.EffortHeatmap)
		api.GET("/analytics/user-load", handlers.UserLoad)
		api.GET("/analytics/workload-distribution", handlers.WorkloadDistribution)

		// Workbench (tasks/:id must be registered before /workbench/tasks)
		api.GET("/workbench/tasks/:id", handlers.GetTask)
		api.GET("/workbench/tasks", handlers.ListTasks)
		api.GET("/workbench/stories", handlers.ListStories)
		api.GET("/workbench/bugs", handlers.ListBugs)
		api.GET("/workbench/efforts", handlers.ListEfforts)
		api.GET("/workbench/executions", handlers.ListExecutions)

		// Sync
		api.POST("/sync/trigger", handlers.TriggerSync)
		api.GET("/sync/status", handlers.GetSyncStatus)
	}

	log.Printf("[main] ZenBoard backend listening on :%s", config.Global.Port)
	if err := r.Run(":" + config.Global.Port); err != nil {
		log.Fatalf("[main] server failed: %v", err)
	}
}
