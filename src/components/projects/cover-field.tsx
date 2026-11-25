"use client";

import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProfileImageField, previewSrc, type PendingImage } from "@/components/social/profile-image-field";

/** Capa do projeto (16:9, opcional) com prévia. A imagem só sobe ao salvar o formulário. */
export function CoverField({ currentUrl, value, onChange }: { currentUrl: string | null; value: PendingImage; onChange(v: PendingImage): void }) {
  const t = useTranslations("ProjectCover");
  const src = previewSrc(currentUrl, value);
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-semibold text-text-secondary">{t("label")}</legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border-default bg-bg-base sm:w-56">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou imagem do Storage
            <img src={src} alt={t("alt")} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 p-3 text-center text-xs text-text-muted">
              <ImageIcon className="size-5 text-icon-muted" aria-hidden="true" />
              {t("empty")}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">{t("help")}</p>
          <ProfileImageField kind="cover" currentUrl={currentUrl} value={value} onChange={onChange} />
        </div>
      </div>
    </fieldset>
  );
}
