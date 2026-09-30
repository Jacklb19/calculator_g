package httpapi

import (
	"errors"
	"net/http"

	"github.com/Jacklb19/calculator/backend/internal/calculator"
)

var (
	errInvalidJSON          = errors.New("invalid JSON")
	errUnsupportedMediaType = errors.New("unsupported media type")
	errPayloadTooLarge      = errors.New("request body too large")
	errNotFound             = errors.New("not found")
	errMethodNotAllowed     = errors.New("method not allowed")
)

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func classify(err error) (status int, code string) {
	switch {
	case errors.Is(err, errInvalidJSON):
		return http.StatusBadRequest, "INVALID_JSON"
	case errors.Is(err, calculator.ErrInvalidOperands):
		return http.StatusBadRequest, "INVALID_OPERANDS"
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusNotFound, "UNKNOWN_OPERATION"
	case errors.Is(err, errNotFound):
		return http.StatusNotFound, "NOT_FOUND"
	case errors.Is(err, errMethodNotAllowed):
		return http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED"
	case errors.Is(err, errPayloadTooLarge):
		return http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE"
	case errors.Is(err, errUnsupportedMediaType):
		return http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE"
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "DIVISION_BY_ZERO"
	case errors.Is(err, calculator.ErrDomain):
		return http.StatusUnprocessableEntity, "DOMAIN_ERROR"
	case errors.Is(err, calculator.ErrOutOfRange):
		return http.StatusUnprocessableEntity, "RESULT_OUT_OF_RANGE"
	default:
		return http.StatusInternalServerError, "INTERNAL_ERROR"
	}
}
