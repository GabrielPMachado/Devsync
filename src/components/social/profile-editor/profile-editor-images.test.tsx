import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/pt-BR.json";
import type { ProfileInput } from "@/lib/social/profile-rules";

const saveProfile = vi.fn(async () => ({}));
vi.mock("@/app/(app)/configuracoes/actions", () => ({ saveProfile }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ fake: true }) }));
const preparePendingImages = vi.fn();
vi.mock("@/lib/social/profile-images", () => ({ preparePendingImages }));
// O campo real tem testes próprios; aqui um botão já entrega uma imagem recortada.
vi.mock("@/components/social/profile-image-field", async (orig) => ({
  ...(await orig<typeof import("@/components/social/profile-image-field")>()),
  ProfileImageField: ({ kind, onChange }: { kind: string; onChange(v: unknown): void }) => (
    <div>
      <button type="button" onClick={() => onChange({ kind: "new", blob: new Blob(["b"]), previewUrl: `blob:${kind}` })}>
        nova-{kind}
      </button>
      <button type="button" onClick={() => onChange({ kind: "remove" })}>
        remover-{kind}
      </button>
    </div>
  ),
}));
const { ProfileEditor } = await import("./profile-editor");

const initial: ProfileInput = {
  displayName: "Ana Souza", bio: "", headline: "", location: "", status: "", github: "", linkedin: "", x: "", youtube: "", site: "",
  bannerPreset: "", avatarFrame: "", accent: "", tags: [],
};

function renderEditor(extra: Partial<Parameters<typeof ProfileEditor>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ProfileEditor initial={initial} username="ana" userId="u1" tags={[]} avatarUrl="https://x/old-avatar.webp" bannerUrl={null} {...extra} />
    </NextIntlClientProvider>,
  );
}
const submit = (container: HTMLElement) => act(async () => void fireEvent.submit(container.querySelector("form")!));
const sent = () => (saveProfile.mock.calls.at(-1) as unknown as [unknown, FormData])[1];

beforeEach(() => {
  saveProfile.mockClear();
  preparePendingImages.mockReset();
});

describe("<ProfileEditor /> imagens", () => {
  it("a prévia mostra a imagem pendente e a removida some", () => {
    renderEditor();
    const preview = screen.getByRole("region", { name: "Prévia do perfil" });
    expect(within(preview).getByRole("img", { name: "Ana Souza" })).toHaveAttribute("src", "https://x/old-avatar.webp");
    fireEvent.click(screen.getByText("nova-avatar"));
    expect(within(preview).getByRole("img", { name: "Ana Souza" })).toHaveAttribute("src", "blob:avatar");
    fireEvent.click(screen.getByText("remover-avatar"));
    expect(within(preview).queryByRole("img", { name: "Ana Souza" })).toBeNull();
  });

  it("imagem pendente conta como mudança não salva", () => {
    renderEditor();
    fireEvent.click(screen.getByText("nova-banner"));
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("salvar envia as imagens antes e passa as URLs para a ação", async () => {
    preparePendingImages.mockResolvedValue({ avatarUrl: "https://x/new.webp?v=1", bannerUrl: "" });
    const { container } = renderEditor();
    fireEvent.click(screen.getByText("nova-avatar"));
    fireEvent.click(screen.getByText("remover-banner"));
    await submit(container);
    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(preparePendingImages).toHaveBeenCalledWith({ fake: true }, "u1", {
      avatar: expect.objectContaining({ kind: "new" }),
      banner: { kind: "remove" },
    });
    expect(sent().get("avatarUrl")).toBe("https://x/new.webp?v=1");
    expect(sent().get("bannerUrl")).toBe("");
  });

  it("sem imagem mexida, nada é enviado e os campos ficam ausentes", async () => {
    preparePendingImages.mockResolvedValue({});
    const { container } = renderEditor();
    await submit(container);
    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(sent().has("avatarUrl")).toBe(false);
    expect(sent().has("bannerUrl")).toBe(false);
  });

  it("falha no envio mostra erro e não chama a ação", async () => {
    preparePendingImages.mockRejectedValue(new Error("upload-failed"));
    const { container } = renderEditor();
    fireEvent.click(screen.getByText("nova-avatar"));
    await submit(container);
    expect(await screen.findByText("Não foi possível enviar a imagem. Tente de novo.")).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("campo inválido não envia imagem (a ação devolve o erro)", async () => {
    const { container } = renderEditor();
    fireEvent.click(screen.getByText("nova-avatar"));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "" } });
    await submit(container);
    await waitFor(() => expect(saveProfile).toHaveBeenCalled());
    expect(preparePendingImages).not.toHaveBeenCalled();
    expect(sent().has("avatarUrl")).toBe(false);
  });

  it("escolher um banner pronto tira o banner enviado", () => {
    renderEditor({ bannerUrl: "https://x/old-banner.webp" });
    fireEvent.click(screen.getByRole("radio", { name: "Circuito" }));
    const preview = screen.getByRole("region", { name: "Prévia do perfil" });
    expect(preview.innerHTML).not.toContain("old-banner");
  });
});
