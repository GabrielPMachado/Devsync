import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt-BR.json";
import { TagGroups } from "./tag-groups";

describe("TagGroups", () => {
  it("mostra os assuntos dentro de grupos com o nome da categoria", () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={messages}>
        <TagGroups
          tags={[
            { slug: "react", name: "React" },
            { slug: "htmx", name: "htmx" },
            { slug: "docker", name: "Docker" },
          ]}
          renderTag={(tag) => <span key={tag.slug}>{tag.slug}</span>}
        />
      </NextIntlClientProvider>,
    );
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["Front-end", "DevOps e nuvem", "Outros"]);
    expect(within(screen.getByRole("group", { name: "Front-end" })).getByText("react")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Outros" })).getByText("htmx")).toBeInTheDocument();
  });
});
