import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/pt-BR.json";
import type { ProfileInput } from "@/lib/social/profile-rules";

vi.mock("@/app/(app)/configuracoes/actions", () => ({ saveProfile: vi.fn(async () => ({})) }));
const { ProfileEditor } = await import("./profile-editor");

const initial: ProfileInput = {
  displayName: "Ana Souza",
  bio: "Front-end.",
  headline: "",
  location: "",
  status: "",
  github: "anasouza",
  linkedin: "",
  x: "",
  youtube: "",
  site: "",
  bannerPreset: "",
  avatarFrame: "",
  accent: "",
  tags: ["react"],
};
const tags = [
  { slug: "react", name: "React" },
  { slug: "css", name: "CSS" },
];

function renderEditor(extra: Partial<Parameters<typeof ProfileEditor>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <ProfileEditor initial={initial} username="ana" userId="u1" tags={tags} avatarUrl={null} bannerUrl={null} {...extra} />
    </NextIntlClientProvider>,
  );
}

describe("<ProfileEditor />", () => {
  it("organiza a tela em seções", () => {
    renderEditor();
    for (const name of ["Aparência", "Sobre você", "Links", "Tecnologias"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("a prévia acompanha o que a pessoa digita e escolhe", () => {
    renderEditor();
    const preview = screen.getByRole("region", { name: "Prévia do perfil" });
    expect(within(preview).getByText("Ana Souza")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "Dev front-end na Acme" } });
    expect(within(preview).getByText("Dev front-end na Acme")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "open_to_work" } });
    expect(within(preview).getByText("Aberto a oportunidades")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Localização"), { target: { value: "São Paulo" } });
    expect(within(preview).getByText("São Paulo")).toBeInTheDocument();
  });

  it("envia todos os campos novos com os nomes da ação", () => {
    const { container } = renderEditor();
    const form = container.querySelector("form")!;
    fireEvent.click(screen.getByRole("radio", { name: "Circuito" }));
    fireEvent.click(screen.getByRole("radio", { name: "Ciano" }));
    fireEvent.click(screen.getByRole("radio", { name: "Borda gradiente" }));
    const data = new FormData(form);
    expect(data.get("bannerPreset")).toBe("circuito");
    expect(data.get("accent")).toBe("ciano");
    expect(data.get("avatarFrame")).toBe("gradiente");
    for (const name of ["displayName", "bio", "headline", "location", "status", "github", "linkedin", "x", "youtube", "site"]) {
      expect(data.has(name), name).toBe(true);
    }
    expect(data.getAll("tags")).toEqual(["react"]);
  });

  it("bordas por conquista: bloqueadas sem a insígnia (e sem lista), liberadas com ela", () => {
    const { unmount } = renderEditor();
    expect(screen.queryByRole("radio", { name: /Borda néon/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Borda néon/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Borda gradiente" })).toBeEnabled();
    unmount();
    renderEditor({ unlockedBadges: ["builder"] });
    const neon = screen.getByRole("button", { name: /Borda néon/ });
    expect(neon).toHaveAccessibleDescription(/Ganhe a insígnia Mentor para liberar.*10 respostas aceitas/);
    // O requisito não fica exposto na tela: só na dica, que abre ao passar o mouse ou tocar.
    expect(screen.getByText("Ganhe a insígnia Mentor para liberar").closest('[role="tooltip"]')).toHaveAttribute("data-open", "false");
    fireEvent.click(neon);
    expect(new FormData(document.querySelector("form")!).get("avatarFrame")).not.toBe("neon");
    expect(screen.getByRole("radio", { name: "Borda colchetes" })).toBeEnabled();
  });

  it("avisa antes de sair com mudanças não salvas", () => {
    renderEditor();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "Dev" } });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("Cancelar com mudanças pede confirmação", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "Dev" } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = screen.getByRole("link", { name: "Cancelar" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(confirm).toHaveBeenCalledWith("Sair sem salvar? Suas mudanças vão se perder.");
    expect(click.defaultPrevented).toBe(true);
    confirm.mockRestore();
  });

  it("tem um espaço para a seção de insígnias", () => {
    renderEditor({ badgesSection: <p>Minhas insígnias</p> });
    expect(screen.getByText("Minhas insígnias")).toBeInTheDocument();
  });
});
