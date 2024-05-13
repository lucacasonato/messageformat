const isNameStartCode = (cc: number) =>
  (cc >= 0x41 && cc <= 0x5a) || // A-Z
  cc === 0x5f || // _
  (cc >= 0x61 && cc <= 0x7a) || // a-z
  (cc >= 0xc0 && cc <= 0xd6) || // À-Ö
  (cc >= 0xd8 && cc <= 0xf6) || // Ø-ö
  (cc >= 0xf8 && cc <= 0x2ff) ||
  (cc >= 0x370 && cc <= 0x37d) ||
  (cc >= 0x37f && cc <= 0x1fff) ||
  (cc >= 0x200c && cc <= 0x200d) ||
  (cc >= 0x2070 && cc <= 0x2187) ||
  (cc >= 0x2c00 && cc <= 0x2fef) ||
  (cc >= 0x3001 && cc <= 0xd7ff) ||
  (cc >= 0xf900 && cc <= 0xfdcf) ||
  (cc >= 0xfdf0 && cc <= 0xfffd) ||
  (cc >= 0x10000 && cc <= 0xeffff);

const isNameCharCode = (cc: number) =>
  isNameStartCode(cc) ||
  cc === 0x2d || // -
  cc === 0x2e || // .
  (cc >= 0x30 && cc <= 0x39) || // 0-9
  cc === 0xb7 || // ·
  (cc >= 0x300 && cc <= 0x36f) ||
  cc === 0x203f || // ‿
  cc === 0x2040; // ⁀

// This is sticky so that parsing doesn't need to substring the source
const numberLiteral = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/y;

export function parseNameValue(
  src: string,
  start: number
): { value: string; length: number } {
  let valueStart = start;
  const cc0 = src.charCodeAt(start);
  if (cc0 === 0x2066 || cc0 === 0x2067 || cc0 === 0x2068) valueStart += 1;
  let pos = valueStart;
  if (isNameStartCode(src.charCodeAt(pos))) {
    pos += 1;
    while (isNameCharCode(src.charCodeAt(pos))) pos += 1;
  }
  const value = src.substring(valueStart, pos);
  let length = pos - start;
  if (src.charCodeAt(pos) === 0x2069) length += 1;
  return { value, length };
}

export function isValidUnquotedLiteral(str: string): boolean {
  numberLiteral.lastIndex = 0;
  const num = numberLiteral.exec(str);
  if (num && num[0].length === str.length) return true;

  if (!isNameStartCode(str.charCodeAt(0))) return false;
  for (let i = 1; i < str.length; ++i) {
    const cc = str.charCodeAt(i);
    if (!isNameCharCode(cc)) return false;
  }
  return str.length > 0;
}

export function parseUnquotedLiteralValue(
  source: string,
  start: number
): { value: string; length: number } {
  numberLiteral.lastIndex = start;
  const num = numberLiteral.exec(source);
  return num
    ? { value: num[0], length: num[0].length }
    : parseNameValue(source, start);
}
