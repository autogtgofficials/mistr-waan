"use client";

import { useAuth } from "@/lib/store/auth";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";

export function Greeting() {
  const { user, hydrated } = useAuth();
  const locale = useLocale();
  const name = hydrated && user ? user.firstName : null;
  const greeting = name
    ? t(locale, "home.greeting.user", { name })
    : t(locale, "home.greeting.guest");
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
      <p className="mt-1 text-base text-muted-foreground">
        {t(locale, "home.subgreeting")}
      </p>
    </>
  );
}
