import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { HeroSlot } from "@/components/home/HeroSlot";
import { ServiceMenu } from "@/components/home/ServiceMenu";
import { Greeting } from "@/components/home/Greeting";
import { RecentJobs } from "@/components/home/RecentJobs";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dict";

/**
 * Home — works for logged-out (browse-first) and logged-in users.
 *
 * Server component. Client children (Greeting, HeroSlot, ServiceCard,
 * TabBar, ActiveJobBar) read locale via the `useLocale` hook.
 */
export default async function HomePage() {
  const locale = await getLocale();

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <ActiveJobBar />

      <main className="flex-1 pb-8">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <Greeting />

          <div className="mt-6">
            <HeroSlot />
          </div>

          <div className="mt-8">
            <h2
              className={
                locale === "ur"
                  ? "text-base font-semibold text-foreground font-urdu"
                  : "text-base font-semibold text-foreground"
              }
            >
              {t(locale, "home.pickService")}
            </h2>
            <div className="mt-3">
              <ServiceMenu />
            </div>
          </div>

          <RecentJobs />
        </div>
      </main>

      <TabBar />
    </div>
  );
}
