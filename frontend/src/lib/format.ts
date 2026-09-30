const SIGNIFICANT_DIGITS = 15

// toPrecision already switches to exponential notation exactly where 15 digits stop being enough
// (exponent >= 15 or < -6). Its string is used directly: parsing it back overflows near Number.MAX_VALUE.
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'

  const [mantissa, exponent] = value.toPrecision(SIGNIFICANT_DIGITS).split('e')
  const trimmed = trimTrailingZeros(mantissa)
  return exponent ? `${trimmed}e${exponent}` : trimmed
}

function trimTrailingZeros(mantissa: string): string {
  return mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa
}
