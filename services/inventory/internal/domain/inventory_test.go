package domain

import (
	"testing"
)

func TestInventory_Reserve(t *testing.T) {
	tests := []struct {
		name      string
		initial   int
		quantity  int
		wantCount int
		wantErr   string
	}{
		{
			name:      "正常に引当できる",
			initial:   10,
			quantity:  5,
			wantCount: 5,
		},
		{
			name:      "在庫と同数の引当",
			initial:   10,
			quantity:  10,
			wantCount: 0,
		},
		{
			name:     "在庫不足",
			initial:  5,
			quantity: 10,
			wantErr:  "insufficient stock",
		},
		{
			name:     "quantity が 0",
			initial:  10,
			quantity: 0,
			wantErr:  "quantity must be greater than 0",
		},
		{
			name:     "quantity が負数",
			initial:  10,
			quantity: -1,
			wantErr:  "quantity must be greater than 0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &Inventory{Count: tt.initial}
			err := inv.Reserve(tt.quantity)

			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("Reserve() error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Errorf("Reserve() unexpected error: %v", err)
			}
			if inv.Count != tt.wantCount {
				t.Errorf("Reserve() Count = %d, want %d", inv.Count, tt.wantCount)
			}
		})
	}
}

func TestInventory_Restock(t *testing.T) {
	tests := []struct {
		name      string
		initial   int
		quantity  int
		wantCount int
		wantErr   string
	}{
		{
			name:      "正常に補充できる",
			initial:   10,
			quantity:  5,
			wantCount: 15,
		},
		{
			name:      "在庫 0 からの補充",
			initial:   0,
			quantity:  10,
			wantCount: 10,
		},
		{
			name:     "quantity が 0",
			initial:  10,
			quantity: 0,
			wantErr:  "quantity must be greater than 0",
		},
		{
			name:     "quantity が負数",
			initial:  10,
			quantity: -1,
			wantErr:  "quantity must be greater than 0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &Inventory{Count: tt.initial}
			err := inv.Restock(tt.quantity)

			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Errorf("Restock() error = %v, want %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Errorf("Restock() unexpected error: %v", err)
			}
			if inv.Count != tt.wantCount {
				t.Errorf("Restock() Count = %d, want %d", inv.Count, tt.wantCount)
			}
		})
	}
}
