/**
 * Destino depois do login. Só aceita caminhos deste site ("/algo"); qualquer
 * coisa que o navegador possa ler como outro domínio volta para o fallback.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || decoded.startsWith("/\\") || /[\u0000-\u001f]/.test(decoded)) return fallback;
  return next;
}
