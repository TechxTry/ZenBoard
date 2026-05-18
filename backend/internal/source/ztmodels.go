// Package source defines read-only scan structs for Zentao MySQL tables.
// ⚠️  ZERO-TIME TRAP: MySQL DSN must include parseTime=true&loc=Local.
//
//	All time fields use *time.Time (pointer) so that Zentao's
//	"0000-00-00 00:00:00" values are intercepted and stored as NULL in PG.
package source

import "time"

// ZtUser maps to zt_user in Zentao MySQL.
type ZtUser struct {
	ID       int64  `gorm:"column:id"`
	Account  string `gorm:"column:account"`
	Realname string `gorm:"column:realname"`
	Role     string `gorm:"column:role"`
	Deleted  string `gorm:"column:deleted"` // '0' or '1'
}

func (ZtUser) TableName() string { return "zt_user" }

// ZtTask maps to zt_task in Zentao MySQL.
type ZtTask struct {
	ID             int64      `gorm:"column:id"`
	Name           string     `gorm:"column:name"`
	Type           string     `gorm:"column:type"`
	Status         string     `gorm:"column:status"`
	AssignedTo     string     `gorm:"column:assignedTo"`
	FinishedBy     string     `gorm:"column:finishedBy"`
	Estimate       float64    `gorm:"column:estimate"`
	Consumed       float64    `gorm:"column:consumed"`
	Execution      int64      `gorm:"column:execution"`
	Story          int64      `gorm:"column:story"`
	OpenedDate     *time.Time `gorm:"column:openedDate"`
	StartedDate    *time.Time `gorm:"column:startedDate"`
	AssignedDate   *time.Time `gorm:"column:assignedDate"`
	Deadline       *time.Time `gorm:"column:deadline"`
	FinishedDate   *time.Time `gorm:"column:finishedDate"`
	ClosedDate     *time.Time `gorm:"column:closedDate"`
	LastEditedDate *time.Time `gorm:"column:lastEditedDate"`
	Deleted        string     `gorm:"column:deleted"`
}

func (ZtTask) TableName() string { return "zt_task" }

// ZtStory maps to zt_story in Zentao MySQL.
type ZtStory struct {
	ID             int64      `gorm:"column:id"`
	Title          string     `gorm:"column:title"`
	Status         string     `gorm:"column:status"`
	AssignedTo     string     `gorm:"column:assignedTo"`
	Estimate       float64    `gorm:"column:estimate"`
	Product        int64      `gorm:"column:product"`
	OpenedDate     *time.Time `gorm:"column:openedDate"`
	ClosedDate     *time.Time `gorm:"column:closedDate"`
	LastEditedDate *time.Time `gorm:"column:lastEditedDate"`
	Deleted        string     `gorm:"column:deleted"`
}

func (ZtStory) TableName() string { return "zt_story" }

// ZtBug maps to zt_bug in Zentao MySQL.
type ZtBug struct {
	ID             int64      `gorm:"column:id"`
	Title          string     `gorm:"column:title"`
	Severity       int        `gorm:"column:severity"`
	Status         string     `gorm:"column:status"`
	AssignedTo     string     `gorm:"column:assignedTo"`
	ResolvedBy     string     `gorm:"column:resolvedBy"`
	Resolution     string     `gorm:"column:resolution"`
	Execution      int64      `gorm:"column:execution"`
	Story          int64      `gorm:"column:story"`
	Task           int64      `gorm:"column:task"`
	OpenedDate     *time.Time `gorm:"column:openedDate"`
	ResolvedDate   *time.Time `gorm:"column:resolvedDate"`
	ClosedDate     *time.Time `gorm:"column:closedDate"`
	LastEditedDate *time.Time `gorm:"column:lastEditedDate"`
	Deleted        string     `gorm:"column:deleted"`
}

func (ZtBug) TableName() string { return "zt_bug" }

