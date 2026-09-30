package httpapi

import (
	"encoding/json"
	"net/http"
)

func (s *server) writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		s.logger.Error("encoding response", "err", err)
	}
}

func (s *server) writeError(w http.ResponseWriter, err error) {
	status, code := classify(err)
	message := err.Error()
	if status == http.StatusInternalServerError {
		s.logger.Error("internal error", "err", err)
		message = "internal server error"
	}
	s.writeJSON(w, status, errorResponse{Error: errorBody{Code: code, Message: message}})
}
