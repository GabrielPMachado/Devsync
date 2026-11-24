import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusPage } from "@/components/status/status-page";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("Status");
  return (
    <StatusPage title={t("notFoundTitle")} text={t("notFoundText")}>
      <Link href="/" className={buttonClasses()}>
        {t("home")}
      </Link>
    </StatusPage>
  );
}
