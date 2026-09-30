package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/Jacklb19/calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 10

type calculateRequest struct {
	// Pointers because encoding/json decodes null into a float64 as 0.
	Operands []*float64 `json:"operands"`
}

func decodeOperands(w http.ResponseWriter, r *http.Request) ([]float64, error) {
	if err := requireJSON(r); err != nil {
		return nil, err
	}
	var req calculateRequest
	if err := decodeStrict(w, r, &req); err != nil {
		return nil, err
	}
	return req.values()
}

func requireJSON(r *http.Request) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return fmt.Errorf("%w: Content-Type must be application/json", errUnsupportedMediaType)
	}
	return nil
}

func decodeStrict(w http.ResponseWriter, r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return decodeError(err)
	}
	return requireEOF(dec)
}

func requireEOF(dec *json.Decoder) error {
	err := dec.Decode(&struct{}{})
	var tooLarge *http.MaxBytesError
	switch {
	case errors.Is(err, io.EOF):
		return nil
	case errors.As(err, &tooLarge):
		return decodeError(err)
	default:
		return fmt.Errorf("%w: unexpected data after JSON body", errInvalidJSON)
	}
}

func decodeError(err error) error {
	var tooLarge *http.MaxBytesError
	var typeErr *json.UnmarshalTypeError
	switch {
	case errors.As(err, &tooLarge):
		return fmt.Errorf("%w: limit is %d bytes", errPayloadTooLarge, tooLarge.Limit)
	case errors.Is(err, io.EOF):
		return fmt.Errorf("%w: body is empty", errInvalidJSON)
	case errors.As(err, &typeErr) && strings.HasPrefix(typeErr.Field, "operands"):
		return fmt.Errorf("%w: operands must be an array of numbers, found %s", calculator.ErrInvalidOperands, typeErr.Value)
	default:
		return fmt.Errorf("%w: %v", errInvalidJSON, err)
	}
}

func (req calculateRequest) values() ([]float64, error) {
	if req.Operands == nil {
		return nil, fmt.Errorf("%w: operands is required", calculator.ErrInvalidOperands)
	}
	values := make([]float64, len(req.Operands))
	for i, operand := range req.Operands {
		if operand == nil {
			return nil, fmt.Errorf("%w: operand %d is null", calculator.ErrInvalidOperands, i+1)
		}
		values[i] = *operand
	}
	return values, nil
}
