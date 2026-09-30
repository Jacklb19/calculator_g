package calculator

import (
	"fmt"
	"math"
)

func add(a, b float64) (float64, error)      { return a + b, nil }
func subtract(a, b float64) (float64, error) { return a - b, nil }
func multiply(a, b float64) (float64, error) { return a * b, nil }

func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

func power(base, exponent float64) (float64, error) {
	if base == 0 && exponent < 0 {
		return 0, fmt.Errorf("%w: zero raised to a negative power", ErrDivisionByZero)
	}
	return math.Pow(base, exponent), nil
}

func squareRoot(x float64) (float64, error) {
	if x < 0 {
		return 0, fmt.Errorf("%w: square root of a negative number", ErrDomain)
	}
	return math.Sqrt(x), nil
}

// percentage returns percent% of total.
func percentage(percent, total float64) (float64, error) {
	result := percent * total / 100
	if math.IsInf(result, 0) {
		// percent*total can overflow even when the result fits (1e308% of 10). Dividing first
		// avoids that, but costs precision for ordinary inputs (7% of 3), so it is only the fallback.
		result = percent / 100 * total
	}
	return result, nil
}
