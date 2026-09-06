package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type InventoryHandler struct {
	uc    usecase.InventoryUsecase
	imgUc usecase.ImageUsecase
}

func NewInventoryHandler(uc usecase.InventoryUsecase, imgUc usecase.ImageUsecase) *InventoryHandler {
	return &InventoryHandler{uc: uc, imgUc: imgUc}
}

func (h *InventoryHandler) RegisterRoutes(r *gin.Engine) {
	g := r.Group("/inventories")
	g.GET("", h.ListInventories)
	g.GET("/:id", h.GetInventory)
	g.POST("/:id/reserve", h.Reserve)
	g.POST("/:id/restock", h.Restock)

	admin := r.Group("/admin/inventories")
	admin.POST("", h.CreateProduct)
	admin.PUT("/:id", h.UpdateProduct)
	admin.DELETE("/:id", h.DeleteProduct)
	admin.POST("/:id/adjust", h.AdjustStock)

	r.POST("/admin/images", h.UploadImage)
}

func (h *InventoryHandler) ListInventories(c *gin.Context) {
	inventories, err := h.uc.ListInventories(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}
	if inventories == nil {
		inventories = []*domain.Inventory{}
	}
	c.JSON(http.StatusOK, inventories)
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
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
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
		if errors.Is(err, domain.ErrInsufficientStock) || errors.Is(err, domain.ErrInvalidQuantity) {
			c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
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
		if errors.Is(err, domain.ErrInvalidQuantity) {
			c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.Status(http.StatusNoContent)
}

type createProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Price       int     `json:"price" binding:"min=0"`
	Description string  `json:"description"`
	ImageKey    *string `json:"image_key"`
	Count       int     `json:"count" binding:"min=0"`
}

type updateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Price       int     `json:"price" binding:"min=0"`
	Description string  `json:"description"`
	ImageKey    *string `json:"image_key"`
}

type adjustRequest struct {
	Delta int `json:"delta"`
}

func (h *InventoryHandler) CreateProduct(c *gin.Context) {
	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	inv := &domain.Inventory{
		Name:        req.Name,
		Price:       req.Price,
		Description: req.Description,
		ImageKey:    req.ImageKey,
		Count:       req.Count,
	}
	if err := h.uc.CreateProduct(c.Request.Context(), inv); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.JSON(http.StatusCreated, inv)
}

func (h *InventoryHandler) UpdateProduct(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	var req updateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	inv := &domain.Inventory{
		ID:          id,
		Name:        req.Name,
		Price:       req.Price,
		Description: req.Description,
		ImageKey:    req.ImageKey,
	}
	if err := h.uc.UpdateProduct(c.Request.Context(), inv); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.JSON(http.StatusOK, inv)
}

func (h *InventoryHandler) DeleteProduct(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	if err := h.uc.DeleteProduct(c.Request.Context(), id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *InventoryHandler) AdjustStock(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	var req adjustRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	if err := h.uc.AdjustStock(c.Request.Context(), id, req.Delta); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		if errors.Is(err, domain.ErrInsufficientStock) || errors.Is(err, domain.ErrInvalidQuantity) {
			c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *InventoryHandler) UploadImage(c *gin.Context) {
	fileHeader, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("image file is required"))
		return
	}
	if fileHeader.Size > domain.MaxImageSize {
		c.JSON(http.StatusUnprocessableEntity, errorResponse(domain.ErrImageTooLarge.Error()))
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("failed to read image file"))
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("failed to read image file"))
		return
	}

	imageKey, err := h.imgUc.UploadImage(c.Request.Context(), data)
	if err != nil {
		if errors.Is(err, domain.ErrUnsupportedImageType) || errors.Is(err, domain.ErrImageTooLarge) {
			c.JSON(http.StatusUnprocessableEntity, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"image_key": imageKey})
}

func parseID(c *gin.Context) (int, error) {
	return strconv.Atoi(c.Param("id"))
}

func errorResponse(msg string) gin.H {
	return gin.H{"error": msg}
}
