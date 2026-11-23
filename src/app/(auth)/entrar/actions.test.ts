// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}));
vi.mock("@/lib/site-url", () => ({ siteUrl: async () => "http://localhost:3100" }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect }));

const { sendMagicLink, signInWithGithub } = await import("./actions");

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

beforeEach(() => vi.clearAllMocks());

describe("sendMagicLink", () => {
  it("recusa e-mail inválido sem chamar o Supabase", async () => {
    const res = await sendMagicLink({ status: "idle" }, form({ email: "nao-e-email" }));
    expect(res).toEqual({ status: "error", error: "email" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("envia o link com retorno para /auth/confirmar e o destino seguro", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const res = await sendMagicLink({ status: "idle" }, form({ email: " Ana@Exemplo.com ", next: "//evil.com" }));
    expect(res).toEqual({ status: "sent", email: "ana@exemplo.com" });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ana@exemplo.com",
      options: { emailRedirectTo: "http://localhost:3100/auth/confirmar?next=%2F", shouldCreateUser: true },
    });
  });

  it("traduz o limite de envios do Supabase", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    const res = await sendMagicLink({ status: "idle" }, form({ email: "ana@exemplo.com" }));
    expect(res).toEqual({ status: "error", error: "rate", email: "ana@exemplo.com" });
  });

  it("outros erros viram mensagem genérica", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 500, code: "unexpected_failure" } });
    const res = await sendMagicLink({ status: "idle" }, form({ email: "ana@exemplo.com" }));
    expect(res).toEqual({ status: "error", error: "unknown", email: "ana@exemplo.com" });
  });
});

describe("signInWithGithub", () => {
  it("manda para a URL de autorização com retorno em /auth/callback", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: "http://127.0.0.1:54321/auth/v1/authorize?provider=github" }, error: null });
    await expect(signInWithGithub(form({ next: "/estudos" }))).rejects.toThrow(
      "REDIRECT http://127.0.0.1:54321/auth/v1/authorize?provider=github",
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "http://localhost:3100/auth/callback?next=%2Festudos" },
    });
  });

  it("volta para /entrar com aviso quando o Supabase falha", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { status: 400 } });
    await expect(signInWithGithub(form({}))).rejects.toThrow("REDIRECT /entrar?erro=github");
  });
});
