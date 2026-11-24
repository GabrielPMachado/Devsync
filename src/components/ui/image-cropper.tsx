"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { CROP_OUTPUT, ZOOM_MAX, coverScale, initialView, panBy, zoomTo, type CropKind, type CropView, type Size } from "@/lib/images/crop-math";
import { renderCrop } from "@/lib/images/render-crop";

type Props = { image: HTMLImageElement; kind: CropKind; onCancel(): void; onConfirm(blob: Blob): void };

const STEP = 10;
const STEP_FAST = 50;
const ZOOM_STEP = 1.1;

/** Recorte sem biblioteca: arrastar (mouse ou toque), zoom (slider, roda, teclado) e confirmação. */
export function ImageCropper({ image, kind, onCancel, onConfirm }: Props) {
  const t = useTranslations("ImageCrop");
  const hintId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const img: Size = { width: image.naturalWidth, height: image.naturalHeight };
  const out = CROP_OUTPUT[kind];
  const [view, setView] = useState<CropView>(() => initialView(img));
  // Tamanho do quadro na tela. Antes de medir (e no jsdom), usa a saída como referência.
  const [frame, setFrame] = useState<Size>(out);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Fechou (Esc/Cancelar) enquanto gerava: a imagem que chegar depois é descartada.
  const closed = useRef(false);
  const cancel = () => {
    closed.current = true;
    onCancel();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    // Navegador sem <dialog> modal (e o jsdom): abre como diálogo comum.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (typeof dialog.close === "function") dialog.close();
    };
  }, []);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrame({ width: r.width, height: r.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = (z: number) => setView((v) => zoomTo(v, z, img, frame));
  const zoomBy = (factor: number) => setView((v) => zoomTo(v, v.zoom * factor, img, frame));

  // Roda/trackpad: zoom proporcional ao giro. Listener nativo não passivo para a
  // página de trás não rolar junto.
  const zoomByRef = useRef(zoomBy);
  useLayoutEffect(() => {
    zoomByRef.current = zoomBy;
  });
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      zoomByRef.current(Math.exp(-e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const pan = (dx: number, dy: number) => setView((v) => panBy(v, dx, dy, img, frame));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? STEP_FAST : STEP;
    // Setas movem a "janela" sobre a imagem: seta para a esquerda mostra mais da esquerda.
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) pan(...moves[e.key]);
    else if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
    else if (e.key === "-" || e.key === "_") zoomBy(1 / ZOOM_STEP);
    else return;
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    pan(e.clientX - d.x, e.clientY - d.y);
    drag.current = { ...d, x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await renderCrop(image, view, kind);
      if (!closed.current) onConfirm(blob);
    } catch {
      if (!closed.current) setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // Posição da imagem dentro do quadro, a partir da vista.
  const scale = coverScale(img, frame) * view.zoom;
  const imgStyle = {
    width: img.width * scale,
    height: img.height * scale,
    left: frame.width / 2 - view.x * scale,
    top: frame.height / 2 - view.y * scale,
  };
  const title = kind === "avatar" ? t("titleAvatar") : t("titleBanner");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${hintId}-title`}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      className="m-auto w-[min(100vw-2rem,40rem)] rounded-xl border border-border-default bg-bg-surface p-0 text-text-primary backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <h2 id={`${hintId}-title`} className="font-display text-lg font-bold">
          {title}
        </h2>
        <div
          ref={frameRef}
          tabIndex={0}
          aria-label={t("area")}
          aria-describedby={hintId}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ aspectRatio: `${out.width} / ${out.height}` }}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-md bg-bg-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem local (blob:) do arquivo escolhido */}
          <img src={image.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={imgStyle} />
          {kind === "avatar" && (
            // Máscara redonda só para guiar: a foto sai quadrada e o site a mostra em círculo.
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]" />
          )}
        </div>
        <p id={hintId} className="text-xs text-text-muted">
          {t("hint")}
        </p>
        <div className="flex items-center gap-3">
          <button type="button" aria-label={t("zoomOut")} onClick={() => zoomBy(1 / ZOOM_STEP)} className="text-text-secondary hover:text-text-primary">
            <ZoomOut className="size-5" aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor={`${hintId}-zoom`}>
            {t("zoom")}
          </label>
          <input
            id={`${hintId}-zoom`}
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoom(Number(e.target.value))}
            className="flex-1 accent-brand-primary"
          />
          <button type="button" aria-label={t("zoomIn")} onClick={() => zoomBy(ZOOM_STEP)} className="text-text-secondary hover:text-text-primary">
            <ZoomIn className="size-5" aria-hidden="true" />
          </button>
        </div>
        {failed && (
          <p role="alert" className="text-sm text-status-danger">
            {t("failed")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>
            {t("cancel")}
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy ? t("working") : t("confirm")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
