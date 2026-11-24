import { AtSign, ChevronUp, CircleCheck, Heart, HelpCircle, MessageCircle, TriangleAlert, UserPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { NotificationView } from "@/lib/social/notification-queries";
import type { NotificationType } from "@/lib/social/notifications";
import { FollowButton } from "./follow-button";

const ICONS: Record<NotificationType, { Icon: typeof Heart; color: string }> = {
  follow: { Icon: UserPlus, color: "text-brand-accent" },
  like: { Icon: Heart, color: "text-status-danger" },
  vote: { Icon: ChevronUp, color: "text-brand-accent" },
  answer: { Icon: MessageCircle, color: "text-brand-accent" },
  comment: { Icon: MessageCircle, color: "text-brand-accent" },
  reply: { Icon: AtSign, color: "text-brand-accent" },
  accepted: { Icon: CircleCheck, color: "text-status-success" },
  detail_request: { Icon: HelpCircle, color: "text-status-warning" },
  demo_unavailable: { Icon: TriangleAlert, color: "text-status-warning" },
};

/** Tipos sem pessoa na frente: aparecem com um ícone no lugar da foto. */
const SYSTEM = new Set<NotificationType>(["accepted", "demo_unavailable"]);

type Props = { n: NotificationView; now: Date; followsActor: boolean; viewerId: string };

/** Uma notificação (ou um grupo: "Ana e mais 4 pessoas curtiram…"). */
export function NotificationItem({ n, now, followsActor, viewerId }: Props) {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const first = n.actors[0];
  const name = first?.displayName || first?.username || t("someone");
  const { Icon, color } = ICONS[n.type] ?? ICONS.comment;
  const system = SYSTEM.has(n.type) || !first;
  const b = (chunks: ReactNode) => <strong className="font-semibold text-text-primary">{chunks}</strong>;
  const text = t.rich(n.type, { name, others: Math.max(n.actors.length - 1, 0), title: n.target?.title ?? t("removed"), b });
  const showFollowBack = n.type === "follow" && !!first?.id && !!first.username && first.id !== viewerId && !followsActor;

  const body = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
      {n.target?.quote ? <p className="line-clamp-1 text-sm text-text-muted">“{n.target.quote}”</p> : null}
      <time dateTime={n.createdAt} className="text-xs text-text-subtle">
        {format.relativeTime(new Date(n.createdAt), now)}
      </time>
    </div>
  );

  return (
    <li className={`relative flex items-start gap-3.5 rounded-lg p-4 ${n.unread ? "border border-border-default bg-bg-surface" : ""}`} data-unread={n.unread || undefined}>
      <span className="relative shrink-0">
        {system ? (
          <span className={`flex size-11 items-center justify-center rounded-full bg-bg-elevated ${color}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : (
          <>
            <Avatar name={name} src={first?.avatarUrl} size="md" className="size-11" />
            <span className={`absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-border-default bg-bg-elevated ${color}`}>
              <Icon className="size-3" aria-hidden="true" />
            </span>
          </>
        )}
      </span>
      {n.target ? (
        <Link href={n.target.href} className="flex min-w-0 flex-1 rounded-sm hover:opacity-90">
          {body}
        </Link>
      ) : (
        body
      )}
      {showFollowBack ? <FollowButton profileId={first.id!} username={first.username!} following={false} signedIn path="/notificacoes" size="sm" label={t("followBack")} /> : null}
      {n.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-accent" aria-label={t("unread")} /> : null}
    </li>
  );
}
