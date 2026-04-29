package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type InventoryHandler struct {
	uc usecase.InventoryUsecase
}

func NewInventoryHandler(uc usecase.InventoryUsecase) *InventoryHandler {
	return &InventoryHandler{uc: uc}
}

func (h *InventoryHandler) RegisterRoutes(r *gin.Engine) {
	g := r.Group("/inventories")
	g.GET("/:id", h.GetInventory)
	g.POST("/:id/reserve", h.Reserve)
	g.POST("/:id/restock", h.Restock)
}

func (h *InventoryHandler) GetInventory(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	inv, err := h.uc.GetInventory(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, inv)
}

type quantityRequest struct {
	Quantity int `json:"quantity" binding:"required,min=1"`
}

func (h *InventoryHandler) Reserve(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	var req quantityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	if err := h.uc.Reserve(c.Request.Context(), id, req.Quantity); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *InventoryHandler) Restock(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	var req quantityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	if err := h.uc.Restock(c.Request.Context(), id, req.Quantity); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
		return
	}

	c.Status(http.StatusNoContent)
}

func parseID(c *gin.Context) (int, error) {
	return strconv.Atoi(c.Param("id"))
}

func errorResponse(msg string) gin.H {
	return gin.H{"error": msg}
}
