import type { Env } from "./env";

export class SupabaseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

export interface Rest {
  select<T>(table: string, query: string): Promise<T[]>;
  insert<T>(table: string, row: Record<string, unknown>): Promise<T>;
  update(table: string, query: string, patch: Record<string, unknown>): Promise<void>;
}

function rest(env: Env, apikey: string, token: string, f: typeof fetch): Rest {
  const base = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`;
  const headers = { apikey, authorization: `Bearer ${token}`, "content-type": "application/json" };

  async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const res = await f(base + path, {
      method,
      headers: { ...headers, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new SupabaseError(res.status, data.code, data.message ?? `Supabase respondeu ${res.status}`);
    }
    return res;
  }

  return {
    async select<T>(table: string, query: string) {
      return (await (await call("GET", `${table}?${query}`)).json()) as T[];
    },
    async insert<T>(table: string, row: Record<string, unknown>) {
      const res = await call("POST", table, row, { prefer: "return=representation" });
      const rows = (await res.json()) as T[];
      return rows[0] as T;
    },
    async update(table: string, query: string, patch: Record<string, unknown>) {
      await call("PATCH", `${table}?${query}`, patch, { prefer: "return=minimal" });
    },
  };
}

/** Chamadas como o usuário: RLS e gatilhos do banco se aplicam. */
export const userRest = (env: Env, token: string, f: typeof fetch) => rest(env, env.SUPABASE_ANON_KEY, token, f);

/** Chamadas anônimas (só o que é público pela RLS). */
export const anonRest = (env: Env, f: typeof fetch) => rest(env, env.SUPABASE_ANON_KEY, env.SUPABASE_ANON_KEY, f);

/** Chamadas do serviço (ignora RLS). Só para gravar resultados de validação. */
export const serviceRest = (env: Env, f: typeof fetch) =>
  rest(env, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY, f);

export async function getUser(env: Env, token: string, f: typeof fetch): Promise<{ id: string } | null> {
  const res = await f(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ? { id: data.id } : null;
}

export function bearer(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  return m ? m[1]!.trim() : null;
}
