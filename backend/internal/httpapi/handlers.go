package httpapi

import (
	"net/http"

	"github.com/Jacklb19/calculator/backend/internal/calculator"
)

type calculateResponse struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
	Result    float64   `json:"result"`
}

func (s *server) handleCalculate(w http.ResponseWriter, r *http.Request) {
	resp, err := calculate(w, r)
	if err != nil {
		s.writeError(w, err)
		return
	}
	s.writeJSON(w, http.StatusOK, resp)
}

func calculate(w http.ResponseWriter, r *http.Request) (calculateResponse, error) {
	op, err := calculator.Lookup(r.PathValue("operation"))
	if err != nil {
		return calculateResponse{}, err
	}
	operands, err := decodeOperands(w, r)
	if err != nil {
		return calculateResponse{}, err
	}
	result, err := op.Apply(operands...)
	if err != nil {
		return calculateResponse{}, err
	}
	return calculateResponse{Operation: op.Name, Operands: operands, Result: result}, nil
}

func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
