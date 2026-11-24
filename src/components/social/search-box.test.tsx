import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { SearchBox } = await import("./search-box");

function show() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <SearchBox />
    </NextIntlClientProvider>,
  );
}

describe("SearchBox", () => {
  it("Ctrl K foca o campo", () => {
    show();
    const input = screen.getByRole("searchbox", { name: "Buscar" });
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(input).toHaveFocus();
  });

  it("Enter abre a busca com o texto aparado", () => {
    show();
    const input = screen.getByRole("searchbox", { name: "Buscar" });
    fireEvent.change(input, { target: { value: "  kanban react " } });
    fireEvent.submit(input.closest("form")!);
    expect(push).toHaveBeenCalledWith("/busca?q=kanban%20react");
  });
});
