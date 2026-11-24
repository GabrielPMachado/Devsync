import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { PublishForm, type PublishServices } from "./publish-form";

const tags = [
  { slug: "react", name: "React" },
  { slug: "nextjs", name: "Next.js" },
];

let services: PublishServices;

beforeEach(() => {
  services = {
    base: new URL("http://demos.localhost:8787"),
    token: vi.fn(async () => "tok"),
    createUpload: vi.fn(async () => ({ demoId: "d1", uploadUrl: "http://demos.localhost:8787/uploads/d1/1?sig=x" })),
    putZip: vi.fn(async () => {}),
    completeUpload: vi.fn(async () => {}),
    embedCheck: vi.fn(async () => ({ embeddable: true })),
    verifyDemo: vi.fn(async () => ({ embeddable: true })),
    readDemo: vi.fn(async () => ({ status: "live" as const, rejection_reason: null })),
    createLinkDemo: vi.fn(async () => "d2"),
    publish: vi.fn(async () => ({ error: "unknown" as const })),
    sleep: async () => {},
  };
});

function renderForm() {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <PublishForm tags={tags} services={services} />
    </NextIntlClientProvider>,
  );
}

function fillAbout() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Kanban colaborativo" } });
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Um quadro." } });
  fireEvent.click(screen.getByLabelText("react"));
}

function chooseZip(file: File) {
  fireEvent.change(screen.getByLabelText("Arquivo .zip da demo"), { target: { files: [file] } });
}

const zip = (size = 10) => new File([new Uint8Array(size)], "site.zip", { type: "application/zip" });

describe("PublishForm", () => {
  it("zip acima de 25 MB nem é enviado", async () => {
    renderForm();
    fillAbout();
    const big = zip(1);
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 + 1 });
    chooseZip(big);
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("O .zip passa de 25 MB.")).toBeInTheDocument();
    expect(services.createUpload).not.toHaveBeenCalled();
  });

  it("zip recusado mostra o motivo e não cria o projeto", async () => {
    services.readDemo = vi.fn(async () => ({ status: "unavailable" as const, rejection_reason: "no_index" }));
    renderForm();
    fillAbout();
    chooseZip(zip());
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Não achamos o index.html na raiz do .zip (nem numa única pasta).")).toBeInTheDocument();
    expect(services.publish).not.toHaveBeenCalled();
  });

  it("zip ok: envia, espera validar e publica com a demo", async () => {
    renderForm();
    fillAbout();
    const file = zip();
    chooseZip(file);
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalled());
    expect(services.putZip).toHaveBeenCalledWith("http://demos.localhost:8787/uploads/d1/1?sig=x", file);
    expect(services.completeUpload).toHaveBeenCalledWith(expect.objectContaining({ token: "tok" }), "d1");
    expect(services.publish).toHaveBeenCalledWith({ title: "Kanban colaborativo", description: "Um quadro.", tags: ["react"], repoUrl: "", siteUrl: "", demoId: "d1" });
  });

  it("sem tag não envia nada", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Kanban colaborativo" } });
    chooseZip(zip());
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Escolha pelo menos 1 tag.")).toBeInTheDocument();
    expect(services.createUpload).not.toHaveBeenCalled();
  });

  it("link que bloqueia embed mostra as duas saídas", async () => {
    services.embedCheck = vi.fn(async () => ({ embeddable: false, reason: "x_frame_options" }));
    renderForm();
    fillAbout();
    fireEvent.click(screen.getByLabelText(/Link do site/));
    fireEvent.change(screen.getByLabelText("Link da demo"), { target: { value: "https://meu-kanban.netlify.app" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Esse link não pode ser usado como demo")).toBeInTheDocument();
    expect(screen.getByText("Liberar no seu site")).toBeInTheDocument();
    expect(services.createLinkDemo).not.toHaveBeenCalled();
  });

  it("link de domínio bloqueado pela moderação mostra o motivo", async () => {
    services.createLinkDemo = vi.fn(async () => {
      throw new Error("blocked_domain");
    });
    renderForm();
    fillAbout();
    fireEvent.click(screen.getByLabelText(/Link do site/));
    fireEvent.change(screen.getByLabelText("Link da demo"), { target: { value: "https://golpe.dev" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Esse domínio foi bloqueado pela moderação da Devsync.")).toBeInTheDocument();
    expect(services.publish).not.toHaveBeenCalled();
  });

  it("link fora da forma canônica recusado pelo banco mostra o motivo", async () => {
    services.createLinkDemo = vi.fn(async () => {
      throw new Error("invalid_url");
    });
    renderForm();
    fillAbout();
    fireEvent.click(screen.getByLabelText(/Link do site/));
    fireEvent.change(screen.getByLabelText("Link da demo"), { target: { value: "https://golpe.dev./" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Esse endereço não é válido.")).toBeInTheDocument();
  });

  it("link aceito: cria a demo, confirma no serviço e publica", async () => {
    renderForm();
    fillAbout();
    fireEvent.click(screen.getByLabelText(/Link do site/));
    fireEvent.change(screen.getByLabelText("Link da demo"), { target: { value: "https://meu-kanban.dev" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalledWith(expect.objectContaining({ demoId: "d2" })));
    expect(services.createLinkDemo).toHaveBeenCalledWith("https://meu-kanban.dev");
    expect(services.verifyDemo).toHaveBeenCalledWith(expect.objectContaining({ token: "tok" }), "d2");
  });

  it("publicou: o redirecionamento do Next não vira erro na tela", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/projetos/kanban-abc;307;" });
    services.publish = vi.fn(async () => {
      throw redirect;
    });
    renderForm();
    fillAbout();
    chooseZip(zip());
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Publicando…" })).toBeDisabled();
  });

  it("validação demorada: avisa e, ao tentar de novo, reaproveita a demo enviada", async () => {
    services.readDemo = vi.fn(async () => ({ status: "pending" as const, rejection_reason: null }));
    services.timeoutMs = 0;
    renderForm();
    fillAbout();
    chooseZip(zip());
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText(/A validação está demorando/)).toBeInTheDocument();

    services.readDemo = vi.fn(async () => ({ status: "live" as const, rejection_reason: null }));
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalledWith(expect.objectContaining({ demoId: "d1" })));
    expect(services.createUpload).toHaveBeenCalledTimes(1);
  });

  it("erro de rede mostra texto em português, não a mensagem técnica", async () => {
    services.createUpload = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    renderForm();
    fillAbout();
    chooseZip(zip());
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    expect(await screen.findByText("Não deu para publicar agora. Tente de novo.")).toBeInTheDocument();
  });
});
