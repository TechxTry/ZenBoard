// Package etl implements the ETL pipeline that pulls data from Zentao MySQL
// and upserts it into local PostgreSQL.
//
// Table names, watermark strategies, and extra filters are driven by
// config/etl_tables.yaml — no recompile needed when table names change.
package etl

import (
	"fmt"
	"log"
	"time"
	"zenboard/internal/config"
	"zenboard/internal/db"
	"zenboard/internal/models"
	"zenboard/internal/source"
)

// RunAll runs all enabled ETL pipelines sequentially.
func RunAll() {
	log.Println("[etl] starting full sync pipeline")
	SyncUsers()
	SyncTasks()
	SyncStories()
	SyncBugs()
	SyncEfforts()
	SyncExecutions()
	log.Println("[etl] full sync pipeline complete")
}

// ---- watermark helpers ----

func getWatermark(targetTable string) time.Time {
	var wm models.SyncWatermark
	db.PG.Where("table_name = ?", targetTable).First(&wm)
	return wm.Watermark
}

func setWatermark(targetTable string, t time.Time, count int64) {
	db.PG.Save(&models.SyncWatermark{
		Table:     targetTable,
		Watermark: t,
		LastCount: count,
		UpdatedAt: time.Now(),
	})
}

// tableConfig returns the ETLTableConfig for a given target table name.
// Logs a warning and returns a zero value if not found or disabled.
func tableConfig(name string) (config.ETLTableConfig, bool) {
	cfg, ok := config.ETLTableMap[name]
	if !ok {
		log.Printf("[etl] WARNING: no config found for table %q in etl_tables.yaml", name)
		return config.ETLTableConfig{}, false
	}
	if !cfg.Enabled {
		log.Printf("[etl] table %q is disabled in etl_tables.yaml, skipping", name)
		return config.ETLTableConfig{}, false
	}
	return cfg, true
}

// buildSourceQuery builds a GORM query on the Zentao DB for a given table config.
func buildSourceQuery(cfg config.ETLTableConfig, watermark interface{}) interface{} {
	return cfg // query building is done inline per sync function for type safety
}

// whereClause builds the incremental WHERE clause based on watermark type.
func whereClause(cfg config.ETLTableConfig, watermark interface{}) (clause string, arg interface{}) {
	switch cfg.Watermark.Type {
	case config.WatermarkTime:
		return fmt.Sprintf("%s > ?", cfg.Watermark.Field), watermark
	case config.WatermarkID:
		return fmt.Sprintf("%s > ?", cfg.Watermark.Field), watermark
	default:
		return "", nil // full sync
	}
}

// ---- Sync functions ----
// Each function uses cfg.Source as the MySQL table name, making it
// configurable without recompilation.

// SyncUsers pulls zt_user (or configured source) and upserts into local_users.
func SyncUsers() {
	cfg, ok := tableConfig("local_users")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		log.Println("[etl] SyncUsers: Zentao DB not connected, skipping")
		return
	}

	var rows []source.ZtUser
	q := ztDB.Table(cfg.Source)
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncUsers(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	for _, r := range rows {
		m := models.LocalUser{
			ID:       r.ID,
			Account:  r.Account,
			Realname: r.Realname,
			Role:     r.Role,
			Deleted:  r.Deleted == "1",
			RawData:  db.RowToJSONB(r),
			SyncedAt: now,
		}
		db.PG.Save(&m)
	}
	log.Printf("[etl] SyncUsers(%s→%s): upserted %d rows", cfg.Source, cfg.Name, len(rows))
	setWatermark(cfg.Name, now, int64(len(rows)))
}

// SyncTasks pulls source task table (default: zt_task) incrementally.
func SyncTasks() {
	cfg, ok := tableConfig("local_tasks")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		return
	}

	wm := getWatermark(cfg.Name)
	var rows []source.ZtTask
	q := ztDB.Table(cfg.Source)
	if clause, arg := whereClause(cfg, wm); clause != "" {
		q = q.Where(clause, arg)
	}
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncTasks(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	maxEdited := wm
	for _, r := range rows {
		m := models.LocalTask{
			ID: r.ID, Name: r.Name, Type: r.Type, Status: r.Status,
			AssignedTo: r.AssignedTo, FinishedBy: r.FinishedBy,
			Estimate: r.Estimate, Consumed: r.Consumed,
			ExecutionID:    r.Execution,
			StoryID:        r.Story,
			LastEditedDate: db.SafeTime(r.LastEditedDate),
			Deleted:        r.Deleted == "1",
			RawData:        db.RowToJSONB(r),
			SyncedAt:       now,
		}
		db.PG.Save(&m)
		if r.LastEditedDate != nil && r.LastEditedDate.After(maxEdited) {
			maxEdited = *r.LastEditedDate
		}
	}
	log.Printf("[etl] SyncTasks(%s→%s): upserted %d rows since %v", cfg.Source, cfg.Name, len(rows), wm)
	if len(rows) > 0 {
		setWatermark(cfg.Name, maxEdited, int64(len(rows)))
	}
}

