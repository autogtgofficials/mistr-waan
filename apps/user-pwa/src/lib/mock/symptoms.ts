/**
 * Mock symptom-form data for the Repairs flow.
 *
 * V0 keeps the form to a hard cap of 5 questions (Q6 = b). The
 * "estimator" is a curated lookup table — not an LLM (per the locked
 * decision to drop the AI framing).
 */

export interface SymptomCategory {
  id: string;
  label: string;
  emoji: string;
}

export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  { id: "engine", label: "Engine", emoji: "🛠" },
  { id: "brakes", label: "Brakes", emoji: "🛞" },
  { id: "ac", label: "AC", emoji: "❄️" },
  { id: "battery", label: "Battery / Electrical", emoji: "🔋" },
  { id: "suspension", label: "Suspension / Steering", emoji: "🪛" },
  { id: "other", label: "Something else", emoji: "❓" },
];

export interface SymptomOption {
  id: string;
  label: string;
}

export const SYMPTOMS_BY_CATEGORY: Record<string, SymptomOption[]> = {
  engine: [
    { id: "rough-idle", label: "Sounds rough at idle" },
    { id: "warning-light", label: "Warning light on" },
    { id: "hard-start", label: "Hard to start" },
    { id: "loss-power", label: "Loss of power" },
    { id: "dont-know", label: "I don't know" },
  ],
  brakes: [
    { id: "spongy", label: "Brake feels spongy" },
    { id: "noisy", label: "Noisy when braking" },
    { id: "pulling", label: "Car pulls to one side" },
    { id: "warning-light", label: "Brake warning light" },
    { id: "dont-know", label: "I don't know" },
  ],
  ac: [
    { id: "no-cool", label: "Not cooling enough" },
    { id: "smell", label: "Bad smell from vents" },
    { id: "noise", label: "Strange noise" },
    { id: "dont-know", label: "I don't know" },
  ],
  battery: [
    { id: "wont-start", label: "Car won't start" },
    { id: "dim-lights", label: "Dim lights / electrical glitches" },
    { id: "dont-know", label: "I don't know" },
  ],
  suspension: [
    { id: "bumpy", label: "Bumpy ride" },
    { id: "pulling", label: "Steering pulls to a side" },
    { id: "noise", label: "Knocking noise on bumps" },
    { id: "dont-know", label: "I don't know" },
  ],
  other: [{ id: "describe-to-mechanic", label: "I'll describe it to the mechanic" }],
};

export const DURATION_OPTIONS: SymptomOption[] = [
  { id: "today", label: "Started today" },
  { id: "week", label: "This week" },
  { id: "longer", label: "Longer than a week" },
  { id: "dont-know", label: "I don't know" },
];

/**
 * Mock estimator — returns price range for a (category, symptom) pair.
 * V0 = curated table; V1+ uses real LLM.
 */
export interface Estimate {
  rangeMin: number;
  rangeMax: number;
  likelyItems: string[];
}

const ESTIMATOR: Record<string, Estimate> = {
  "engine.rough-idle": {
    rangeMin: 800,
    rangeMax: 2500,
    likelyItems: ["Spark plug clean / replace", "Throttle body clean"],
  },
  "engine.warning-light": {
    rangeMin: 500,
    rangeMax: 4000,
    likelyItems: ["OBD scan", "Sensor check"],
  },
  "engine.hard-start": {
    rangeMin: 1500,
    rangeMax: 4500,
    likelyItems: ["Battery test", "Starter motor check"],
  },
  "engine.loss-power": {
    rangeMin: 1500,
    rangeMax: 6000,
    likelyItems: ["Air filter change", "Fuel filter change", "Compression check"],
  },
  "brakes.spongy": {
    rangeMin: 1200,
    rangeMax: 3500,
    likelyItems: ["Brake fluid top-up / replace", "Bleed brakes"],
  },
  "brakes.noisy": {
    rangeMin: 1500,
    rangeMax: 4000,
    likelyItems: ["Brake pad replacement", "Disc skim"],
  },
  "brakes.pulling": {
    rangeMin: 1500,
    rangeMax: 5000,
    likelyItems: ["Caliper service", "Pad alignment"],
  },
  "brakes.warning-light": {
    rangeMin: 800,
    rangeMax: 3500,
    likelyItems: ["Sensor diagnostic", "Brake fluid level"],
  },
  "ac.no-cool": {
    rangeMin: 1500,
    rangeMax: 6000,
    likelyItems: ["Gas refill", "Compressor check"],
  },
  "ac.smell": {
    rangeMin: 600,
    rangeMax: 2000,
    likelyItems: ["AC clean & deodorize", "Cabin filter replace"],
  },
  "ac.noise": {
    rangeMin: 1500,
    rangeMax: 8000,
    likelyItems: ["Compressor check", "Bearing replacement"],
  },
  "battery.wont-start": {
    rangeMin: 500,
    rangeMax: 6500,
    likelyItems: ["Battery test", "Battery replacement (if needed)"],
  },
  "battery.dim-lights": {
    rangeMin: 800,
    rangeMax: 4500,
    likelyItems: ["Alternator check", "Battery test"],
  },
  "suspension.bumpy": {
    rangeMin: 2500,
    rangeMax: 12000,
    likelyItems: ["Shock absorber check", "Bushing replacement"],
  },
  "suspension.pulling": {
    rangeMin: 800,
    rangeMax: 2500,
    likelyItems: ["Wheel alignment"],
  },
  "suspension.noise": {
    rangeMin: 1500,
    rangeMax: 6000,
    likelyItems: ["Linkage check", "Shock check"],
  },
};

export function getEstimate(category?: string, symptom?: string): Estimate | null {
  if (!category || !symptom) return null;
  if (symptom === "dont-know") return null;
  return ESTIMATOR[`${category}.${symptom}`] ?? null;
}
