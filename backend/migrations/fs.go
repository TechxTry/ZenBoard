package migrations

import "embed"

// Files 内嵌 backend/migrations 下全部 .sql，供进程启动时按版本顺序执行。
//
//go:embed *.sql
var Files embed.FS
