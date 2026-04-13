package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"zenboard/internal/db"
	"zenboard/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// getGroupAccounts returns member accounts for a group.
func getGroupAccounts(groupID int) []string {
	var members []models.GroupMember
	db.PG.Where("group_id = ?", groupID).Find(&members)
	accounts := make([]string, len(members))
	for i, m := range members {
		accounts[i] = m.Account
	}
	return accounts
}

// groupFilter resolves project-group isolation for workbench queries.
// When groupID <= 0, no group filter is applied (accounts == nil, showNone == false).
// When groupID > 0 but the group has no members, showNone is true → caller should return no rows.
// When groupID > 0 and there are members, accounts is non-nil.
func groupFilter(groupID int) (accounts []string, showNone bool) {
	if groupID <= 0 {
		return nil, false
	}
	accounts = getGroupAccounts(groupID)
	if len(accounts) == 0 {
		return nil, true
	}
	return accounts, false
}

// enforceMaxRange checks date range ≤ 6 months (for large tables).
func enforceMaxRange(from, to time.Time) bool {
	return to.Sub(from) <= 6*30*24*time.Hour
}

// firstVisibleTask loads a task by id if it exists and passes workbench group isolation
// (assignee must be in group when group_id > 0).
func firstVisibleTask(groupID int, taskID int64) (models.LocalTask, error) {
	accounts, showNone := groupFilter(groupID)
	if showNone {
		return models.LocalTask{}, gorm.ErrRecordNotFound
	}
	q := db.PG.Where("id = ? AND deleted = false", taskID)
	if accounts != nil {
		q = q.Where("assigned_to IN ?", accounts)
	}
	var t models.LocalTask
	err := q.First(&t).Error
	return t, err
}

