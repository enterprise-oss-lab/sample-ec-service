package domain

import "errors"

var (
	ErrInsufficientStock = errors.New("insufficient stock")
	ErrInvalidQuantity   = errors.New("quantity must be greater than 0")
)

type Inventory struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Reserve は quantity 分の在庫を引当する
func (inv *Inventory) Reserve(quantity int) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}
	if inv.Count < quantity {
		return ErrInsufficientStock
	}
	inv.Count -= quantity
	return nil
}

// Restock は quantity 分の在庫を補充する
func (inv *Inventory) Restock(quantity int) error {
	if quantity <= 0 {
		return ErrInvalidQuantity
	}
	inv.Count += quantity
	return nil
}
