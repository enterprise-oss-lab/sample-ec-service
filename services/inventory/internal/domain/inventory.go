package domain

import "errors"

type Inventory struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// Reserve は quantity 分の在庫を引当する
func (inv *Inventory) Reserve(quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be greater than 0")
	}
	if inv.Count < quantity {
		return errors.New("insufficient stock")
	}
	inv.Count -= quantity
	return nil
}

// Restock は quantity 分の在庫を補充する
func (inv *Inventory) Restock(quantity int) error {
	if quantity <= 0 {
		return errors.New("quantity must be greater than 0")
	}
	inv.Count += quantity
	return nil
}
