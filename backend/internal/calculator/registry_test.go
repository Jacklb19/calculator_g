package calculator_test

import (
	"errors"
	"math"
	"testing"

	"github.com/Jacklb19/calculator/backend/internal/calculator"
)

func TestLookupRegistersEveryOperation(t *testing.T) {
	arities := map[string]int{
		"add":        2,
		"subtract":   2,
		"multiply":   2,
		"divide":     2,
		"power":      2,
		"sqrt":       1,
		"percentage": 2,
	}

	for name, arity := range arities {
		t.Run(name, func(t *testing.T) {
			op, err := calculator.Lookup(name)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if op.Name != name {
				t.Errorf("Name = %q, want %q", op.Name, name)
			}
			if op.Arity != arity {
				t.Errorf("Arity = %d, want %d", op.Arity, arity)
			}
		})
	}
}

func TestLookupRejectsUnknownOperation(t *testing.T) {
	for _, name := range []string{"", "modulo", "ADD", " add"} {
		t.Run(name, func(t *testing.T) {
			_, err := calculator.Lookup(name)
			if !errors.Is(err, calculator.ErrUnknownOperation) {
				t.Errorf("got error %v, want ErrUnknownOperation", err)
			}
		})
	}
}

func TestApplyRejectsInvalidOperands(t *testing.T) {
	tests := []struct {
		name     string
		op       string
		operands []float64
	}{
		{"no operands", "divide", nil},
		{"too few", "add", []float64{1}},
		{"too many for binary", "subtract", []float64{1, 2, 3}},
		{"too many for unary", "sqrt", []float64{4, 9}},
		{"NaN", "add", []float64{math.NaN(), 1}},
		{"positive infinity", "multiply", []float64{2, math.Inf(1)}},
		{"negative infinity", "sqrt", []float64{math.Inf(-1)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := apply(t, tt.op, tt.operands...)
			if !errors.Is(err, calculator.ErrInvalidOperands) {
				t.Errorf("got error %v, want ErrInvalidOperands", err)
			}
		})
	}
}
