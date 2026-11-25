import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../../messages/pt-BR.json";
import { AccentPicker, BannerPicker } from "./appearance-pickers";
import { CatalogProvider } from "./catalog-context";
import { FramePicker } from "./frame-picker";

const hidden = { banner: ["nebulosa"], accent: ["rosa"], frame: ["violeta"], badge: [] };

function wrap(ui: React.ReactNode, grantedFrames: string[] = []) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      <CatalogProvider hidden={hidden} grantedFrames={grantedFrames}>
        {ui}
      </CatalogProvider>
    </NextIntlClientProvider>,
  );
}

describe("itens desligados e liberados à mão no editor", () => {
  it("banner e cor desligados somem", () => {
    wrap(
      <>
        <BannerPicker value="" onChange={() => {}} />
        <AccentPicker value="" onChange={() => {}} />
      </>,
    );
    expect(screen.queryByRole("radio", { name: "Nebulosa" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Aurora" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Rosa" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeInTheDocument();
  });

  it("borda desligada some e borda liberada à mão fica escolhível", () => {
    wrap(<FramePicker name="Ana" avatarUrl={null} value="" onChange={() => {}} unlockedBadges={[]} />, ["dourada"]);
    expect(screen.queryByRole("radio", { name: /violeta/i })).toBeNull();
    expect(screen.getByRole("radio", { name: /dourada/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /neon/i })).toBeNull();
  });
});
