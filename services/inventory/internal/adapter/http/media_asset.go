package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type MediaAssetHandler struct {
	uc usecase.MediaAssetUsecase
}

func NewMediaAssetHandler(uc usecase.MediaAssetUsecase) *MediaAssetHandler {
	return &MediaAssetHandler{uc: uc}
}

func (h *MediaAssetHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/admin/media-assets/cleanup", h.CleanupExpired)
}

func (h *MediaAssetHandler) CleanupExpired(c *gin.Context) {
	deleted, failed, err := h.uc.CleanupExpired(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": deleted, "failed": failed})
}
