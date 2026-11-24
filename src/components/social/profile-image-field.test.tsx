import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { PendingImage } from "@/lib/social/profile-images";

const cropped = new Blob(["c"], { type: "image/webp" });
const loadImage = vi.fn(async () => document.createElement("img"));
vi.mock("@/lib/images/render-crop", () => ({ loadImage, renderCrop: vi.fn() }));
// O recorte tem testes próprios; aqui ele confirma ou cancela na hora.
vi.mock("@/components/ui/image-cropper", () => ({
  ImageCropper: ({ onConfirm, onCancel }: { onConfirm(b: Blob): void; onCancel(): void }) => (
    <div>
      <button onClick={() => onConfirm(cropped)}>confirmar-recorte</button>
      <button onClick={onCancel}>cancelar-recorte</button>
    </div>
  ),
}));
const { ProfileImageField, previewSrc } = await import("./profile-image-field");

let changes: PendingImage[] = [];
function Harness({ currentUrl = null as string | null, kind = "avatar" as "avatar" | "banner" }) {
  const [value, setValue] = useState<PendingImage>({ kind: "keep" });
  return (
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ProfileImageField
        kind={kind}
        currentUrl={currentUrl}
        value={value}
        onChange={(v) => {
          changes.push(v);
          setValue(v);
        }}
      />
    </NextIntlClientProvider>
  );
}

const pick = (file: File) => fireEvent.change(screen.getByLabelText("Trocar foto"), { target: { files: [file] } });
const png = () => new File(["p"], "foto.png", { type: "image/png" });

beforeEach(() => {
  changes = [];
  loadImage.mockClear();
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});

describe("ProfileImageField", () => {
  it("escolher e recortar deixa a imagem pendente", async () => {
    render(<Harness />);
    pick(png());
    fireEvent.click(await screen.findByText("confirmar-recorte"));
    expect(changes.at(-1)).toMatchObject({ kind: "new", blob: cropped });
    expect(screen.getByText("Aparece no perfil depois de salvar.")).toBeInTheDocument();
  });

  it("cancelar o recorte não muda nada", async () => {
    render(<Harness currentUrl="https://x/a.webp" />);
    pick(png());
    fireEvent.click(await screen.findByText("cancelar-recorte"));
    expect(changes).toEqual([]);
  });

  it("arquivo que não abre mostra erro", async () => {
    loadImage.mockRejectedValueOnce(new Error("invalid-image"));
    render(<Harness />);
    pick(new File(["t"], "x.png", { type: "image/png" }));
    expect(await screen.findByText(/Não foi possível abrir essa imagem/)).toBeInTheDocument();
    expect(changes).toEqual([]);
  });

  it("arquivo enorme é recusado antes de abrir", async () => {
    render(<Harness />);
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 16 * 1024 * 1024 });
    pick(big);
    expect(await screen.findByText(/Imagem grande demais/)).toBeInTheDocument();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("remover só aparece com imagem e marca remove", () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole("button", { name: "Remover foto" })).toBeNull();
    unmount();
    render(<Harness currentUrl="https://x/a.webp" />);
    fireEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    expect(changes.at(-1)).toEqual({ kind: "remove" });
  });

  it("trocar de novo revoga a prévia anterior", async () => {
    render(<Harness />);
    pick(png());
    fireEvent.click(await screen.findByText("confirmar-recorte"));
    const first = (changes.at(-1) as { previewUrl: string }).previewUrl;
    pick(png());
    fireEvent.click(await screen.findByText("confirmar-recorte"));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(first));
  });

  it("banner usa os textos do banner", () => {
    render(<Harness kind="banner" currentUrl="https://x/b.webp" />);
    expect(screen.getByLabelText("Trocar banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover banner" })).toBeInTheDocument();
  });
});

describe("previewSrc", () => {
  it("mostra o que vai ficar depois de salvar", () => {
    expect(previewSrc("https://x/a", { kind: "keep" })).toBe("https://x/a");
    expect(previewSrc("https://x/a", { kind: "remove" })).toBeNull();
    expect(previewSrc(null, { kind: "new", blob: cropped, previewUrl: "blob:1" })).toBe("blob:1");
  });
});
