package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a helper type for PostgreSQL JSONB columns.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("cannot scan type %T into JSONB", value)
	}
	return json.Unmarshal(bytes, j)
}

// ---- Local Tables ----

type LocalUser struct {
	ID       int64     `json:"id" gorm:"primaryKey;column:id"`
	Account  string    `json:"account" gorm:"uniqueIndex;column:account"`
	Realname string    `json:"realname" gorm:"column:realname"`
	Role     string    `json:"role" gorm:"column:role"`
	Deleted  bool      `json:"deleted" gorm:"column:deleted;default:false"`
	RawData  JSONB     `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt time.Time `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalUser) TableName() string { return "local_users" }

type ProjectGroup struct {
	ID          int       `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	Name        string    `json:"name" gorm:"uniqueIndex;column:name"`
	Description string    `json:"description" gorm:"column:description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (ProjectGroup) TableName() string { return "project_groups" }

type GroupMember struct {
	GroupID int    `gorm:"primaryKey;column:group_id"`
	Account string `gorm:"primaryKey;column:account"`
}

func (GroupMember) TableName() string { return "group_members" }

type LocalExecution struct {
	ID        int64      `json:"id" gorm:"primaryKey;column:id"`
	Name      string     `json:"name" gorm:"column:name"`
	Status    string     `json:"status" gorm:"column:status"`
	BeginDate *time.Time `json:"begin_date" gorm:"column:begin_date"`
	EndDate   *time.Time `json:"end_date" gorm:"column:end_date"`
	Deleted   bool       `json:"deleted" gorm:"column:deleted;default:false"`
	RawData   JSONB      `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt  time.Time  `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalExecution) TableName() string { return "local_executions" }

type LocalTask struct {
	ID             int64      `json:"id" gorm:"primaryKey;column:id"`
	Name           string     `json:"name" gorm:"column:name"`
	Type           string     `json:"type" gorm:"column:type"`
	Status         string     `json:"status" gorm:"column:status"`
	AssignedTo     string     `json:"assigned_to" gorm:"column:assigned_to"`
	FinishedBy     string     `json:"finished_by" gorm:"column:finished_by"`
	Estimate       float64    `json:"estimate" gorm:"column:estimate"`
	Consumed       float64    `json:"consumed" gorm:"column:consumed"`
	ExecutionID    int64      `json:"execution_id" gorm:"column:execution_id"`
	StoryID        int64      `json:"story_id" gorm:"column:story_id"`
	LastEditedDate *time.Time `json:"last_edited_date" gorm:"column:last_edited_date"`
	Deleted        bool       `json:"deleted" gorm:"column:deleted;default:false"`
	RawData        JSONB      `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt       time.Time  `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalTask) TableName() string { return "local_tasks" }

type LocalStory struct {
	ID             int64      `json:"id" gorm:"primaryKey;column:id"`
	Title          string     `json:"title" gorm:"column:title"`
	Status         string     `json:"status" gorm:"column:status"`
	AssignedTo     string     `json:"assigned_to" gorm:"column:assigned_to"`
	Estimate       float64    `json:"estimate" gorm:"column:estimate"`
	ProductID      int64      `json:"product_id" gorm:"column:product_id"`
	LastEditedDate *time.Time `json:"last_edited_date" gorm:"column:last_edited_date"`
	Deleted        bool       `json:"deleted" gorm:"column:deleted;default:false"`
	RawData        JSONB      `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt       time.Time  `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalStory) TableName() string { return "local_stories" }

type LocalBug struct {
	ID             int64      `json:"id" gorm:"primaryKey;column:id"`
	Title          string     `json:"title" gorm:"column:title"`
	Severity       int        `json:"severity" gorm:"column:severity"`
	Status         string     `json:"status" gorm:"column:status"`
	AssignedTo     string     `json:"assigned_to" gorm:"column:assigned_to"`
	ResolvedBy     string     `json:"resolved_by" gorm:"column:resolved_by"`
	Resolution     string     `json:"resolution" gorm:"column:resolution"`
	ExecutionID    int64      `json:"execution_id" gorm:"column:execution_id"`
	StoryID        int64      `json:"story_id" gorm:"column:story_id"`
	TaskID         int64      `json:"task_id" gorm:"column:task_id"`
	LastEditedDate *time.Time `json:"last_edited_date" gorm:"column:last_edited_date"`
	Deleted        bool       `json:"deleted" gorm:"column:deleted;default:false"`
	RawData        JSONB      `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt       time.Time  `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalBug) TableName() string { return "local_bugs" }

type LocalEffort struct {
	ID         int64      `json:"id" gorm:"primaryKey;column:id"`
	Account    string     `json:"account" gorm:"column:account"`
	WorkDate   *time.Time `json:"work_date" gorm:"column:work_date"`
	Consumed   float64    `json:"consumed" gorm:"column:consumed"`
	Work       string     `json:"work" gorm:"column:work"`
	ObjectType string     `json:"object_type" gorm:"column:object_type"`
	ObjectID   int64      `json:"object_id" gorm:"column:object_id"`
	Deleted    bool       `json:"deleted" gorm:"column:deleted;default:false"`
	RawData    JSONB      `json:"raw_data" gorm:"column:raw_data;type:jsonb"`
	SyncedAt   time.Time  `json:"synced_at" gorm:"column:synced_at"`
}

func (LocalEffort) TableName() string { return "local_efforts" }

type SyncWatermark struct {
	Table     string    `json:"table" gorm:"primaryKey;column:table_name"`
	Watermark time.Time `json:"watermark" gorm:"column:watermark"`
	LastCount int64     `json:"last_count" gorm:"column:last_count"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (SyncWatermark) TableName() string { return "sync_watermarks" }
