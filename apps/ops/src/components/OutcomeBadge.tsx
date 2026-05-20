import { cn } from "@/lib/utils";
import {
  OUTCOME_BUCKETS,
  type OutreachOutcome,
} from "@/lib/mechanics/types";

export const OUTCOME_LABELS: Record<OutreachOutcome, string> = {
  agreed: "Agreed",
  verbal_yes: "Verbal yes",
  conditional_yes: "Conditional yes",
  interested: "Interested",
  wants_meeting: "Wants meeting",
  wants_to_consult: "Consulting partner",
  callback_scheduled: "Callback scheduled",
  skeptical: "Skeptical",
  negotiating: "Negotiating",
  competitor_engaged: "With competitor",
  ghosted: "Ghosted",
  declined: "Declined",
  declined_dnc: "Declined — DNC",
  wants_kickback: "Wants kickback",
  no_answer: "No answer",
  invalid_number: "Invalid number",
  voicemail: "Voicemail left",
  gatekeeper_only: "Gatekeeper only",
  callback_requested: "Asked to call back",
  redirected: "Redirected",
  email_bounced: "Email bounced",
  permanently_closed: "Permanently closed",
  temporarily_closed: "Temporarily closed",
  duplicate: "Duplicate",
};

const BUCKET_CLS: Record<
  ReturnType<typeof bucketOf>,
  { bg: string; text: string }
> = {
  won: { bg: "bg-green-50", text: "text-green-700" },
  warm: { bg: "bg-aqua-50", text: "text-aqua-700" },
  lost: { bg: "bg-danger-soft", text: "text-danger" },
  no_reach: { bg: "bg-steel-100", text: "text-steel-700" },
  edge: { bg: "bg-muted", text: "text-muted-foreground" },
};

function bucketOf(o: OutreachOutcome) {
  return OUTCOME_BUCKETS[o];
}

export function OutcomeBadge({
  outcome,
  className,
}: {
  outcome: OutreachOutcome;
  className?: string;
}) {
  const cls = BUCKET_CLS[bucketOf(outcome)];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        cls.bg,
        cls.text,
        className,
      )}
    >
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}
