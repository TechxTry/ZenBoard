package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// parsePagination extracts page/page_size from query params with safe defaults.
func parsePagination(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 5000 {
		pageSize = 20
	}
	return
}

// queryInt parses an int query param.
func queryInt(c *gin.Context, key string) int {
	v, _ := strconv.Atoi(c.Query(key))
	return v
}

// queryMyBinding is true when the client requests data strictly scoped to the
// current user's zentao_bindings account (e.g. 「我的工作台」).
func queryMyBinding(c *gin.Context) bool {
	switch c.Query("my_binding") {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

// queryDate parses a date query param (format: 2006-01-02).
func queryDate(c *gin.Context, key string) time.Time {
	s := c.Query(key)
	if s == "" {
		return time.Time{}
	}
	t, _ := time.Parse("2006-01-02", s)
	return t
}

// pageResponse returns a unified paginated response envelope.
func pageResponse(data interface{}, total int64, page, pageSize int) gin.H {
	return gin.H{
		"data":      data,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}
}
