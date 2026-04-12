// Package source defines read-only scan structs for Zentao MySQL tables.
// ⚠️  ZERO-TIME TRAP: MySQL DSN must include parseTime=true&loc=Local.
//     All time fields use *time.Time (pointer) so that Zentao's
//     "0000-00-00 00:00:00" values are intercepted and stored as NULL in PG.
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
	ID      int64      `gorm:"column:id"`
	Name    string     `gorm:"column:name"`
	Status  string     `gorm:"column:status"`
	Begin   *time.Time `gorm:"column:begin"`
	End     *time.Time `gorm:"column:end"`
	Deleted string     `gorm:"column:deleted"`
	Type    string     `gorm:"column:type"` // filter: type = 'sprint' or 'stage'
}

func (ZtExecution) TableName() string { return "zt_project" }
