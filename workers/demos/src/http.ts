import { allowedOrigins, type Env } from "./env";

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}

const CORS_HEADERS = {
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

/** Acrescenta CORS só para as origens do site. */
export function withCors(res: Response, origin: string | null, env: Env): Response {
  if (!origin || !allowedOrigins(env).includes(origin)) return res;
  const out = new Response(res.body, res);
  out.headers.set("access-control-allow-origin", origin);
  out.headers.append("vary", "Origin");
  for (const [k, v] of Object.entries(CORS_HEADERS)) out.headers.set(k, v);
  return out;
}
