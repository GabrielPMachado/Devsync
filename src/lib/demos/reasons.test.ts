import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { REJECTION_REASONS, reasonKey } from "./reasons";

describe("reasonKey", () => {
  it("devolve o código conhecido", () => {
    expect(reasonKey("no_index")).toBe("no_index");
    expect(reasonKey("x_frame_options")).toBe("x_frame_options");
  });
  it("código desconhecido ou vazio vira unknown", () => {
    expect(reasonKey("xyz")).toBe("unknown");
    expect(reasonKey(null)).toBe("unknown");
  });
  it("todo motivo tem texto em pt-BR", () => {
    const texts = (messages as unknown as { DemoReasons: Record<string, string> }).DemoReasons;
    for (const r of [...REJECTION_REASONS, "unknown"]) expect(texts[r], r).toBeTruthy();
  });
});
