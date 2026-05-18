package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func isAdminRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin", "super_admin":
		return true
	default:
		return false
	}
}

func RequireAdmin(c *gin.Context) (*CurrentUser, bool) {
	cu := GetCurrentUser(c)
	if cu == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	if !isAdminRole(cu.User.Role) {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return nil, false
	}
	return cu, true
}