// GetTask GET /api/workbench/tasks/:id
func GetTask(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}
	groupID := queryInt(c, "group_id")
	t, err := firstVisibleTask(groupID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// ListTasks GET /api/workbench/tasks
func ListTasks(c *gin.Context) {
	groupID := queryInt(c, "group_id")
	status := c.Query("status")
	assignedTo := c.Query("assigned_to")
	dateFrom := queryDate(c, "date_from")
	dateTo := queryDate(c, "date_to")
	page, pageSize := parsePagination(c)

	query := db.PG.Model(&models.LocalTask{}).Where("deleted = false")

	if accounts, showNone := groupFilter(groupID); showNone {
		query = query.Where("1 = 0")
	} else if accounts != nil {
		query = query.Where("assigned_to IN ?", accounts)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}
	if !dateFrom.IsZero() && !dateTo.IsZero() {
		query = query.Where("last_edited_date BETWEEN ? AND ?", dateFrom, dateTo)
	}
	if execID := int64(queryInt(c, "execution_id")); execID > 0 {
		query = query.Where("execution_id = ?", execID)
	}

	var total int64
	query.Count(&total)
	var rows []models.LocalTask
	query.Offset((page - 1) * pageSize).Limit(pageSize).Order("last_edited_date DESC").Find(&rows)
	c.JSON(http.StatusOK, pageResponse(rows, total, page, pageSize))
}

// ListStories GET /api/workbench/stories
func ListStories(c *gin.Context) {
	groupID := queryInt(c, "group_id")
	status := c.Query("status")
	assignedTo := c.Query("assigned_to")
	dateFrom := queryDate(c, "date_from")
	dateTo := queryDate(c, "date_to")
	page, pageSize := parsePagination(c)

	query := db.PG.Model(&models.LocalStory{}).Where("deleted = false")
	if accounts, showNone := groupFilter(groupID); showNone {
		query = query.Where("1 = 0")
	} else if accounts != nil {
		query = query.Where("assigned_to IN ?", accounts)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}
	if !dateFrom.IsZero() && !dateTo.IsZero() {
		query = query.Where("last_edited_date BETWEEN ? AND ?", dateFrom, dateTo)
	}
	if execID := int64(queryInt(c, "execution_id")); execID > 0 {
		query = query.Where(`
			id IN (
				SELECT DISTINCT story_id FROM local_tasks
				WHERE deleted = false AND execution_id = ? AND story_id > 0
				UNION
				SELECT DISTINCT story_id FROM local_bugs
				WHERE deleted = false AND execution_id = ? AND story_id > 0
			)`, execID, execID)
	}

	var total int64
	query.Count(&total)
	var rows []models.LocalStory
	query.Offset((page - 1) * pageSize).Limit(pageSize).Order("last_edited_date DESC").Find(&rows)
	c.JSON(http.StatusOK, pageResponse(rows, total, page, pageSize))
}

// ListBugs GET /api/workbench/bugs
func ListBugs(c *gin.Context) {
	groupID := queryInt(c, "group_id")
	status := c.Query("status")
	severity := c.Query("severity")
	assignedTo := c.Query("assigned_to")
	page, pageSize := parsePagination(c)

	query := db.PG.Model(&models.LocalBug{}).Where("deleted = false")
	if accounts, showNone := groupFilter(groupID); showNone {
		query = query.Where("1 = 0")
	} else if accounts != nil {
		query = query.Where("assigned_to IN ?", accounts)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}
	if execID := int64(queryInt(c, "execution_id")); execID > 0 {
		query = query.Where("execution_id = ?", execID)
	}

	var total int64
	query.Count(&total)
	var rows []models.LocalBug
	query.Offset((page - 1) * pageSize).Limit(pageSize).Order("last_edited_date DESC").Find(&rows)
	c.JSON(http.StatusOK, pageResponse(rows, total, page, pageSize))
}

// ListEfforts GET /api/workbench/efforts
// 强制 6 个月时间跨度限制
func ListEfforts(c *gin.Context) {
	groupID := queryInt(c, "group_id")
	account := c.Query("account")
	objectType := strings.TrimSpace(c.Query("object_type"))
	objectIDStr := strings.TrimSpace(c.Query("object_id"))
	dateFrom := queryDate(c, "date_from")
	dateTo := queryDate(c, "date_to")
	page, pageSize := parsePagination(c)

	if dateFrom.IsZero() || dateTo.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date_from and date_to are required for effort queries"})
		return
	}
	if !enforceMaxRange(dateFrom, dateTo) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date range must not exceed 6 months"})
		return
	}

	query := db.PG.Model(&models.LocalEffort{}).Where("deleted = false").
		Where("work_date BETWEEN ? AND ?", dateFrom, dateTo)

	if accounts, showNone := groupFilter(groupID); showNone {
		query = query.Where("1 = 0")
	} else if accounts != nil {
		query = query.Where("account IN ?", accounts)
	}
	if account != "" {
		query = query.Where("account = ?", account)
	}

	execID := int64(queryInt(c, "execution_id"))
	taskID := int64(queryInt(c, "task_id"))
	var objectID int64
	if objectIDStr != "" {
		oid, err := strconv.ParseInt(objectIDStr, 10, 64)
		if err != nil || oid <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid object_id"})
			return
		}
		objectID = oid
	}

	if taskID > 0 {
		t, err := firstVisibleTask(groupID, taskID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "task not found or not visible"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if execID > 0 && t.ExecutionID != execID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "task does not belong to selected iteration"})
			return
		}
		query = query.Where("LOWER(TRIM(object_type)) = 'task' AND object_id = ?", taskID)
	} else if execID > 0 {
		query = query.Where(`
			(
				(LOWER(TRIM(object_type)) = 'task' AND object_id IN (SELECT id FROM local_tasks WHERE deleted = false AND execution_id = ?))
				OR (LOWER(TRIM(object_type)) = 'bug' AND object_id IN (SELECT id FROM local_bugs WHERE deleted = false AND execution_id = ?))
				OR (LOWER(TRIM(object_type)) = 'story' AND object_id IN (
					SELECT story_id FROM local_tasks WHERE deleted = false AND execution_id = ? AND story_id > 0
					UNION
					SELECT story_id FROM local_bugs WHERE deleted = false AND execution_id = ? AND story_id > 0
				))
			)`, execID, execID, execID, execID)
	}

	// Drilldown filters (optional). These are applied only when task_id is not forcing object_type=task.
	if taskID <= 0 {
		if objectType != "" {
			query = query.Where("LOWER(TRIM(object_type)) = LOWER(TRIM(?))", objectType)
		}
		if objectID > 0 {
			query = query.Where("object_id = ?", objectID)
		}
	}

	var total int64
	query.Count(&total)
	var rows []models.LocalEffort
	query.Offset((page - 1) * pageSize).Limit(pageSize).Order("work_date DESC").Find(&rows)
	c.JSON(http.StatusOK, pageResponse(rows, total, page, pageSize))
}

// ListExecutions GET /api/workbench/executions
// 迭代表无 account 字段：通过组成员在任务/缺陷上出现过的 execution_id 界定可见迭代。
func ListExecutions(c *gin.Context) {
	groupID := queryInt(c, "group_id")
	status := c.Query("status")
	dateFrom := queryDate(c, "date_from")
	dateTo := queryDate(c, "date_to")
	page, pageSize := parsePagination(c)

	query := db.PG.Model(&models.LocalExecution{}).Where("deleted = false")

	if accounts, showNone := groupFilter(groupID); showNone {
		query = query.Where("1 = 0")
	} else if accounts != nil {
		query = query.Where(`
			id IN (
				SELECT DISTINCT execution_id FROM local_tasks
				WHERE deleted = false AND execution_id > 0 AND assigned_to IN ?
				UNION
				SELECT DISTINCT execution_id FROM local_bugs
				WHERE deleted = false AND execution_id > 0 AND assigned_to IN ?
			)`, accounts, accounts)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if !dateFrom.IsZero() && !dateTo.IsZero() {
		query = query.Where("begin_date >= ? AND end_date <= ?", dateFrom, dateTo)
	}

	var total int64
	query.Count(&total)
	var rows []models.LocalExecution
	query.Offset((page - 1) * pageSize).Limit(pageSize).Order("begin_date DESC").Find(&rows)
	c.JSON(http.StatusOK, pageResponse(rows, total, page, pageSize))
}
