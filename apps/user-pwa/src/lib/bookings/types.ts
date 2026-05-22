import type { Database } from "@/lib/supabase/types";

export type BookingBucket = Database["public"]["Enums"]["booking_bucket"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PaymentMode = Database["public"]["Enums"]["payment_mode"];

export interface CreateBookingInput {
  profileId: string;
  bucket: BookingBucket;
  serviceIds: string[];
  garageId?: string | null;
  slotLabel: string;
  slotDate?: string | null;
  slotTime?: string | null;
  paymentMode: PaymentMode;
  symptoms?: Record<string, unknown> | null;
  denting?: Record<string, unknown> | null;
}

export interface BookingGarage {
  id: string;
  slug: string | null;
  ownerFirstName: string;
  ownerLastName: string;
  shopName: string;
  area: string;
  fullAddress: string;
  rating: number;
  jobsCompleted: number;
}

export interface BookingService {
  id: string;
  name: string;
  basePrice: number;
  durationLabel: string | null;
  blurb: string | null;
  isQuoted: boolean;
}

export interface Booking {
  id: string;
  shortId: string;
  profileId: string;
  bucket: BookingBucket;
  serviceIds: string[];
  garageId: string | null;
  garage?: BookingGarage | null;
  /** Fully-hydrated service catalog rows for serviceIds (lookup-side only). */
  services?: BookingService[];
  slotDate: string | null;
  slotTime: string | null;
  slotLabel: string;
  paymentMode: PaymentMode;
  total: number | null;
  baseTotal: number | null;
  status: BookingStatus;
  symptoms: Record<string, unknown> | null;
  denting: Record<string, unknown> | null;
  cancellationReason: string | null;
  ratingValue: number | null;
  ratingComment: string | null;
  createdAt: string;
  updatedAt: string;
  queuedForCallAt: string;
  quotedAt: string | null;
  assignedAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}
