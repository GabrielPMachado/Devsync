import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";

const blob = new Blob(["x"], { type: "image/webp" });
const renderCrop = vi.fn(async () => blob);
vi.mock("@/lib/images/render-crop", () => ({ renderCrop }));
const { ImageCropper } = await import("./image-cropper");

function fakeImg(width: number, height: number) {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: width });
  Object.defineProperty(img, "naturalHeight", { value: height });
  img.src = "blob:foto";
  return img;
}

function show(props: Partial<Parameters<typeof ImageCropper>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ImageCropper image={fakeImg(2000, 1000)} kind="avatar" onCancel={onCancel} onConfirm={onConfirm} {...props} />
    </NextIntlClientProvider>,
  );
  return { onCancel, onConfirm };
}

beforeEach(() => renderCrop.mockClear());

describe("ImageCropper", () => {
  it("+ no teclado aproxima e a vista vai para o renderCrop", async () => {
    const { onConfirm } = show();
    fireEvent.keyDown(screen.getByLabelText("Área de recorte"), { key: "+" });
    fireEvent.click(screen.getByRole("button", { name: "Usar imagem" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(blob));
    expect(renderCrop).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ zoom: 1.1 }), "avatar");
  });

  it("ArrowLeft mostra mais da esquerda", async () => {
    show();
    const area = screen.getByLabelText("Área de recorte");
    fireEvent.keyDown(area, { key: "+" });
    fireEvent.keyDown(area, { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "Usar imagem" }));
    await waitFor(() => expect(renderCrop).toHaveBeenCalled());
    const view = (renderCrop.mock.calls[0] as unknown[])[1] as { x: number };
    expect(view.x).toBeLessThan(1000);
  });

  it("- não afasta além do mínimo", async () => {
    show();
    fireEvent.keyDown(screen.getByLabelText("Área de recorte"), { key: "-" });
    expect(screen.getByLabelText("Zoom")).toHaveValue("1");
  });

  it("slider de zoom tem rótulo e limites", () => {
    show();
    const slider = screen.getByLabelText("Zoom");
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "4");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(slider).toHaveValue("2");
  });

  it("arrastar com o ponteiro move a imagem", async () => {
    show();
    const area = screen.getByLabelText("Área de recorte");
    fireEvent.keyDown(area, { key: "+" });
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Usar imagem" }));
    await waitFor(() => expect(renderCrop).toHaveBeenCalled());
    expect(((renderCrop.mock.calls[0] as unknown[])[1] as { x: number }).x).toBeLessThan(1000);
  });

  it("Cancelar não gera imagem", () => {
    const { onCancel } = show();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
    expect(renderCrop).not.toHaveBeenCalled();
  });

  it("falha ao gerar mostra erro e não confirma", async () => {
    renderCrop.mockRejectedValueOnce(new Error("render-failed"));
    const { onConfirm } = show({ kind: "banner" });
    expect(screen.getByRole("heading", { name: "Recortar banner" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar imagem" }));
    expect(await screen.findByText("Não foi possível gerar a imagem. Tente outra.")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
