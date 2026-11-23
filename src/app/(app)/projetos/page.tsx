import { useTranslations } from "next-intl";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  const nav = useTranslations("Nav");
  const t = useTranslations("ComingSoon");
  return <ComingSoon title={nav("projects")} text={t("projects")} />;
}
