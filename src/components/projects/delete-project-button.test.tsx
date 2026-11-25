import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { DeleteProjectButton } from "./delete-project-button";

function renderButton(remove = vi.fn(async () => ({ error: "unknown" as const }))) {
  render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <DeleteProjectButton projectId="p1" title="Kanban" remove={remove} />
    </NextIntlClientProvider>,
  );
  return remove;
}

describe("DeleteProjectButton", () => {
  it("só exclui depois de confirmar", async () => {
    const remove = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir “Kanban”?" });
    expect(dialog).toHaveTextContent("Não dá para desfazer");
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir de vez" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para excluir agora");
  });

  it("cancelar e Esc fecham sem excluir", () => {
    const remove = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
