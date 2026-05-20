"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { ActiveJobBar } from "@/components/layout/ActiveJobBar";
import { BottomCTA } from "@/components/booking/BottomCTA";
import { Button } from "@/components/ui/Button";
import {
  SYMPTOM_CATEGORIES,
  SYMPTOMS_BY_CATEGORY,
  DURATION_OPTIONS,
} from "@/lib/mock/symptoms";
import { useBookingDraft } from "@/lib/store/booking-draft";
import { cn } from "@/lib/utils";

/**
 * /repairs — symptom form (5 question hard cap, locked Q6 = b).
 *
 * Multi-step within a single page (a Wizard). Steps:
 *   1. Pick category
 *   2. Pick symptom (within category)
 *   3. How long?
 *   4. (Optional) Photo intent — V0 stub: "we'll skip photos for now"
 *   5. Continue → /repairs/estimate
 */
export default function RepairsPage() {
  const router = useRouter();
  const { draft, hydrated, update } = useBookingDraft();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (draft.bucket !== "repairs") {
      update({
        bucket: "repairs",
        serviceIds: [],
        garageId: undefined,
        slot: undefined,
        symptoms: undefined,
      });
    } else if (draft.symptoms) {
      setCategory(draft.symptoms.category ?? null);
      setSymptom(draft.symptoms.symptom ?? null);
      setDuration(draft.symptoms.duration ?? null);
    }
  }, [hydrated, draft.bucket, draft.symptoms, update]);

  const totalSteps = 3;

  function next() {
    if (step === 1 && category) setStep(2);
    else if (step === 2 && symptom) setStep(3);
    else if (step === 3 && duration) {
      update({
        bucket: "repairs",
        symptoms: {
          category: category ?? undefined,
          symptom: symptom ?? undefined,
          duration: duration ?? undefined,
        },
      });
      router.push("/repairs/estimate");
    }
  }

  function back() {
    if (step === 1) router.push("/");
    else setStep((s) => s - 1);
  }

  const canContinue =
    (step === 1 && !!category) ||
    (step === 2 && !!symptom) ||
    (step === 3 && !!duration);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        left={
          <button
            onClick={back}
            aria-label="Back"
            className="tap flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
        }
        title={
          <span>
            Step {step} of {totalSteps}
          </span>
        }
      />
      <ActiveJobBar />

      <main className="flex-1 pb-32">
        <div className="mx-auto w-full max-w-md px-4 pt-6">
          {step === 1 ? (
            <Step1Category selected={category} onPick={setCategory} />
          ) : null}
          {step === 2 ? (
            <Step2Symptom
              category={category}
              selected={symptom}
              onPick={setSymptom}
            />
          ) : null}
          {step === 3 ? (
            <Step3Duration selected={duration} onPick={setDuration} />
          ) : null}
        </div>
      </main>

      <BottomCTA>
        <Button onClick={next} disabled={!canContinue}>
          {step === totalSteps ? "See estimate ›" : "Continue ›"}
        </Button>
      </BottomCTA>
    </div>
  );
}

function Step1Category({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground">What&apos;s wrong?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick the area you&apos;re worried about.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {SYMPTOM_CATEGORIES.map((cat) => (
          <OptionTile
            key={cat.id}
            isOn={selected === cat.id}
            onClick={() => onPick(cat.id)}
            emoji={cat.emoji}
            label={cat.label}
          />
        ))}
      </div>
    </>
  );
}

function Step2Symptom({
  category,
  selected,
  onPick,
}: {
  category: string | null;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const list = category ? SYMPTOMS_BY_CATEGORY[category] : [];
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground">Show me the symptom.</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Closest match works — pick &quot;I don&apos;t know&quot; if unsure.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {list.map((s) => (
          <OptionRow
            key={s.id}
            isOn={selected === s.id}
            onClick={() => onPick(s.id)}
            label={s.label}
          />
        ))}
      </div>
      <Link
        href="/garages?service=repairs"
        className="mt-6 inline-block text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Skip — let the garage diagnose →
      </Link>
    </>
  );
}

function Step3Duration({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground">How long has it been happening?</h1>
      <div className="mt-6 flex flex-col gap-3">
        {DURATION_OPTIONS.map((d) => (
          <OptionRow
            key={d.id}
            isOn={selected === d.id}
            onClick={() => onPick(d.id)}
            label={d.label}
          />
        ))}
      </div>
    </>
  );
}

function OptionTile({
  isOn,
  onClick,
  emoji,
  label,
}: {
  isOn: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOn}
      className={cn(
        "tap flex aspect-square flex-col items-center justify-center gap-2 rounded-md border p-4 text-center transition-colors active:scale-[0.98]",
        isOn
          ? "border-primary bg-primary-soft"
          : "border-border bg-card hover:border-steel-300",
      )}
    >
      <span aria-hidden className="text-3xl">
        {emoji}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}

function OptionRow({
  isOn,
  onClick,
  label,
}: {
  isOn: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOn}
      className={cn(
        "tap flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors active:scale-[0.99]",
        isOn
          ? "border-primary bg-primary-soft"
          : "border-border bg-card hover:border-steel-300",
      )}
    >
      <span className="text-base font-medium text-foreground">{label}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          isOn ? "border-primary bg-primary" : "border-steel-300",
        )}
        aria-hidden
      >
        {isOn ? <Check className="size-3 text-primary-foreground" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
