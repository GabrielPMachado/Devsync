import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";

const reportContent = vi.fn<(...a: unknown[]) => Promise<{ ok: true } | { error: string }>>(async () => ({ ok: true }));
vi.mock("@/lib/moderation/actions", () => ({ reportContent: (...args: unknown[]) => reportContent(...args) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/estudos/x" }));

const { ReportButton } = await import("./report-button");

function show(signedIn = true) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      <ReportButton target="answer" targetId="a1" signedIn={signedIn} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => reportContent.mockClear());

describe("ReportButton", () => {
  it("visitante vai para o login", () => {
    show(false);
    expect(screen.getByRole("link", { name: "Denunciar resposta" })).toHaveAttribute("href", "/entrar?next=%2Festudos%2Fx");
  });

  it("abre o diálogo, envia o motivo e agradece", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Denunciar resposta" }));
    const dialog = screen.getByRole("dialog", { name: "Denunciar resposta" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Grosseria ou ofensa"));
    fireEvent.change(screen.getByLabelText("Detalhes (opcional)"), { target: { value: "debochou" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await waitFor(() => expect(reportContent).toHaveBeenCalledWith("answer", "a1", "rude", "debochou"));
    expect(await screen.findByText("Obrigado. A moderação vai analisar.")).toBeInTheDocument();
  });

  it("sem motivo o envio fica desligado; 'outro' pede detalhes", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Denunciar resposta" }));
    expect(screen.getByRole("button", { name: "Enviar denúncia" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Outro motivo"));
    expect(screen.getByLabelText("Detalhes")).toBeRequired();
  });

  it("mostra o erro do servidor", async () => {
    reportContent.mockResolvedValueOnce({ error: "already" });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Denunciar resposta" }));
    fireEvent.click(screen.getByLabelText("Spam ou propaganda"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você já denunciou isto.");
  });

  it("Esc fecha", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Denunciar resposta" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
