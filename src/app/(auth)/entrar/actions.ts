"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: "email" | "rate" | "unknown"; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nextFrom(formData: FormData): string {
  return encodeURIComponent(safeNext(formData.get("next")?.toString()));
}

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = (formData.get("email")?.toString() ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { status: "error", error: "email" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // O template do e-mail acrescenta &token_hash=...&type=email a este endereço.
      emailRedirectTo: `${await siteUrl()}/auth/confirmar?next=${nextFrom(formData)}`,
      shouldCreateUser: true,
    },
  });
  if (!error) return { status: "sent", email };
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return { status: "error", error: "rate", email };
  return { status: "error", error: "unknown", email };
}

export async function signInWithGithub(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${nextFrom(formData)}` },
  });
  if (error || !data.url) redirect("/entrar?erro=github");
  redirect(data.url);
}
