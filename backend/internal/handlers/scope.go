package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	scopeSelf  = "SELF"
	scopeGroup = "GROUP"
	scopeAll   = "ALL"
)

func normalizeScope(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	switch s {
	case scopeSelf, scopeGroup, scopeAll:
		return s
	default:
		return scopeSelf
	}
}

// requireBinding returns bound zentao account (or aborts).
func requireBinding(c *gin.Context) (string, bool) {
	cu := GetCurrentUser(c)
	if cu == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	if cu.ZentaoBinding == nil || strings.TrimSpace(cu.ZentaoBinding.ZentaoAccount) == "" {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing zentao binding"})
		return "", false
	}
	return strings.TrimSpace(cu.ZentaoBinding.ZentaoAccount), true
}

// effectiveGroupID enforces GROUP scope to the user's default_group_id.
func effectiveGroupID(c *gin.Context, requested int) (int, bool) {
	cu := GetCurrentUser(c)
	if cu == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return 0, false
	}
	scope := normalizeScope(cu.User.DataScope)
	if scope == scopeAll {
		return requested, true
	}
	if scope == scopeSelf {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden: group scope required"})
		return 0, false
	}
	// GROUP
	if cu.User.DefaultGroupID == nil || *cu.User.DefaultGroupID <= 0 {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden: default_group_id not set"})
		return 0, false
	}
	return *cu.User.DefaultGroupID, true
}
