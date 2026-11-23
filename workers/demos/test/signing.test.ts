import { describe, expect, it } from "vitest";
import { signUpload, verifyUpload } from "../src/signing";

const ID = "6f1c2c1e-1111-4222-8333-444455556666";

describe("URL de envio assinada", () => {
  it("assina e verifica", async () => {
    const sig = await signUpload("s", ID, 1, 2000);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyUpload("s", ID, 1, 2000, sig, 1000)).toBe(true);
  });
  it("outra versão não vale", async () => {
    const sig = await signUpload("s", ID, 1, 2000);
    expect(await verifyUpload("s", ID, 2, 2000, sig, 1000)).toBe(false);
  });
  it("expirada não vale", async () => {
    const sig = await signUpload("s", ID, 1, 2000);
    expect(await verifyUpload("s", ID, 1, 2000, sig, 2001)).toBe(false);
  });
  it("outro segredo não vale", async () => {
    const sig = await signUpload("outro", ID, 1, 2000);
    expect(await verifyUpload("s", ID, 1, 2000, sig, 1000)).toBe(false);
  });
  it("assinatura malformada não vale", async () => {
    expect(await verifyUpload("s", ID, 1, 2000, "zz", 1000)).toBe(false);
  });
});
