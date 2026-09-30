// Package calculator implements the calculator's operations, independent of how they are exposed.
package calculator

import (
	"fmt"
	"math"
)

// Operation is an arithmetic operation with a fixed number of operands.
// Get one from Lookup; the zero value cannot be applied.
type Operation struct {
	Name  string // identifier used in the API path, such as "add"
	Arity int    // number of operands Apply expects
	apply func(operands []float64) (float64, error)
}

var operations = index(
	binary("add", add),
	binary("subtract", subtract),
	binary("multiply", multiply),
	binary("divide", divide),
	binary("power", power),
	unary("sqrt", squareRoot),
	binary("percentage", percentage),
)

// Lookup returns the operation registered under name, which is case-sensitive.
// For unregistered names the error wraps ErrUnknownOperation.
func Lookup(name string) (Operation, error) {
	op, ok := operations[name]
	if !ok {
		return Operation{}, fmt.Errorf("%w: %q", ErrUnknownOperation, name)
	}
	return op, nil
}

// Apply validates the operands and computes the result. Errors wrap ErrInvalidOperands,
// ErrDivisionByZero, ErrDomain or ErrOutOfRange. A result without error is always finite
// and never negative zero.
func (op Operation) Apply(operands ...float64) (float64, error) {
	if err := op.validate(operands); err != nil {
		return 0, err
	}
	result, err := op.apply(operands)
	if err != nil {
		return 0, err
	}
	return checkResult(result)
}

func (op Operation) validate(operands []float64) error {
	if len(operands) != op.Arity {
		return fmt.Errorf("%w: %s expects %d operand(s), got %d",
			ErrInvalidOperands, op.Name, op.Arity, len(operands))
	}
	for i, x := range operands {
		if !isFinite(x) {
			return fmt.Errorf("%w: operand %d is not a finite number", ErrInvalidOperands, i+1)
		}
	}
	return nil
}

func checkResult(x float64) (float64, error) {
	switch {
	case math.IsNaN(x):
		return 0, ErrDomain
	case math.IsInf(x, 0):
		return 0, ErrOutOfRange
	case x == 0:
		// Collapses -0 to 0; encoding/json would otherwise emit "-0".
		return 0, nil
	default:
		return x, nil
	}
}

func isFinite(x float64) bool {
	return !math.IsNaN(x) && !math.IsInf(x, 0)
}

func unary(name string, f func(float64) (float64, error)) Operation {
	return Operation{
		Name:  name,
		Arity: 1,
		apply: func(x []float64) (float64, error) { return f(x[0]) },
	}
}

func binary(name string, f func(a, b float64) (float64, error)) Operation {
	return Operation{
		Name:  name,
		Arity: 2,
		apply: func(x []float64) (float64, error) { return f(x[0], x[1]) },
	}
}

func index(ops ...Operation) map[string]Operation {
	byName := make(map[string]Operation, len(ops))
	for _, op := range ops {
		byName[op.Name] = op
	}
	return byName
}
