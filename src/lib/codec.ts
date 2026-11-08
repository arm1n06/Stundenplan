// JSON ⇄ Base64 (UTF-8-sicher, damit Umlaute wie in "Öffentliches Dienstrecht" korrekt bleiben).
// btoa/atob arbeiten nur mit Latin-1, deshalb der Umweg über TextEncoder/TextDecoder.

const CHUNK = 0x8000

export function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function decode(base64: unknown): unknown {
  if (typeof base64 !== 'string' || base64 === '') throw new Error('Leere oder ungültige Daten')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}
