import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import type { PublishServices } from "./publish-form";

// O campo real (com recorte) tem testes próprios; aqui botões já entregam a capa recortada.
vi.mock("@/components/social/profile-image-field", async (orig) => ({
  ...(await orig<typeof import("@/components/social/profile-image-field")>()),
  ProfileImageField: ({ onChange }: { onChange(v: unknown): void }) => (
    <div>
      <button type="button" onClick={() => onChange({ kind: "new", blob: new Blob(["c"], { type: "image/webp" }), previewUrl: "blob:capa" })}>
        nova-capa
      </button>
      <button type="button" onClick={() => onChange({ kind: "remove" })}>
        remover-capa
      </button>
    </div>
  ),
}));
const { EditProjectForm } = await import("./edit-project-form");
const { PublishForm } = await import("./publish-form");

const tags = [{ slug: "react", name: "React" }];
const COVER = "https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-9.webp?v=9";
const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="pt-BR" messages={messages}>{ui}</NextIntlClientProvider>);

describe("capa ao editar o projeto", () => {
  const project = { id: "p1", slug: "kanban", title: "Kanban", description: "", tags: ["react"], repoUrl: null, siteUrl: null, coverUrl: "https://x/old.webp" };
  let save: ReturnType<typeof vi.fn>;
  let uploadCover: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    save = vi.fn(async () => ({ error: "unknown" as const }));
    uploadCover = vi.fn(async () => COVER);
  });
  const renderEdit = () => wrap(<EditProjectForm project={project} tags={tags} save={save as never} uploadCover={uploadCover as never} />);
  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

  it("mostra a capa atual e a nova antes de salvar", () => {
    renderEdit();
    expect(screen.getByRole("img", { name: "Capa do projeto" })).toHaveAttribute("src", "https://x/old.webp");
    fireEvent.click(screen.getByText("nova-capa"));
    expect(screen.getByRole("img", { name: "Capa do projeto" })).toHaveAttribute("src", "blob:capa");
  });

  it("sem mexer na capa, não envia nada", async () => {
    renderEdit();
    submit();
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(uploadCover).not.toHaveBeenCalled();
    expect(save.mock.calls[0][1]).not.toHaveProperty("coverUrl");
  });

  it("capa nova sobe ao salvar e vai para a ação", async () => {
    renderEdit();
    fireEvent.click(screen.getByText("nova-capa"));
    submit();
    await waitFor(() => expect(save).toHaveBeenCalledWith("p1", expect.objectContaining({ coverUrl: COVER })));
  });

  it("remover a capa manda vazio", async () => {
    renderEdit();
    fireEvent.click(screen.getByText("remover-capa"));
    expect(screen.queryByRole("img", { name: "Capa do projeto" })).toBeNull();
    submit();
    await waitFor(() => expect(save).toHaveBeenCalledWith("p1", expect.objectContaining({ coverUrl: "" })));
  });

  it("falha no envio da capa não salva e avisa", async () => {
    uploadCover.mockRejectedValue(new Error("upload-failed"));
    renderEdit();
    fireEvent.click(screen.getByText("nova-capa"));
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar a capa");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("capa ao publicar", () => {
  it("capa escolhida sobe antes de publicar e vai junto", async () => {
    const services: PublishServices = {
      base: new URL("http://demos.localhost:8787"),
      token: vi.fn(async () => "tok"),
      createUpload: vi.fn(),
      putZip: vi.fn(),
      completeUpload: vi.fn(),
      embedCheck: vi.fn(async () => ({ embeddable: true })),
      verifyDemo: vi.fn(async () => ({ embeddable: true })),
      readDemo: vi.fn(async () => ({ status: "live" as const, rejection_reason: null })),
      createLinkDemo: vi.fn(async () => "d2"),
      publish: vi.fn(async () => ({ error: "unknown" as const })),
      uploadCover: vi.fn(async () => COVER),
      sleep: async () => {},
    };
    wrap(<PublishForm tags={tags} services={services} />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Kanban colaborativo" } });
    fireEvent.click(screen.getByLabelText("react"));
    fireEvent.click(screen.getByText("nova-capa"));
    fireEvent.click(screen.getByLabelText(/Link do site/));
    fireEvent.change(screen.getByLabelText("Link da demo"), { target: { value: "https://kanban.dev" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar projeto" }));
    await waitFor(() => expect(services.publish).toHaveBeenCalledWith(expect.objectContaining({ demoId: "d2", coverUrl: COVER })));
  });
});
