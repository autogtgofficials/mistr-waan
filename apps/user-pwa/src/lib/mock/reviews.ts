/**
 * Mock reviews — V0 placeholder.
 *
 * Reviewers are also rendered with first + last initial ("A.S.") to match
 * the same anonymization rule we use for garage owners (locked Q3 = b).
 */

export interface Review {
  id: string;
  reviewerFirstName: string;
  reviewerLastName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  /** Days since the review was posted — used by `timeAgo()`. */
  ageDays: number;
}

export const reviewsByGarage: Record<string, Review[]> = {
  "g-imran-k": [
    {
      id: "r1",
      reviewerFirstName: "Aamir",
      reviewerLastName: "Shah",
      rating: 5,
      comment: "Quick and clean. Recommended.",
      ageDays: 14,
    },
    {
      id: "r2",
      reviewerFirstName: "Rashid",
      reviewerLastName: "Bhat",
      rating: 4,
      comment: "Good work, took longer than expected.",
      ageDays: 22,
    },
    {
      id: "r3",
      reviewerFirstName: "Sameer",
      reviewerLastName: "Wani",
      rating: 5,
      comment: "Great ceramic coating. Worth the price.",
      ageDays: 30,
    },
  ],
  "g-faisal-m": [
    {
      id: "r4",
      reviewerFirstName: "Ovais",
      reviewerLastName: "Lone",
      rating: 5,
      comment: "Faisal is honest about what's needed and what's not.",
      ageDays: 9,
    },
    {
      id: "r5",
      reviewerFirstName: "Khalid",
      reviewerLastName: "Mir",
      rating: 4,
      comment: "Clean shop, fair pricing.",
      ageDays: 18,
    },
  ],
  "g-bilal-a": [
    {
      id: "r6",
      reviewerFirstName: "Hilal",
      reviewerLastName: "Dar",
      rating: 4,
      comment: "New shop but careful work. Will use again.",
      ageDays: 5,
    },
  ],
  "g-aamir-s": [
    {
      id: "r7",
      reviewerFirstName: "Asif",
      reviewerLastName: "Khan",
      rating: 5,
      comment: "Diagnosed the issue in 10 minutes. Fast.",
      ageDays: 7,
    },
    {
      id: "r8",
      reviewerFirstName: "Mehraj",
      reviewerLastName: "Bhat",
      rating: 4,
      comment: "Fair pricing, decent turnaround.",
      ageDays: 21,
    },
    {
      id: "r9",
      reviewerFirstName: "Tariq",
      reviewerLastName: "Wani",
      rating: 5,
      comment: "Honest mechanic, didn't oversell.",
      ageDays: 35,
    },
  ],
  "g-rashid-b": [
    {
      id: "r10",
      reviewerFirstName: "Mubashir",
      reviewerLastName: "Ahmed",
      rating: 4,
      comment: "Body work was good, took some time but worth it.",
      ageDays: 12,
    },
  ],
};

export function getReviewsForGarage(garageId: string): Review[] {
  return reviewsByGarage[garageId] ?? [];
}
