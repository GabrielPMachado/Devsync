/** Motivos devolvidos pelo serviço de demos (workers/demos/README.md). */
export const REJECTION_REASONS = [
  // zip recusado
  "too_large", "not_a_zip", "unsupported_zip", "encrypted", "too_many_files", "unsafe_path", "symlink",
  "extension_not_allowed", "duplicate_path", "no_index", "too_big_uncompressed", "corrupt",
  // link que não pode ser embutido
  "invalid_url", "not_https", "unsafe", "unreachable", "http_error", "too_many_redirects", "x_frame_options", "csp_frame_ancestors",
  // domínio na lista de bloqueio da moderação (banco, não o serviço de demos)
  "blocked_domain",
] as const;

export type ReasonKey = (typeof REJECTION_REASONS)[number] | "unknown";

/** Chave de texto em `DemoReasons` para um código do serviço de demos. */
export function reasonKey(code: string | null | undefined): ReasonKey {
  return (REJECTION_REASONS as readonly string[]).includes(code ?? "") ? (code as ReasonKey) : "unknown";
}

/** Motivos de link que o autor resolve liberando o embed no próprio site. */
export const EMBED_BLOCKED = new Set<string>(["x_frame_options", "csp_frame_ancestors"]);
