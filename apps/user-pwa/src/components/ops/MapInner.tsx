"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Mechanic, OnboardingStatus } from "@/lib/mechanics/types";
import { StatusBadge } from "./StatusBadge";

const STATUS_COLOR: Record<OnboardingStatus, string> = {
  not_contacted: "#b8b9c2",
  contacted: "#ff6b2d",
  interested: "#00c2cb",
  onboarded: "#16a34a",
  declined: "#dc2626",
};

const SRINAGAR_CENTER: [number, number] = [34.0837, 74.7973];

export default function MapInner({ mechanics }: { mechanics: Mechanic[] }) {
  return (
    <MapContainer
      center={SRINAGAR_CENTER}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OSM Standard">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Carto Light">
          <TileLayer
            attribution='&copy; OpenStreetMap, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {mechanics.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={7}
          pathOptions={{
            color: STATUS_COLOR[m.onboardingStatus],
            fillColor: STATUS_COLOR[m.onboardingStatus],
            fillOpacity: 0.7,
            weight: 2,
          }}
        >
          <Popup>
            <div className="flex flex-col gap-1 min-w-[200px]">
              <div className="font-semibold text-sm">{m.name}</div>
              {m.area ? <div className="text-xs text-gray-600">{m.area}</div> : null}
              {m.address ? <div className="text-xs text-gray-500">{m.address}</div> : null}
              <div className="text-xs">
                Services: {m.services.filter((s) => s !== "unknown").join(", ") || "—"}
              </div>
              {m.phones[0] ? (
                <div className="text-xs">
                  ☎{" "}
                  <a href={`tel:${m.phones[0]}`} className="text-blue-600 hover:underline">
                    {m.phones[0]}
                  </a>
                </div>
              ) : null}
              <div className="mt-1">
                <StatusBadge status={m.onboardingStatus} />
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
