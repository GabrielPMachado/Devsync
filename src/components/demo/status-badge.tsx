import { useTranslations } from "next-intl";
import type { DemoStatus } from "@/lib/demos/url";

const STYLES: Record<DemoStatus, string> = {
  live: "border-status-success/40 bg-status-success-soft text-status-success-text",
  pending: "border-brand-accent/40 bg-brand-accent-soft text-brand-accent",
  unavailable: "border-status-warning/40 bg-status-warning-soft text-status-warning-text",
  blocked: "border-status-danger/40 bg-status-danger-soft text-status-danger-text",
};

/** Selo do status da demo ("Demo ao vivo", "Processando"...). */
export function StatusBadge({ status }: { status: DemoStatus }) {
  const t = useTranslations("Demo.status");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {status === "live" ? <span className="size-1.5 rounded-full bg-status-success" aria-hidden="true" /> : null}
      {t(status)}
    </span>
  );
}
