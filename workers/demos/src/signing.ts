const enc = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

const message = (demoId: string, version: number, expiresAt: number) => enc.encode(`${demoId}:${version}:${expiresAt}`);

export async function signUpload(secret: string, demoId: string, version: number, expiresAt: number): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await key(secret), message(demoId, version, expiresAt));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyUpload(
  secret: string,
  demoId: string,
  version: number,
  expiresAt: number,
  sig: string,
  now: number,
): Promise<boolean> {
  if (!Number.isFinite(expiresAt) || now > expiresAt) return false;
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const bytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)));
  // crypto.subtle.verify compara em tempo constante.
  return crypto.subtle.verify("HMAC", await key(secret), bytes, message(demoId, version, expiresAt));
}

// Passe do print: o navegador do Browser Rendering abre a demo enviada fora de iframe.
// Mensagem com prefixo próprio: um passe de upload nunca vale como passe de print.
const shotMessage = (demoId: string, expiresAt: number) => enc.encode(`shot:${demoId}:${expiresAt}`);

export async function signShot(secret: string, demoId: string, expiresAt: number): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", await key(secret), shotMessage(demoId, expiresAt));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyShot(secret: string, demoId: string, expiresAt: number, sig: string, now: number): Promise<boolean> {
  if (!Number.isFinite(expiresAt) || now > expiresAt) return false;
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const bytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", await key(secret), bytes, shotMessage(demoId, expiresAt));
}