// SyncStories pulls source story table (default: zt_story) incrementally.
func SyncStories() {
	cfg, ok := tableConfig("local_stories")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		return
	}

	wm := getWatermark(cfg.Name)
	var rows []source.ZtStory
	q := ztDB.Table(cfg.Source)
	if clause, arg := whereClause(cfg, wm); clause != "" {
		q = q.Where(clause, arg)
	}
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncStories(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	maxEdited := wm
	for _, r := range rows {
		m := models.LocalStory{
			ID: r.ID, Title: r.Title, Status: r.Status,
			AssignedTo:     r.AssignedTo,
			Estimate:       r.Estimate,
			ProductID:      r.Product,
			LastEditedDate: db.SafeTime(r.LastEditedDate),
			Deleted:        r.Deleted == "1",
			RawData:        db.RowToJSONB(r),
			SyncedAt:       now,
		}
		db.PG.Save(&m)
		if r.LastEditedDate != nil && r.LastEditedDate.After(maxEdited) {
			maxEdited = *r.LastEditedDate
		}
	}
	log.Printf("[etl] SyncStories(%s→%s): upserted %d rows", cfg.Source, cfg.Name, len(rows))
	if len(rows) > 0 {
		setWatermark(cfg.Name, maxEdited, int64(len(rows)))
	}
}

// SyncBugs pulls source bug table (default: zt_bug) incrementally.
func SyncBugs() {
	cfg, ok := tableConfig("local_bugs")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		return
	}

	wm := getWatermark(cfg.Name)
	var rows []source.ZtBug
	q := ztDB.Table(cfg.Source)
	if clause, arg := whereClause(cfg, wm); clause != "" {
		q = q.Where(clause, arg)
	}
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncBugs(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	maxEdited := wm
	for _, r := range rows {
		m := models.LocalBug{
			ID: r.ID, Title: r.Title, Severity: r.Severity, Status: r.Status,
			AssignedTo: r.AssignedTo, ResolvedBy: r.ResolvedBy, Resolution: r.Resolution,
			ExecutionID:    r.Execution,
			StoryID:        r.Story,
			TaskID:         r.Task,
			LastEditedDate: db.SafeTime(r.LastEditedDate),
			Deleted:        r.Deleted == "1",
			RawData:        db.RowToJSONB(r),
			SyncedAt:       now,
		}
		db.PG.Save(&m)
		if r.LastEditedDate != nil && r.LastEditedDate.After(maxEdited) {
			maxEdited = *r.LastEditedDate
		}
	}
	log.Printf("[etl] SyncBugs(%s→%s): upserted %d rows", cfg.Source, cfg.Name, len(rows))
	if len(rows) > 0 {
		setWatermark(cfg.Name, maxEdited, int64(len(rows)))
	}
}

// SyncEfforts pulls source effort table (default: zt_effort) by ID watermark.
func SyncEfforts() {
	cfg, ok := tableConfig("local_efforts")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		return
	}

	var lastID int64
	db.PG.Model(&models.LocalEffort{}).Select("COALESCE(MAX(id),0)").Scan(&lastID)

	var rows []source.ZtEffort
	q := ztDB.Table(cfg.Source).Where("id > ?", lastID)
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncEfforts(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	for _, r := range rows {
		m := models.LocalEffort{
			ID: r.ID, Account: r.Account,
			WorkDate:   db.SafeTime(r.Date),
			Consumed:   r.Consumed,
			Work:       r.Work,
			ObjectType: r.ObjectType,
			ObjectID:   r.ObjectID,
			Deleted:    r.Deleted == "1",
			RawData:    db.RowToJSONB(r),
			SyncedAt:   now,
		}
		db.PG.Save(&m)
	}
	log.Printf("[etl] SyncEfforts(%s→%s): upserted %d rows", cfg.Source, cfg.Name, len(rows))
	setWatermark(cfg.Name, now, int64(len(rows)))
}

// SyncExecutions pulls source execution table (default: zt_project) by ID watermark.
func SyncExecutions() {
	cfg, ok := tableConfig("local_executions")
	if !ok {
		return
	}
	ztDB := db.GetZentao()
	if ztDB == nil {
		return
	}

	var lastID int64
	db.PG.Model(&models.LocalExecution{}).Select("COALESCE(MAX(id),0)").Scan(&lastID)

	var rows []source.ZtExecution
	q := ztDB.Table(cfg.Source).Where("id > ?", lastID)
	if cfg.ExtraFilter != "" {
		q = q.Where(cfg.ExtraFilter)
	}
	if err := q.Find(&rows).Error; err != nil {
		log.Printf("[etl] SyncExecutions(%s) query error: %v", cfg.Source, err)
		return
	}

	now := time.Now()
	for _, r := range rows {
		m := models.LocalExecution{
			ID: r.ID, Name: r.Name, Status: r.Status,
			BeginDate: db.SafeTime(r.Begin),
			EndDate:   db.SafeTime(r.End),
			Deleted:   r.Deleted == "1",
			RawData:   db.RowToJSONB(r),
			SyncedAt:  now,
		}
		db.PG.Save(&m)
	}
	log.Printf("[etl] SyncExecutions(%s→%s): upserted %d rows", cfg.Source, cfg.Name, len(rows))
	setWatermark(cfg.Name, now, int64(len(rows)))
}
