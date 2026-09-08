package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"enterprise-oss-lab/sample-ec-service/inventry/internal/domain"
	"enterprise-oss-lab/sample-ec-service/inventry/internal/usecase"
)

type ProductHandler struct {
	uc usecase.ProductUsecase
}

func NewProductHandler(uc usecase.ProductUsecase) *ProductHandler {
	return &ProductHandler{uc: uc}
}

func (h *ProductHandler) RegisterRoutes(r *gin.Engine) {
	g := r.Group("/products")
	g.GET("", h.ListProducts)
	g.GET("/:id", h.GetProduct)
}

func (h *ProductHandler) ListProducts(c *gin.Context) {
	products, err := h.uc.ListProducts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}
	if products == nil {
		products = []*domain.Product{}
	}
	c.JSON(http.StatusOK, products)
}

func (h *ProductHandler) GetProduct(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("invalid id"))
		return
	}

	product, err := h.uc.GetProduct(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrProductNotFound) {
			c.JSON(http.StatusNotFound, errorResponse(err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("internal server error"))
		return
	}

	c.JSON(http.StatusOK, product)
}
