package calculator_test

import (
	"errors"
	"math"
	"testing"

	"github.com/Jacklb19/calculator/backend/internal/calculator"
)

func TestApplyReturnsResult(t *testing.T) {
	tests := []struct {
		name     string
		op       string
		operands []float64
		want     float64
	}{
		{"add integers", "add", []float64{2, 3}, 5},
		{"add negatives", "add", []float64{-2.5, -0.5}, -3},
		{"subtract into negative", "subtract", []float64{3, 5}, -2},
		{"multiply fractions", "multiply", []float64{0.5, 0.25}, 0.125},
		{"multiply by zero", "multiply", []float64{7, 0}, 0},
		{"divide", "divide", []float64{10, 4}, 2.5},
		{"divide negative", "divide", []float64{-9, 3}, -3},
		{"divide zero by number", "divide", []float64{0, 5}, 0},
		{"power", "power", []float64{2, 10}, 1024},
		{"power negative exponent", "power", []float64{2, -2}, 0.25},
		{"power zero to zero", "power", []float64{0, 0}, 1},
		{"power negative base integer exponent", "power", []float64{-2, 3}, -8},
		{"sqrt", "sqrt", []float64{16}, 4},
		{"sqrt zero", "sqrt", []float64{0}, 0},
		{"percentage", "percentage", []float64{50, 200}, 100},
		{"percentage fractional", "percentage", []float64{15, 80}, 12},
		{"percentage over hundred", "percentage", []float64{150, 40}, 60},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := apply(t, tt.op, tt.operands...)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestApplyReturnsMathError(t *testing.T) {
	tests := []struct {
		name     string
		op       string
		operands []float64
		want     error
	}{
		{"divide by zero", "divide", []float64{1, 0}, calculator.ErrDivisionByZero},
		{"zero divided by zero", "divide", []float64{0, 0}, calculator.ErrDivisionByZero},
		{"zero to negative power", "power", []float64{0, -1}, calculator.ErrDivisionByZero},
		{"sqrt of negative", "sqrt", []float64{-4}, calculator.ErrDomain},
		{"negative base fractional exponent", "power", []float64{-8, 0.5}, calculator.ErrDomain},
		{"add overflow", "add", []float64{math.MaxFloat64, math.MaxFloat64}, calculator.ErrOutOfRange},
		{"multiply overflow", "multiply", []float64{math.MaxFloat64, 2}, calculator.ErrOutOfRange},
		{"power overflow", "power", []float64{10, 400}, calculator.ErrOutOfRange},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := apply(t, tt.op, tt.operands...)
			if !errors.Is(err, tt.want) {
				t.Fatalf("got error %v, want %v", err, tt.want)
			}
			if got != 0 {
				t.Errorf("got result %v alongside error, want 0", got)
			}
		})
	}
}

func TestPercentageOfHugeNumbers(t *testing.T) {
	tests := []struct {
		name     string
		operands []float64
		want     float64
	}{
		{"percent times total overflows", []float64{1e308, 10}, 1e307},
		{"negative percent", []float64{-1e308, 50}, -5e307},
		{"total near the float64 limit", []float64{50, math.MaxFloat64}, math.MaxFloat64 / 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := apply(t, "percentage", tt.operands...)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if relativeError(got, tt.want) > 1e-15 {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPercentageStillOverflowsWhenTheResultDoesNotFit(t *testing.T) {
	_, err := apply(t, "percentage", 1e308, 1e5)
	if !errors.Is(err, calculator.ErrOutOfRange) {
		t.Errorf("got error %v, want ErrOutOfRange", err)
	}
}

func relativeError(got, want float64) float64 {
	return math.Abs(got-want) / math.Abs(want)
}

func TestApplyNeverReturnsNegativeZero(t *testing.T) {
	got, err := apply(t, "multiply", -1, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if math.Signbit(got) {
		t.Errorf("got -0, want 0")
	}
}

func apply(t *testing.T, name string, operands ...float64) (float64, error) {
	t.Helper()
	op, err := calculator.Lookup(name)
	if err != nil {
		t.Fatalf("Lookup(%q): %v", name, err)
	}
	return op.Apply(operands...)
}
