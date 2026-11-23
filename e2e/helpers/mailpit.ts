/** Lê os e-mails do Supabase local (Mailpit, porta 54324). */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; To: { Address: string }[]; Created: string };

/** Espera o próximo e-mail para `email` depois de `since` e devolve o link de acesso. */
export async function latestLinkFor(email: string, since: Date, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = (await res.json()) as { messages?: Summary[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= since.getTime() - 1000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*token_hash[^"]*)"/)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Nenhum e-mail de acesso chegou para ${email}`);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.com`;
}
