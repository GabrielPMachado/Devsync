"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Props que o gatilho precisa espalhar no elemento focável dele. */
export type HintTriggerProps = {
  "aria-describedby": string;
  onPointerEnter: (ev: React.PointerEvent) => void;
  onPointerLeave: (ev: React.PointerEvent) => void;
  onPointerDown: (ev: React.PointerEvent) => void;
  onClick: (ev: React.MouseEvent) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (ev: React.KeyboardEvent) => void;
};

type Props = {
  /** O que aparece no cartão flutuante. Também vira a descrição do gatilho para leitores de tela. */
  content: ReactNode;
  children: (props: HintTriggerProps) => ReactNode;
  className?: string;
};

// O foco só abre a dica quando veio do teclado (no toque, o toque já abre).
let keyboardInput = false;
if (typeof document !== "undefined") {
  document.addEventListener("keydown", () => (keyboardInput = true), true);
  document.addEventListener("pointerdown", () => (keyboardInput = false), true);
}

const WIDTH = 240;
const MARGIN = 8;

/**
 * Dica flutuante: abre por cima ao passar o mouse, com o foco do teclado ou com um toque
 * (no celular, toca de novo ou fora para fechar). Esc fecha.
 */
export function Hint({ content, children, className = "" }: Props) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [place, setPlace] = useState<{ align: "start" | "center" | "end"; below: boolean }>({ align: "center", below: false });
  const [pointer, setPointer] = useState("mouse");
  const root = useRef<HTMLSpanElement>(null);
  const open = hover || focus || pinned;

  // Perto da borda da tela, o cartão se alinha pelo lado em vez de sair dela.
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const r = root.current.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const align = mid - WIDTH / 2 < MARGIN ? "start" : mid + WIDTH / 2 > document.documentElement.clientWidth - MARGIN ? "end" : "center";
    setPlace({ align, below: r.top < 160 });
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const close = (ev: PointerEvent) => {
      if (!root.current?.contains(ev.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);

  const trigger: HintTriggerProps = {
    "aria-describedby": id,
    onPointerEnter: (ev) => {
      if (ev.pointerType === "mouse") setHover(true);
    },
    onPointerLeave: (ev) => {
      if (ev.pointerType === "mouse") setHover(false);
    },
    onPointerDown: (ev) => {
      setPointer(ev.pointerType || "mouse");
    },
    onClick: () => {
      if (pointer !== "mouse") setPinned((p) => !p);
    },
    onFocus: () => {
      if (keyboardInput) setFocus(true);
    },
    onBlur: () => setFocus(false),
    onKeyDown: (ev) => {
      // Teclado depois de um toque: o clique do Espaço/setas no rádio não deve fixar a dica.
      setPointer("mouse");
      if (ev.key === "Escape") {
        setHover(false);
        setFocus(false);
        setPinned(false);
      }
    },
  };

  const x = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" }[place.align];
  const y = place.below ? "top-full mt-2" : "bottom-full mb-2";

  return (
    <span ref={root} className={`relative ${className}`}>
      {children(trigger)}
      <span
        id={id}
        role="tooltip"
        data-open={open}
        style={{ width: WIDTH }}
        // Fechada, sai do layout (display: none): escondida mas posicionada, empurraria a página para
        // os lados no celular. Continua descrevendo o gatilho para leitores de tela.
        className={`pointer-events-none absolute z-30 ${x} ${y} rounded-lg border border-border-strong bg-bg-elevated p-3 text-left text-xs leading-relaxed text-text-secondary shadow-xl shadow-black/40 transition-[opacity,translate] duration-150 starting:opacity-0 ${
          place.below ? "starting:-translate-y-1" : "starting:translate-y-1"
        } ${open ? "block" : "hidden"}`}
      >
        {content}
      </span>
    </span>
  );
}

/**
 * Para gatilhos que são um rótulo com um campo escondido dentro (rádios): o mouse e o toque
 * vão no rótulo; a descrição, o foco e o Esc vão no campo. Tocar no rótulo gera dois cliques
 * (o do rótulo e o repassado ao campo); só o do campo conta, para a dica não abrir e fechar de uma vez.
 */
export function splitHint(hint: HintTriggerProps) {
  const { "aria-describedby": describedBy, onFocus, onBlur, onKeyDown, onClick, ...pointer } = hint;
  return {
    label: {
      ...pointer,
      onClick: (ev: React.MouseEvent) => {
        if (ev.target instanceof HTMLInputElement) onClick(ev);
      },
    },
    input: { "aria-describedby": describedBy, onFocus, onBlur, onKeyDown },
  };
}
