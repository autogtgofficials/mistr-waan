// Shape of one mechanic in data/mechanics.json (produced by
// tools/scrape-mechanics/scrape.mjs + enrich.mjs).

export type ServiceTag =
  | "repair"
  | "detailing"
  | "denting"
  | "tyres"
  | "parts"
  | "car_wash"
  | "dealer"
  | "unknown";

// Coarse onboarding pipeline status — kept for backwards compat with the
// existing list/coverage views and the aggregate "where are we" lens.
export type OnboardingStatus =
  | "not_contacted"
  | "contacted"
  | "interested"
  | "declined"
  | "onboarded";

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "not_contacted",
  "contacted",
  "interested",
  "onboarded",
  "declined",
];

// Per-attempt outreach outcome. Bigger taxonomy than OnboardingStatus so the
// caller can capture exactly what happened on a single contact attempt.
export type OutreachOutcome =
  // closed-won
  | "agreed"
  | "verbal_yes"
  | "conditional_yes"
  // warm / open
  | "interested"
  | "wants_meeting"
  | "wants_to_consult"
  | "callback_scheduled"
  | "skeptical"
  | "negotiating"
  | "competitor_engaged"
  | "ghosted"
  // closed-lost
  | "declined"
  | "declined_dnc"
  | "wants_kickback"
  // couldn't reach
  | "no_answer"
  | "invalid_number"
  | "voicemail"
  | "gatekeeper_only"
  | "callback_requested"
  | "redirected"
  | "email_bounced"
  // edge cases
  | "permanently_closed"
  | "temporarily_closed"
  | "duplicate";

export const OUTREACH_OUTCOMES: readonly OutreachOutcome[] = [
  "agreed",
  "verbal_yes",
  "conditional_yes",
  "interested",
  "wants_meeting",
  "wants_to_consult",
  "callback_scheduled",
  "skeptical",
  "negotiating",
  "competitor_engaged",
  "ghosted",
  "declined",
  "declined_dnc",
  "wants_kickback",
  "no_answer",
  "invalid_number",
  "voicemail",
  "gatekeeper_only",
  "callback_requested",
  "redirected",
  "email_bounced",
  "permanently_closed",
  "temporarily_closed",
  "duplicate",
];

// Buckets for grouping outcomes in the UI.
export const OUTCOME_BUCKETS: Record<OutreachOutcome,
  "won" | "warm" | "lost" | "no_reach" | "edge"> = {
  agreed: "won",
  verbal_yes: "won",
  conditional_yes: "won",
  interested: "warm",
  wants_meeting: "warm",
  wants_to_consult: "warm",
  callback_scheduled: "warm",
  skeptical: "warm",
  negotiating: "warm",
  competitor_engaged: "warm",
  ghosted: "warm",
  declined: "lost",
  declined_dnc: "lost",
  wants_kickback: "lost",
  no_answer: "no_reach",
  invalid_number: "no_reach",
  voicemail: "no_reach",
  gatekeeper_only: "no_reach",
  callback_requested: "no_reach",
  redirected: "no_reach",
  email_bounced: "no_reach",
  permanently_closed: "edge",
  temporarily_closed: "edge",
  duplicate: "edge",
};

// Granular service taxonomy used by the call-person to capture exactly what
// the business offers. Superset of ServiceTag (which stays as the OSM-derived
// coarse tag).
export type DetailedService =
  // mechanical / repair
  | "general_repair"
  | "periodic_servicing"
  | "ac_repair"
  | "auto_electricals"
  | "diagnostics"
  | "engine_overhaul"
  | "clutch_gearbox"
  // tyres / wheels / battery
  | "tyre_sales"
  | "wheel_alignment"
  | "battery_sales"
  | "puncture_repair"
  // body & paint
  | "denting_painting"
  | "collision_repair"
  | "glass_replacement"
  | "bumper_repair"
  // cleaning & detailing
  | "basic_wash"
  | "automated_wash"
  | "interior_shampoo"
  | "polish_wax"
  | "ceramic_coating"
  | "ppf"
  | "sun_film"
  | "underbody_coating"
  // parts & accessories
  | "oem_parts"
  | "aftermarket_parts"
  | "lubricants"
  | "audio_infotainment"
  | "lighting"
  | "seat_covers"
  | "alloys_rims"
  | "performance_parts"
  | "decals_wraps"
  // specialty
  | "ev_service"
  | "two_wheeler"
  | "commercial_vehicle"
  | "pickup_drop"
  | "roadside_assistance"
  | "insurance_assistance"
  | "rto_documentation"
  | "preowned_sales"
  | "fuel_pump_attached";

