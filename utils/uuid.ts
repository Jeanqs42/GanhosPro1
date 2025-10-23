// Utilitário centralizado para gerar UUID v4 de forma segura
export function safeRandomUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID();
    }
  } catch {}
  const rnds = (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function')
    ? crypto.getRandomValues(new Uint8Array(16))
    : (() => {
        const arr = new Uint8Array(16);
        for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      })();
  // RFC 4122 v4
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 256; i++) hex[i] = (i + 0x100).toString(16).substring(1);
  return (
    hex[rnds[0]] + hex[rnds[1]] + hex[rnds[2]] + hex[rnds[3]] + '-' +
    hex[rnds[4]] + hex[rnds[5]] + '-' +
    hex[rnds[6]] + hex[rnds[7]] + '-' +
    hex[rnds[8]] + hex[rnds[9]] + '-' +
    hex[rnds[10]] + hex[rnds[11]] + hex[rnds[12]] + hex[rnds[13]] + hex[rnds[14]] + hex[rnds[15]]
  );
}