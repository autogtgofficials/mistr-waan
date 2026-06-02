import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { listServicesByBucket } from "@/lib/services/catalog";
import { MaintenanceForm } from "./MaintenanceForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Scheduled Maintenance · AutoGTG" };

/**
 * /maintenance — DB-backed booking for the Scheduled Maintenance module.
 * Server component fetches the catalog; the client form collects vehicle
 * type, service, slot, vehicle details, and posts to /api/bookings.
 */
export default async function MaintenancePage() {
  const services = await listServicesByBucket("scheduled_maintenance");
  // Split by the "Car: " / "Bike: " name prefix the seed uses.
  const car = services
    .filter((s) => s.name.startsWith("Car: "))
    .map((s) => ({ ...s, name: s.name.replace("Car: ", "") }));
  const bike = services
    .filter((s) => s.name.startsWith("Bike: "))
    .map((s) => ({ ...s, name: s.name.replace("Bike: ", "") }));

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title={<span>Scheduled Maintenance</span>} />
      <main className="flex-1 pb-28">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          <MaintenanceForm carServices={car} bikeServices={bike} />
        </div>
      </main>
      <TabBar />
    </div>
  );
}