export const DETAILED_SERVICE_GROUPS: ReadonlyArray<{
  label: string;
  services: readonly DetailedService[];
}> = [
  {
    label: "Mechanical & repair",
    services: [
      "general_repair",
      "periodic_servicing",
      "ac_repair",
      "auto_electricals",
      "diagnostics",
      "engine_overhaul",
      "clutch_gearbox",
    ],
  },
  {
    label: "Tyres, wheels, battery",
    services: ["tyre_sales", "wheel_alignment", "battery_sales", "puncture_repair"],
  },
  {
    label: "Body & paint",
    services: ["denting_painting", "collision_repair", "glass_replacement", "bumper_repair"],
  },
  {
    label: "Cleaning & detailing",
    services: [
      "basic_wash",
      "automated_wash",
      "interior_shampoo",
      "polish_wax",
      "ceramic_coating",
      "ppf",
      "sun_film",
      "underbody_coating",
    ],
  },
  {
    label: "Parts & accessories",
    services: [
      "oem_parts",
      "aftermarket_parts",
      "lubricants",
      "audio_infotainment",
      "lighting",
      "seat_covers",
      "alloys_rims",
      "performance_parts",
      "decals_wraps",
    ],
  },
  {
    label: "Specialty / value-add",
    services: [
      "ev_service",
      "two_wheeler",
      "commercial_vehicle",
      "pickup_drop",
      "roadside_assistance",
      "insurance_assistance",
      "rto_documentation",
      "preowned_sales",
      "fuel_pump_attached",
    ],
  },
];

export const DETAILED_SERVICE_LABELS: Record<DetailedService, string> = {
  general_repair: "General repair",
  periodic_servicing: "Periodic servicing",
  ac_repair: "AC repair",
  auto_electricals: "Auto electricals",
  diagnostics: "Diagnostics (OBD)",
  engine_overhaul: "Engine overhaul",
  clutch_gearbox: "Clutch / gearbox",
  tyre_sales: "Tyre sales & fit",
  wheel_alignment: "Wheel alignment",
  battery_sales: "Battery sales",
  puncture_repair: "Puncture repair",
  denting_painting: "Denting & painting",
  collision_repair: "Collision repair",
  glass_replacement: "Glass replacement",
  bumper_repair: "Bumper repair",
  basic_wash: "Basic wash",
  automated_wash: "Automated / steam wash",
  interior_shampoo: "Interior shampoo",
  polish_wax: "Polish & wax",
  ceramic_coating: "Ceramic coating",
  ppf: "PPF",
  sun_film: "Sun film / tinting",
  underbody_coating: "Underbody coating",
  oem_parts: "OEM parts",
  aftermarket_parts: "Aftermarket parts",
  lubricants: "Lubricants & oils",
  audio_infotainment: "Audio / infotainment",
  lighting: "Lighting",
  seat_covers: "Seat covers / upholstery",
  alloys_rims: "Alloys / rims",
  performance_parts: "Performance parts",
  decals_wraps: "Decals / wraps",
  ev_service: "EV service / charging",
  two_wheeler: "Two-wheeler",
  commercial_vehicle: "Commercial vehicle",
  pickup_drop: "Pickup & drop",
  roadside_assistance: "Roadside assistance",
  insurance_assistance: "Insurance assistance",
  rto_documentation: "RTO / documentation",
  preowned_sales: "Pre-owned sales",
  fuel_pump_attached: "Fuel pump attached",
};

