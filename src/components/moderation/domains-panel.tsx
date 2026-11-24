"use client";

import { Ban, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { blockDomain, unblockDomain, type AdminResult } from "@/lib/moderation/actions";
import type { BlockedDomain } from "@/lib/moderation/queries";

const INPUT =
  "h-10 rounded-md border border-border-strong bg-bg-base px-3 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none";

/** Lista de domínios bloqueados para demos, com o formulário de bloquear. */
export function DomainsPanel({ domains }: { domains: BlockedDomain[] }) {
  const t = useTranslations("Admin");
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (call: () => Promise<AdminResult>, after?: () => void) =>
    start(async () => {
      const res = await call();
      if ("error" in res) return setError(t(`errors.${res.error}`));
      setError(null);
      after?.();
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">{t("domains.intro")}</p>
      <form
        className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4 md:flex-row md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => blockDomain(domain, reason), () => {
            setDomain("");
            setReason("");
          });
        }}
      >
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold text-text-primary" htmlFor={`${id}-d`}>
          {t("domains.domain")}
          <input id={`${id}-d`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t("domains.domainPlaceholder")} className={INPUT} />
        </label>
        <label className="flex flex-[2] flex-col gap-1.5 text-sm font-semibold text-text-primary" htmlFor={`${id}-r`}>
          {t("domains.reason")}
          <input id={`${id}-r`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={INPUT} />
        </label>
        <button type="submit" disabled={pending || !domain.trim()} className={buttonClasses()}>
          <Ban className="size-4" aria-hidden="true" />
          {t("domains.add")}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {error}
        </p>
      ) : null}
      {domains.length === 0 ? (
        <p className="text-sm text-text-muted">{t("domains.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default rounded-xl border border-border-default bg-bg-surface">
          {domains.map((d) => (
            <li key={d.domain} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className="font-mono text-sm text-text-primary">{d.domain}</span>
              {d.reason ? <span className="text-sm text-text-secondary">{d.reason}</span> : null}
              <span className="text-xs text-text-muted">{t("domains.added", { when: format.relativeTime(new Date(d.createdAt)) })}</span>
              <button type="button" disabled={pending} onClick={() => run(() => unblockDomain(d.domain))} className={`${buttonClasses({ variant: "ghost", size: "sm" })} ml-auto`}>
                <Trash2 className="size-4" aria-hidden="true" />
                {t("domains.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
