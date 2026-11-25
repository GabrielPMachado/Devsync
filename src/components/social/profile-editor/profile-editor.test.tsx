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
    const frames = screen.getByRole("group", { name: /Borda da foto/ });
    expect(within(frames).getByText("Ganhe a insígnia Mentor para liberar").closest('[role="tooltip"]')).toHaveAttribute("data-open", "false");
    fireEvent.click(neon);
    expect(new FormData(document.querySelector("form")!).get("avatarFrame")).not.toBe("neon");
    expect(screen.getByRole("radio", { name: "Borda colchetes" })).toBeEnabled();
  });

  it("bordas liberadas por conquista mostram na dica a insígnia e o requisito cumprido", () => {
    renderEditor({ unlockedBadges: ["mentor"] });
    const neon = screen.getByRole("radio", { name: "Borda néon" });
    expect(neon).toHaveAccessibleDescription(/Liberada.*Pela insígnia Mentor.*Requisito cumprido: ter 10 respostas aceitas/);
    const tip = document.getElementById(neon.getAttribute("aria-describedby")!)!;
    expect(tip.querySelector('[data-lock="open"]')).not.toBeNull();
    expect(tip).toHaveAttribute("data-open", "false");
    fireEvent.pointerEnter(neon.closest("label")!, { pointerType: "mouse" });
    expect(tip).toHaveAttribute("data-open", "true");
  });

  it("bordas livres, banners e cores dizem que estão disponíveis para todos", () => {
    renderEditor();
    for (const name of ["Borda gradiente", "Sem borda", "Circuito", "Ciano"]) {
      const radio = screen.getByRole("radio", { name });
      expect(radio, name).toHaveAccessibleDescription(/Disponível para todos/);
    }
  });

  it("no toque, a dica de uma opção abre uma vez por toque (mesmo com o clique repassado ao rádio)", () => {
    renderEditor();
    const radio = screen.getByRole("radio", { name: "Circuito" });
    const label = radio.closest("label")!;
    const tip = document.getElementById(radio.getAttribute("aria-describedby")!)!;
    fireEvent.pointerDown(label, { pointerType: "touch" });
    // Tocar no rótulo gera dois cliques: um no rótulo e outro repassado ao rádio.
    fireEvent.click(label);
    expect(tip).toHaveAttribute("data-open", "true");
  });

  it("mostra quantas opções há de cada coisa e quantas bordas estão liberadas", () => {
    renderEditor({ unlockedBadges: ["builder", "founder"] });
    // builder libera o banner "Chuva digital" e a cor "Floresta"; founder, a cor "Retrô".
    const banners = screen.getByRole("group", { name: /Banner/ });
    expect(banners).toHaveTextContent("15 de 28 liberados");
    expect(within(banners).getByText("1 de 14")).toBeInTheDocument();
    const accents = screen.getByRole("group", { name: /Cor de destaque/ });
    expect(accents).toHaveTextContent("14 de 24 liberadas");
    expect(within(accents).getByText("2 de 12")).toBeInTheDocument();
    const frames = screen.getByRole("group", { name: /Borda da foto/ });
    expect(frames).toHaveTextContent("11 de 36 liberadas");
    expect(within(frames).getByText("Livres")).toBeInTheDocument();
    expect(within(frames).getByText("Por conquista")).toBeInTheDocument();
    expect(within(frames).getByText("2 de 27")).toBeInTheDocument();
  });

  it("banner e cor por conquista: bloqueados não são escolhíveis; liberados viram opção", () => {
    renderEditor({ unlockedBadges: ["builder"] });
    expect(screen.getByRole("radio", { name: "Chuva digital" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Hiperespaço" })).toBeNull();
    const locked = screen.getByRole("button", { name: "Hiperespaço (bloqueado)" });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Floresta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retrô (bloqueado)" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Chuva digital" }));
    fireEvent.click(screen.getByRole("radio", { name: "Floresta" }));
    const data = new FormData(document.querySelector("form")!);
    expect(data.get("bannerPreset")).toBe("chuva_digital");
    expect(data.get("accent")).toBe("floresta");
  });

  it("banner e cor mostram na dica o requisito: livre, liberado ou bloqueado", () => {
    renderEditor({ unlockedBadges: ["builder"] });
    expect(screen.getByRole("radio", { name: "Aurora" })).toHaveAccessibleDescription(/Disponível para todos/);
    expect(screen.getByRole("radio", { name: "Chuva digital" })).toHaveAccessibleDescription(/Liberado.*Pela insígnia Construtor.*Requisito cumprido: publicar 5 projetos/);
    expect(screen.getByRole("radio", { name: "Floresta" })).toHaveAccessibleDescription(/Liberada.*Pela insígnia Construtor/);
    expect(screen.getByRole("button", { name: "Hiperespaço (bloqueado)" })).toHaveAccessibleDescription(/Bloqueado.*Ganhe a insígnia Ícone para liberar.*1\.000 seguidores/);
  });

  it("o cabeçalho de cada escolha diz o que está selecionado", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("radio", { name: "Nebulosa" }));
    fireEvent.click(screen.getByRole("radio", { name: "Turquesa" }));
    expect(screen.getByRole("group", { name: /Banner/ })).toHaveTextContent("Nebulosa");
    expect(screen.getByRole("group", { name: /Cor de destaque/ })).toHaveTextContent("Turquesa");
    const data = new FormData(document.querySelector("form")!);
    expect(data.get("bannerPreset")).toBe("nebulosa");
    expect(data.get("accent")).toBe("turquesa");
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