export type ContactChannel =
  | "phone"
  | "whatsapp"
  | "in_person"
  | "email"
  | "other";

export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  "phone",
  "whatsapp",
  "in_person",
  "email",
  "other",
];

export interface CallAttempt {
  id: string; // local uuid
  at: string; // ISO timestamp
  channel: ContactChannel;
  outcome: OutreachOutcome;
  spokeWith?: string;
  durationMin?: number;
  notes?: string;
  nextActionAt?: string; // ISO date for follow-up
  nextActionNote?: string;
  createdBy?: string; // free-form caller id
}

export interface ServicePricing {
  service: DetailedService;
  priceMin?: number;
  priceMax?: number;
  unit?: "per_visit" | "per_hour" | "per_part" | "starts_from";
  notes?: string;
}

export interface BusinessProfile {
  ownerName?: string;
  ownerRole?: "owner" | "manager" | "partner" | "staff";
  decisionMaker?: string;
  preferredContact?: ContactChannel;
  languages?: ("en" | "ur" | "hi" | "ks")[];
  yearsInBusiness?: number;
  numBays?: number;
  numStaff?: number;
  dailyThroughput?: number;
  workingHours?: string;
  weeklyOff?: string;
  authorized?: boolean;
  authorizedBrands?: string[];
  multibrand?: boolean;
}

export interface ReverseGeocode {
  displayName: string;
  neighbourhood: string | null;
  suburb: string | null;
  cityDistrict: string | null;
  road: string | null;
  postcode: string | null;
}

export const SERVICE_TAGS: readonly ServiceTag[] = [
  "repair",
  "detailing",
  "denting",
  "tyres",
  "parts",
  "car_wash",
  "dealer",
  "unknown",
];

export const SERVICE_TAG_LABELS: Record<ServiceTag, string> = {
  repair: "Repairs",
  detailing: "Detailing",
  denting: "Denting & Painting",
  tyres: "Tyres",
  parts: "Parts",
  car_wash: "Car Wash",
  dealer: "Dealership",
  unknown: "Other",
};

export interface Mechanic {
  id: string;
  source: "overpass" | "manual";
  sourceId?: string;
  osmType: "node" | "way" | "relation";
  name: string;
  shopName: string | null;
  phones: string[];
  email: string | null;
  website: string | null;
  address: string | null;
  area: string | null;
  areaSource?: "dictionary" | "nominatim";
  lat: number;
  lng: number;
  services: ServiceTag[];
  openingHours: string | null;
  rating: number | null;
  reviewCount: number | null;
  // Editable / call-person fields (populated from overrides)
  onboardingStatus: OnboardingStatus;
  notes: string | null;
  outreachOutcome?: OutreachOutcome;
  detailedServices?: DetailedService[];
  pricing?: ServicePricing[];
  coverageAreas?: string[];
  businessProfile?: BusinessProfile;
  callLog?: CallAttempt[];
  nextFollowUpAt?: string;
  nextFollowUpNote?: string;
  tags?: string[];
  rawTags: Record<string, string>;
  reverseGeocode?: ReverseGeocode;
  scrapedAt: string;
  lastUpdatedAt: string;
}

/** All editable bits stored per-mechanic in the override store. */
export interface MechanicOverride {
  onboardingStatus?: OnboardingStatus;
  notes?: string | null;
  outreachOutcome?: OutreachOutcome;
  detailedServices?: DetailedService[];
  pricing?: ServicePricing[];
  coverageAreas?: string[];
  businessProfile?: BusinessProfile;
  callLog?: CallAttempt[];
  nextFollowUpAt?: string | null;
  nextFollowUpNote?: string | null;
  tags?: string[];
  updatedAt: string;
}

export type MechanicPatch = Omit<Partial<MechanicOverride>, "updatedAt">;
