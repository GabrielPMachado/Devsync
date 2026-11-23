import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { DemoOverlay, type DemoView } from "./demo-overlay";

vi.stubEnv("NEXT_PUBLIC_DEMOS_URL", "http://demos.localhost:8787");

const project = { title: "Kanban colaborativo", slug: "kanban-abc123", author: { username: "gabriel", displayName: "Gabriel", avatarUrl: null } };
const view = (over: Partial<DemoView> = {}): DemoView => ({ id: "d1", kind: "web_upload", status: "live", url: null, project, ...over });

function open(load: (id: string) => Promise<DemoView | null>, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <DemoOverlay demoId="d1" onClose={onClose} load={load} />
    </NextIntlClientProvider>,
  );
  return onClose;
}

describe("DemoOverlay", () => {
  it("demo ao vivo: iframe isolado no subdomínio da demo", async () => {
    open(async () => view());
    const frame = await screen.findByTitle("Demo: Kanban colaborativo");
    expect(frame).toHaveAttribute("src", "http://d1.demos.localhost:8787/");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-modals");
    expect(screen.getByRole("dialog", { name: "Kanban colaborativo" })).toBeInTheDocument();
    expect(screen.getByText("por @gabriel")).toBeInTheDocument();
    expect(document.querySelector('[target="_blank"]')).toBeNull();
  });

  it("link: o iframe abre a URL do autor", async () => {
    open(async () => view({ kind: "web_link", url: "https://meu-kanban.dev/" }));
    expect(await screen.findByTitle("Demo: Kanban colaborativo")).toHaveAttribute("src", "https://meu-kanban.dev/");
  });

  it("Esc, X e clique no fundo fecham", async () => {
    const onClose = open(async () => view());
    await screen.findByTitle("Demo: Kanban colaborativo");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar demo" }));
    fireEvent.click(screen.getByTestId("demo-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("larguras simulam computador, tablet e celular", async () => {
    open(async () => view());
    const frame = await screen.findByTitle("Demo: Kanban colaborativo");
    fireEvent.click(screen.getByRole("button", { name: "Celular" }));
    expect(frame.parentElement).toHaveStyle({ maxWidth: "390px" });
    expect(screen.getByRole("button", { name: "Celular" })).toHaveAttribute("aria-pressed", "true");
  });

  it("indisponível, suspensa e inexistente nunca mostram iframe", async () => {
    for (const [v, title] of [
      [view({ status: "unavailable" }), "Demo indisponível no momento"],
      [view({ status: "blocked" }), "Esta demo foi suspensa"],
      [null, "Demo indisponível no momento"],
    ] as const) {
      const { unmount } = render(
        <NextIntlClientProvider locale="pt-BR" messages={messages}>
          <DemoOverlay demoId="d1" onClose={() => {}} load={async () => v} />
        </NextIntlClientProvider>,
      );
      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.queryByTitle(/^Demo:/)).toBeNull();
      unmount();
    }
  });

  it("preparando: consulta de novo até ficar ao vivo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const load = vi.fn().mockResolvedValueOnce(view({ status: "pending" })).mockResolvedValue(view());
    open(load);
    expect(await screen.findByRole("heading", { name: "Preparando a demo…" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });
    await waitFor(() => expect(screen.getByTitle("Demo: Kanban colaborativo")).toBeInTheDocument());
    vi.useRealTimers();
  });
});
