import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { listServicesByBucket } from "@/lib/services/catalog";
import { RsaForm } from "./RsaForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Roadside Assistance · AutoGTG" };

/**
 * /rsa — emergency Roadside Assistance request. DB-backed; posts to
 * /api/bookings with bucket=rsa. Ops dispatches the nearest garage (the
 * blueprint keeps RSA ops-mediated for V1).
 */
export default async function RsaPage() {
  const services = await listServicesByBucket("rsa");
  return (
    <div className="flex min-h-full flex-col">
      <TopBar title={<span>Roadside Assistance</span>} />
      <main className="flex-1 pb-28">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <div className="mb-4 rounded-md border border-orange-100 bg-orange-50 p-3 text-sm text-ignite-900">
            🚨 For emergencies we&apos;ll call you within minutes to dispatch the
            nearest mechanic.
          </div>
          <RsaForm services={services} />
        </div>
      </main>
      <TabBar />
    </div>
  );
}
