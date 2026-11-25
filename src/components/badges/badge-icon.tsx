import type { CSSProperties } from "react";
import {
  Award,
  Brain,
  Building2,
  CircleCheck,
  Crown,
  Gem,
  HandHeart,
  Layers,
  MessageCircleMore,
  Microscope,
  Network,
  Radio,
  Scale,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  UserPlus,
  Zap,
  GraduationCap,
  Hammer,
  HandHelping,
  Heart,
  HelpCircle,
  Megaphone,
  MessageSquareReply,
  MessagesSquare,
  Rocket,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BadgeKey } from "@/lib/social/badges";

/**
 * Ícone, cor e nível de cada insígnia. O nível dá o acabamento do aro:
 * 1 = aro simples, 2 = aro na cor da insígnia, 3 = aro em gradiente com brilho.
 * Cores sóbrias, dentro do azul/ciano; o dourado fica só para o fundador.
 */
type BadgeStyle = {
  Icon: LucideIcon;
  color: string;
  tier: 1 | 2 | 3;
  /** Insígnias novas: efeito do ícone (src/styles/profile-motion.css) e duração em segundos. */
  motion?: { effect: string; seconds: number };
};

export const BADGE_STYLE: Record<BadgeKey, BadgeStyle> = {
  founder: { Icon: Crown, color: "text-amber-300", tier: 3 },
  first_project: { Icon: Rocket, color: "text-cyan-400", tier: 1 },
  builder: { Icon: Hammer, color: "text-blue-400", tier: 2 },
  architect: { Icon: Building2, color: "text-[#7DD3FC]", tier: 3 },
  loved: { Icon: Heart, color: "text-[#FB7185]", tier: 2 },
  curious: { Icon: HelpCircle, color: "text-cyan-300", tier: 1 },
  investigator: { Icon: Telescope, color: "text-[#A5B4FC]", tier: 2 },
  first_answer: { Icon: MessageSquareReply, color: "text-[#5EEAD4]", tier: 1 },
  helper: { Icon: HandHelping, color: "text-[#5EEAD4]", tier: 2 },
  first_accepted: { Icon: CircleCheck, color: "text-status-success", tier: 1 },
  mentor: { Icon: GraduationCap, color: "text-brand-accent", tier: 2 },
  sage: { Icon: Brain, color: "text-[#C4B5FD]", tier: 3 },
  commenter: { Icon: MessagesSquare, color: "text-[#93C5FD]", tier: 1 },
  popular: { Icon: Users, color: "text-[#93C5FD]", tier: 2 },
  influencer: { Icon: Megaphone, color: "text-cyan-300", tier: 3 },
  // Segunda leva: cada uma com um movimento próprio.
  demo_live: { Icon: Radio, color: "text-[#F87171]", tier: 1, motion: { effect: "live", seconds: 1.6 } },
  prolific: { Icon: Layers, color: "text-[#93C5FD]", tier: 3, motion: { effect: "bob", seconds: 1.4 } },
  star: { Icon: Star, color: "text-amber-300", tier: 3, motion: { effect: "flip", seconds: 4 } },
  well_voted: { Icon: ThumbsUp, color: "text-[#5EEAD4]", tier: 2, motion: { effect: "wiggle", seconds: 2.6 } },
  reference: { Icon: Award, color: "text-[#7DD3FC]", tier: 3, motion: { effect: "glow", seconds: 2.4 } },
  researcher: { Icon: Microscope, color: "text-[#A5B4FC]", tier: 3, motion: { effect: "orbit", seconds: 3 } },
  tireless: { Icon: Zap, color: "text-amber-300", tier: 3, motion: { effect: "zap", seconds: 2.2 } },
  legend: { Icon: Trophy, color: "text-amber-300", tier: 3, motion: { effect: "float", seconds: 3.2 } },
  reviewer: { Icon: Scale, color: "text-[#93C5FD]", tier: 2, motion: { effect: "sway", seconds: 2.8 } },
  first_follower: { Icon: UserPlus, color: "text-cyan-300", tier: 1, motion: { effect: "pop", seconds: 2.5 } },
  connected: { Icon: Network, color: "text-cyan-400", tier: 2, motion: { effect: "spin", seconds: 8 } },
  supporter: { Icon: HandHeart, color: "text-[#FB7185]", tier: 2, motion: { effect: "heartbeat", seconds: 1.4 } },
  fan: { Icon: Sparkles, color: "text-[#F9A8D4]", tier: 3, motion: { effect: "twinkle", seconds: 2 } },
  debater: { Icon: MessageCircleMore, color: "text-[#93C5FD]", tier: 3, motion: { effect: "nod", seconds: 1.8 } },
  icon: { Icon: Gem, color: "text-cyan-300", tier: 3, motion: { effect: "hue", seconds: 6 } },
};

const SIZES = { sm: "size-6 [&_svg]:size-3.5", md: "size-9 [&_svg]:size-4.5", lg: "size-12 [&_svg]:size-6" } as const;

const TIER_RING = {
  1: "border border-border-default",
  2: "border border-current/40",
  3: "border border-transparent [background:linear-gradient(var(--color-bg-elevated),var(--color-bg-elevated))_padding-box,linear-gradient(135deg,#2563EB,#22D3EE)_border-box] shadow-[0_0_12px_rgb(34_211_238/0.25)]",
} as const;
const FOUNDER_RING =
  "border border-transparent [background:linear-gradient(var(--color-bg-elevated),var(--color-bg-elevated))_padding-box,linear-gradient(135deg,#FDE68A,#F59E0B,#B45309)_border-box] shadow-[0_0_12px_rgb(245_158_11/0.25)]";

type Props = { badge: BadgeKey; size?: keyof typeof SIZES; muted?: boolean };

/** O ícone redondo da insígnia. Decorativo: quem usa dá o nome (aria-label ou texto ao lado). */
export function BadgeIcon({ badge, size = "sm", muted = false }: Props) {
  const { Icon, color, tier, motion } = BADGE_STYLE[badge];
  // Bloqueada fica parada; conquistada se mexe (menos para quem pede menos movimento).
  const moving = motion && !muted;
  const ring = badge === "founder" ? FOUNDER_RING : TIER_RING[tier];
  return (
    <span
      data-tier={tier}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZES[size]} ${
        muted ? "border border-dashed border-border-default bg-bg-base text-text-subtle opacity-70" : `bg-bg-elevated ${color} ${ring}`
      }`}
      aria-hidden="true"
    >
      <Icon
        className={moving ? `pm pm-${motion.effect}` : undefined}
        style={moving ? ({ "--d": `${motion.seconds}s` } as CSSProperties) : undefined}
      />
    </span>
  );
}