// ZtEffort maps to zt_effort (verify table name against your Zentao version).
type ZtEffort struct {
	ID         int64      `gorm:"column:id"`
	Account    string     `gorm:"column:account"`
	Date       *time.Time `gorm:"column:date"`
	Consumed   float64    `gorm:"column:consumed"`
	Work       string     `gorm:"column:work"`
	ObjectType string     `gorm:"column:objectType"`
	ObjectID   int64      `gorm:"column:objectID"`
	Deleted    string     `gorm:"column:deleted"`
}

func (ZtEffort) TableName() string { return "zt_effort" }

// ZtExecution maps to zt_project (executions are a sub-type in Zentao project table).
type ZtExecution struct {
	ID             int64      `gorm:"column:id"`
	Name           string     `gorm:"column:name"`
	Status         string     `gorm:"column:status"`
	Begin          *time.Time `gorm:"column:begin"`
	End            *time.Time `gorm:"column:end"`
	Deleted        string     `gorm:"column:deleted"`
	Type           string     `gorm:"column:type"` // filter: type = 'sprint' or 'stage'
	Parent         int64      `gorm:"column:parent"`
	LastEditedDate *time.Time `gorm:"column:lastEditedDate"`
}

func (ZtExecution) TableName() string { return "zt_project" }

// ---- Dimension / structure tables ----

// ZtProjectRow is a generic mapping for zt_project used for program/project dimensions.
// Field coverage intentionally stays broad; missing columns in a specific Zentao variant
// do not break scanning as long as we don't reference them in WHERE clauses.
type ZtProjectRow struct {
	ID             int64      `gorm:"column:id"`
	Name           string     `gorm:"column:name"`
	Type           string     `gorm:"column:type"`
	Status         string     `gorm:"column:status"`
	Parent         int64      `gorm:"column:parent"`
	Path           string     `gorm:"column:path"`
	Grade          int        `gorm:"column:grade"`
	Begin          *time.Time `gorm:"column:begin"`
	End            *time.Time `gorm:"column:end"`
	LastEditedDate *time.Time `gorm:"column:lastEditedDate"`
	Deleted        string     `gorm:"column:deleted"`
}

func (ZtProjectRow) TableName() string { return "zt_project" }

// ZtProduct maps to zt_product.
type ZtProduct struct {
	ID      int64  `gorm:"column:id"`
	Name    string `gorm:"column:name"`
	Code    string `gorm:"column:code"`
	Status  string `gorm:"column:status"`
	Line    int64  `gorm:"column:line"` // product line id in many enterprise deployments
	Deleted string `gorm:"column:deleted"`
}

func (ZtProduct) TableName() string { return "zt_product" }

// ZtProductLine maps to zt_line (common in enterprise deployments). If your instance uses a different table,
// configure it in etl_tables.yaml and keep struct columns aligned.
type ZtProductLine struct {
	ID      int64  `gorm:"column:id"`
	Name    string `gorm:"column:name"`
	Parent  int64  `gorm:"column:parent"`
	Path    string `gorm:"column:path"`
	Grade   int    `gorm:"column:grade"`
	Deleted string `gorm:"column:deleted"`
}

func (ZtProductLine) TableName() string { return "zt_line" }

// ZtAction maps to zt_action (audit/action log).
// This table is used to reconstruct timeline metrics (CFD, scope change, bottlenecks).
type ZtAction struct {
	ID         int64      `gorm:"column:id"`
	ObjectType string     `gorm:"column:objectType"`
	ObjectID   int64      `gorm:"column:objectID"`
	Actor      string     `gorm:"column:actor"`
	Action     string     `gorm:"column:action"`
	Date       *time.Time `gorm:"column:date"`
	Comment    string     `gorm:"column:comment"`
	Extra      string     `gorm:"column:extra"`
	Deleted    string     `gorm:"column:deleted"`
}

func (ZtAction) TableName() string { return "zt_action" }

// ZtHistory maps to zt_history (field-level changes), linked by action ID.
type ZtHistory struct {
	ID     int64  `gorm:"column:id"`
	Action int64  `gorm:"column:action"`
	Field  string `gorm:"column:field"`
	Old    string `gorm:"column:old"`
	New    string `gorm:"column:new"`
	Diff   string `gorm:"column:diff"`
}

func (ZtHistory) TableName() string { return "zt_history" }
