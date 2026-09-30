package calculator

import "errors"

// Errors returned by Lookup and Operation.Apply. They are usually wrapped with details,
// so match them with errors.Is.
var (
	// ErrUnknownOperation means no operation is registered under the requested name.
	ErrUnknownOperation = errors.New("unknown operation")
	// ErrInvalidOperands means the operand count doesn't match the arity, or an operand is NaN or infinite.
	ErrInvalidOperands = errors.New("invalid operands")
	// ErrDivisionByZero means the operation divides by zero, including zero raised to a negative power.
	ErrDivisionByZero = errors.New("division by zero")
	// ErrDomain means the result is not a real number, such as the square root of a negative number.
	ErrDomain = errors.New("undefined result")
	// ErrOutOfRange means the result is too large in magnitude for a float64.
	ErrOutOfRange = errors.New("result out of range")
)
