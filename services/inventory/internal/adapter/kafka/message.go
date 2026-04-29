package kafka

type ReservationRequest struct {
	CorrelationID string `json:"correlation_id"`
	InventoryID   int    `json:"inventory_id"`
	Quantity      int    `json:"quantity"`
}

type ReservationResult struct {
	CorrelationID string `json:"correlation_id"`
	InventoryID   int    `json:"inventory_id"`
	Quantity      int    `json:"quantity"`
	Success       bool   `json:"success"`
	Error         string `json:"error"`
}
