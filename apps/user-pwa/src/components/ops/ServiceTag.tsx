import { cn } from "@/lib/utils";
import type { ServiceTag as ServiceTagType } from "@/lib/mechanics/types";

const META: Record<ServiceTagType, { label: string; cls: string }> = {
  repair: { label: "Repair", cls: "bg-pulse-50 text-pulse-700" },
  detailing: { label: "Detailing", cls: "bg-aqua-50 text-aqua-700" },
  denting: { label: "Denting", cls: "bg-ignite-50 text-ignite-700" },
  tyres: { label: "Tyres", cls: "bg-steel-100 text-steel-700" },
  parts: { label: "Parts", cls: "bg-steel-100 text-steel-700" },
  car_wash: { label: "Car wash", cls: "bg-aqua-50 text-aqua-700" },
  dealer: { label: "Dealer", cls: "bg-muted text-muted-foreground" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
};

export function ServiceTag({ service }: { service: ServiceTagType }) {
  const m = META[service] ?? META.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
