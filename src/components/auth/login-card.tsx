"use client";

import { Mail, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { sendMagicLink, signInWithGithub, type MagicLinkState } from "@/app/(auth)/entrar/actions";
import { GithubIcon } from "@/components/icons/github";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

const RESEND_SECONDS = 60;
const IDLE: MagicLinkState = { status: "idle" };

type Props = { next: string; notice: "link" | "github" | "config" | null };

export function LoginCard({ next, notice }: Props) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, IDLE);
  const [editing, setEditing] = useState(false);
  const [lastSent, setLastSent] = useState<MagicLinkState>(IDLE);
  const [seconds, setSeconds] = useState(0);

  // Cada envio novo reabre a tela "Confira seu e-mail" e reinicia a contagem.
  if (state !== lastSent) {
    setLastSent(state);
    if (state.status === "sent") {
      setEditing(false);
      setSeconds(RESEND_SECONDS);
    }
  }

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const disabled = notice === "config";
  const sent = state.status === "sent" && !editing;
  const emailError =
    state.status === "error" ? t(state.error === "email" ? "errorEmail" : state.error === "rate" ? "errorRate" : "errorUnknown") : undefined;
  const noticeText = notice === "link" ? t("errorLink") : notice === "github" ? t("errorGithub") : notice === "config" ? t("errorConfig") : null;

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <span className="w-fit rounded-full bg-brand-accent-soft p-3.5 text-brand-accent">
          <Mail className="size-7" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("sentTitle")}</h1>
        <p className="text-sm leading-relaxed text-text-muted" role="status">
          {t.rich("sentText", { email: state.email, strong: (c) => <strong className="text-text-primary">{c}</strong> })}
        </p>
        <form action={action}>
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          {seconds > 0 ? (
            <p className="text-xs text-text-subtle">{t("resendIn", { seconds })}</p>
          ) : (
            <Button type="submit" variant="secondary" full disabled={pending}>
              <Send className="size-4" aria-hidden="true" />
              {pending ? t("sending") : t("resend")}
            </Button>
          )}
        </form>
        <hr className="border-border-default" />
        <button type="button" onClick={() => setEditing(true)} className="w-fit text-sm font-semibold text-text-link hover:underline">
          {t("otherEmail")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t("subtitle")}</p>
      </div>

      {noticeText ? (
        <p role="alert" className="rounded-md border border-status-warning bg-status-warning-soft px-3 py-2 text-sm text-status-warning-text">
          {noticeText}
        </p>
      ) : null}

      <form action={signInWithGithub}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" size="lg" full disabled={disabled}>
          <GithubIcon />
          {t("github")}
        </Button>
      </form>

      <div className="flex items-center gap-3" aria-hidden="true">
        <hr className="flex-1 border-border-default" />
        <span className="text-xs text-text-subtle">{t("or")}</span>
        <hr className="flex-1 border-border-default" />
      </div>

      <form action={action} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <TextField
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("emailPlaceholder")}
          defaultValue={state.status === "error" ? state.email : lastEmail(state, editing)}
          error={emailError}
          required
          disabled={disabled}
        />
        <Button type="submit" variant="secondary" size="lg" full disabled={pending || disabled}>
          <Send className="size-4" aria-hidden="true" />
          {pending ? t("sending") : t("sendLink")}
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-text-subtle">
        {t.rich("terms", {
          rules: (c) => <strong className="font-semibold text-text-link">{c}</strong>,
          privacy: (c) => <strong className="font-semibold text-text-link">{c}</strong>,
        })}
      </p>
    </div>
  );
}

function lastEmail(state: MagicLinkState, editing: boolean): string | undefined {
  return editing && state.status === "sent" ? state.email : undefined;
}
