package handlers

import (
	"net/http"
	"zenboard/internal/db"
	"zenboard/internal/models"

	"github.com/gin-gonic/gin"
)

// GetLocalStats GET /api/config/local-stats — row counts in local PostgreSQL mirror tables.
func GetLocalStats(c *gin.Context) {
	var nUsers, nTasks, nStories, nBugs, nEfforts, nExec int64

	db.PG.Model(&models.LocalUser{}).Count(&nUsers)
	db.PG.Model(&models.LocalTask{}).Count(&nTasks)
	db.PG.Model(&models.LocalStory{}).Count(&nStories)
	db.PG.Model(&models.LocalBug{}).Count(&nBugs)
	db.PG.Model(&models.LocalEffort{}).Count(&nEfforts)
	db.PG.Model(&models.LocalExecution{}).Count(&nExec)

	tables := map[string]int64{
		"local_users":      nUsers,
		"local_tasks":      nTasks,
		"local_stories":    nStories,
		"local_bugs":       nBugs,
		"local_efforts":    nEfforts,
		"local_executions": nExec,
	}

	var total int64
	for _, n := range tables {
		total += n
	}

	c.JSON(http.StatusOK, gin.H{
		"tables": tables,
		"total":  total,
	})
}
