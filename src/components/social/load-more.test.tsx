import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pt-BR.json";

const moreFeed = vi.fn();
vi.mock("@/app/(app)/feed-actions", () => ({ moreFeed: (...a: unknown[]) => moreFeed(...a) }));
const { LoadMore } = await import("./load-more");

function show(cursor: string | null) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <LoadMore cursor={cursor} label="Seu início" />
    </NextIntlClientProvider>,
  );
}

describe("LoadMore", () => {
  it("acrescenta as páginas embaixo, com o cursor exato do banco, até o fim", async () => {
    moreFeed.mockResolvedValueOnce({ node: <p>página 2</p>, next: "2026-11-24T10:00:00.123456+00:00" });
    moreFeed.mockResolvedValueOnce({ node: <p>página 3</p>, next: null });
    show("2026-11-24T11:00:00.654321+00:00");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Carregar mais" })));
    expect(moreFeed).toHaveBeenLastCalledWith("2026-11-24T11:00:00.654321+00:00", "Seu início");
    expect(screen.getByText("página 2")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Carregar mais" })));
    expect(moreFeed).toHaveBeenLastCalledWith("2026-11-24T10:00:00.123456+00:00", "Seu início");
    expect(screen.getByText("página 2")).toBeInTheDocument();
    expect(screen.getByText("página 3")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Você chegou ao fim/)).toBeInTheDocument();
  });

  it("erro avisa e deixa tentar de novo", async () => {
    moreFeed.mockRejectedValueOnce(new Error("x"));
    show("2026-11-24T11:00:00Z");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Carregar mais" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Não deu para carregar agora.");
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeEnabled();
  });
});
