export function hexToRgb(hex, opacity = 1) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((part) => part + part)
        .join('')
    : normalized;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);

  if (!result) {
    return `rgba(0,0,0,${opacity})`;
  }

  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${opacity})`;
}

export function hexToNumber(hex) {
  return Number.parseInt(hex.replace('#', ''), 16);
}
