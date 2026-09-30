package calculator

import (
	"fmt"
	"math"
)

type Operation struct {
	Name  string
	Arity int
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

func Lookup(name string) (Operation, error) {
	op, ok := operations[name]
	if !ok {
		return Operation{}, fmt.Errorf("%w: %q", ErrUnknownOperation, name)
	}
	return op, nil
}

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
