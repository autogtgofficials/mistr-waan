import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mutable state shared with the hoisted module mocks below.
const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  clearDraft: vi.fn(),
  // overwritten per test
  draft: { serviceIds: [] as string[] } as {
    serviceIds: string[];
    bucket?: "detailing" | "repairs" | "denting";
    garageId?: string;
  },
  auth: { isAuthed: true, hydrated: true } as {
    isAuthed: boolean;
    hydrated: boolean;
    user?: { phone: string };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, back: h.back }),
}));
vi.mock("@/lib/store/auth", () => ({
  useAuth: () => ({ ...h.auth, signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/store/booking-draft", () => ({
  useBookingDraft: () => ({ draft: h.draft, hydrated: true, update: vi.fn(), reset: vi.fn() }),
  clearDraft: h.clearDraft,
}));
// Layout chrome isn't under test — stub to plain elements.
vi.mock("@/components/layout/TopBar", () => ({ TopBar: () => null }));
vi.mock("@/components/booking/BottomCTA", () => ({
  BottomCTA: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import BookingRequestPage from "./page";

beforeEach(() => {
  h.push.mockReset();
  h.replace.mockReset();
  h.back.mockReset();
  h.clearDraft.mockReset();
  h.draft = { serviceIds: [], bucket: "repairs" };
  h.auth = { isAuthed: true, hydrated: true, user: { phone: "+916006617842" } };
  vi.stubGlobal("fetch", vi.fn());
});

describe("/booking/request", () => {
  it("redirects unauthenticated users to login with a next param", async () => {
    h.auth = { isAuthed: false, hydrated: true };
    render(<BookingRequestPage />);
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith(
        "/login?next=%2Fbooking%2Frequest",
      ),
    );
  });

  it("redirects to /services when there is no draft bucket", async () => {
    h.draft = { serviceIds: [] };
    render(<BookingRequestPage />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/services"));
  });

  it("renders the bucket and the call-back reassurance for a signed-in user", () => {
    render(<BookingRequestPage />);
    expect(
      screen.getByRole("heading", { name: /book repairs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/we'll call you to confirm/i)).toBeInTheDocument();
    expect(screen.getByText("+916006617842")).toBeInTheDocument();
  });

  it("creates the booking and redirects to the confirmation page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ booking: { id: "b1", shortId: "AG-TEST01" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BookingRequestPage />);
    await userEvent.click(screen.getByRole("button", { name: /confirm booking/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/bookings");
    expect(JSON.parse(init.body)).toMatchObject({ bucket: "repairs", serviceIds: [] });

    await waitFor(() => {
      expect(h.clearDraft).toHaveBeenCalled();
      expect(h.replace).toHaveBeenCalledWith("/booking/confirmation/AG-TEST01");
    });
  });

  it("shows an error and does not redirect when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    render(<BookingRequestPage />);
    await userEvent.click(screen.getByRole("button", { name: /confirm booking/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't place your booking/i);
    expect(h.clearDraft).not.toHaveBeenCalled();
  });
});
