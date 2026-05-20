import { ReadOnlyBanner } from "@/components/ops/ReadOnlyBanner";

export const metadata = {
  title: "Mister Waan — Ops",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ReadOnlyBanner />
      {children}
    </>
  );
}
