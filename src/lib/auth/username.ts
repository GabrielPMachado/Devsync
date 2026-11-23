/** Mesma lista da constraint profiles_username_reserved no banco. */
export const RESERVED_USERNAMES = [
  "admin", "api", "perguntas", "projetos", "demo", "u", "tags", "busca",
  "explorar", "configuracoes", "login", "devsync", "suporte", "en",
] as const;

export type UsernameProblem = "short" | "long" | "chars" | "reserved";
export type UsernameCheck = { ok: true; username: string } | { ok: false; reason: UsernameProblem };

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Regras de profiles_username_format: ^[a-z0-9_]{3,30}$, fora os reservados. */
export function validateUsername(raw: string): UsernameCheck {
  const username = normalizeUsername(raw);
  if (username.length < 3) return { ok: false, reason: "short" };
  if (username.length > 30) return { ok: false, reason: "long" };
  if (!/^[a-z0-9_]+$/.test(username)) return { ok: false, reason: "chars" };
  if ((RESERVED_USERNAMES as readonly string[]).includes(username)) return { ok: false, reason: "reserved" };
  return { ok: true, username };
}
