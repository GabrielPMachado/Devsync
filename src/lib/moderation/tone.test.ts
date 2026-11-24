// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type Anthropic from "@anthropic-ai/sdk";
import { checkTone, toneEnabled } from "./tone";

const reply = (json: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(json) }] });

describe("toneEnabled", () => {
  it("só liga com a flag e a chave", () => {
    expect(toneEnabled({})).toBe(false);
    expect(toneEnabled({ MODERATION_AI_ENABLED: "true" })).toBe(false);
    expect(toneEnabled({ MODERATION_AI_ENABLED: "false", ANTHROPIC_API_KEY: "k" })).toBe(false);
    expect(toneEnabled({ MODERATION_AI_ENABLED: "true", ANTHROPIC_API_KEY: "k" })).toBe(true);
  });
});

describe("checkTone", () => {
  it("desligado: não chama a IA e deixa publicar", async () => {
    const create = vi.fn();
    await expect(checkTone("seu burro", { enabled: false, create })).resolves.toEqual({ flagged: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("texto ríspido volta marcado", async () => {
    const create = vi.fn<(p: Anthropic.MessageCreateParamsNonStreaming) => Promise<ReturnType<typeof reply>>>(async () => reply({ harsh: true }));
    await expect(checkTone("Pergunta idiota, vai estudar", { enabled: true, create })).resolves.toEqual({ flagged: true });
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.output_config?.format?.type).toBe("json_schema");
    expect(JSON.stringify(params.messages)).toContain("Pergunta idiota");
  });

  it("texto gentil passa", async () => {
    const create = vi.fn(async () => reply({ harsh: false }));
    await expect(checkTone("Tente usar flexbox", { enabled: true, create })).resolves.toEqual({ flagged: false });
  });

  it("falha, recusa ou resposta estranha deixam publicar", async () => {
    await expect(checkTone("x", { enabled: true, create: async () => Promise.reject(new Error("rede")) })).resolves.toEqual({ flagged: false });
    await expect(checkTone("x", { enabled: true, create: async () => ({ stop_reason: "refusal", content: [] }) })).resolves.toEqual({ flagged: false });
    await expect(checkTone("x", { enabled: true, create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "oi" }] }) })).resolves.toEqual({ flagged: false });
  });

  it("texto vazio nem chama a IA", async () => {
    const create = vi.fn();
    await expect(checkTone("   ", { enabled: true, create })).resolves.toEqual({ flagged: false });
    expect(create).not.toHaveBeenCalled();
  });
});
