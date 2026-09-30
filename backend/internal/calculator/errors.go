package calculator

import "errors"

var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrInvalidOperands  = errors.New("invalid operands")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrDomain           = errors.New("undefined result")
	ErrOutOfRange       = errors.New("result out of range")
)
