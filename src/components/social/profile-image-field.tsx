"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ImageCropper } from "@/components/ui/image-cropper";
import type { CropKind } from "@/lib/images/crop-math";
import { loadImage } from "@/lib/images/render-crop";
import type { PendingImage } from "@/lib/social/profile-images";

export type { PendingImage } from "@/lib/social/profile-images";

/** Limite do arquivo original, antes do recorte (a saída recortada é bem menor). */
export const SOURCE_MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

/** O que a prévia deve mostrar: a imagem nova, nenhuma (removida) ou a atual. */
export function previewSrc(currentUrl: string | null, pending: PendingImage): string | null {
  if (pending.kind === "new") return pending.previewUrl;
  if (pending.kind === "remove") return null;
  return currentUrl;
}

type Props = { kind: CropKind; currentUrl: string | null; value: PendingImage; onChange(v: PendingImage): void };

/** Botões "Trocar" e "Remover" de foto ou banner. A imagem só sobe ao salvar o formulário. */
export function ProfileImageField({ kind, currentUrl, value, onChange }: Props) {
  const t = useTranslations("ImageCrop");
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<"invalid" | "tooBig" | null>(null);
  const lastPreview = useRef<string | null>(null);

  // Revoga a prévia anterior quando ela deixa de ser usada (e ao desmontar).
  const preview = value.kind === "new" ? value.previewUrl : null;
  useEffect(() => {
    if (lastPreview.current && lastPreview.current !== preview) URL.revokeObjectURL(lastPreview.current);
    lastPreview.current = preview;
  }, [preview]);
  useEffect(() => () => {
    if (lastPreview.current) URL.revokeObjectURL(lastPreview.current);
  }, []);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setError(null);
    if (file.size > SOURCE_MAX_BYTES) return setError("tooBig");
    try {
      setSource(await loadImage(file));
    } catch {
      setError("invalid");
    }
  }

  function onCropped(blob: Blob) {
    setSource(null);
    onChange({ kind: "new", blob, previewUrl: URL.createObjectURL(blob) });
  }

  const has = previewSrc(currentUrl, value) !== null;
  const changeLabel = kind === "avatar" ? t("changeAvatar") : t("changeBanner");
  const removeLabel = kind === "avatar" ? t("removeAvatar") : t("removeBanner");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className={`${buttonClasses({ variant: "secondary", size: "sm" })} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus`}>
          <ImagePlus className="size-4" aria-hidden="true" />
          <span>{changeLabel}</span>
          <input type="file" accept={ACCEPT} onChange={onFile} className="sr-only" aria-label={changeLabel} />
        </label>
        {has && (
          <button type="button" onClick={() => onChange({ kind: "remove" })} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            <Trash2 className="size-4" aria-hidden="true" />
            {removeLabel}
          </button>
        )}
      </div>
      {value.kind === "new" && <p className="text-xs text-text-muted">{t("pending")}</p>}
      {error && (
        <p role="alert" className="text-xs text-status-danger">
          {t(error)}
        </p>
      )}
      {source && <ImageCropper image={source} kind={kind} onCancel={() => setSource(null)} onConfirm={onCropped} />}
    </div>
  );
}
