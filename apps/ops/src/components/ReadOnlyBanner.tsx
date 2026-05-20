// Server-rendered banner. Shows only on Vercel deployments (where the
// filesystem is read-only and our PATCH endpoint silently no-ops). On
// localhost the banner is hidden because writes work normally.

export function ReadOnlyBanner() {
  if (!process.env.VERCEL) return null;
  return (
    <div className="border-b border-ignite-200 bg-ignite-50 px-4 py-2 text-center text-xs text-ignite-800">
      <strong>Preview build —</strong> status / notes edits won&apos;t persist on this hosted copy. Run locally
      to track outreach for real.
    </div>
  );
}
