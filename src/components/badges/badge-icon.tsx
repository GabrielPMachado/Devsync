import { CircleCheck, Crown, GraduationCap, Hammer, HelpCircle, Rocket, Users, type LucideIcon } from "lucide-react";
import type { BadgeKey } from "@/lib/social/badges";

/** Ícone e cor de cada insígnia: sóbrios, dentro do azul/ciano, com o dourado só no fundador. */
export const BADGE_STYLE: Record<BadgeKey, { Icon: LucideIcon; color: string }> = {
  founder: { Icon: Crown, color: "text-amber-300" },
  first_project: { Icon: Rocket, color: "text-cyan-400" },
  builder: { Icon: Hammer, color: "text-blue-400" },
  curious: { Icon: HelpCircle, color: "text-cyan-300" },
  first_accepted: { Icon: CircleCheck, color: "text-status-success" },
  mentor: { Icon: GraduationCap, color: "text-brand-accent" },
  popular: { Icon: Users, color: "text-blue-300" },
};

const SIZES = { sm: "size-6 [&_svg]:size-3.5", md: "size-9 [&_svg]:size-4.5", lg: "size-12 [&_svg]:size-6" } as const;

type Props = { badge: BadgeKey; size?: keyof typeof SIZES; muted?: boolean };

/** O ícone redondo da insígnia. Decorativo: quem usa dá o nome (aria-label ou texto ao lado). */
export function BadgeIcon({ badge, size = "sm", muted = false }: Props) {
  const { Icon, color } = BADGE_STYLE[badge];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${SIZES[size]} ${
        muted ? "border-border-default bg-bg-base text-text-subtle opacity-60" : `border-border-default bg-bg-elevated ${color}`
      }`}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
