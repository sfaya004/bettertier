/**
 * Plain data types used by the recommendation engine.
 * These are deliberately independent of the database so the engine
 * can be unit-tested and reused on the client.
 */

export type FeatureType = "number" | "boolean" | "ordinal" | "info";
export type FeatureValue = number | boolean | string | null;
export type BillingPeriod = "monthly" | "annual" | "weekly" | "one-time";

export interface AnswerOption {
  label: string;
  value: number | string | boolean;
}

export interface FeatureDef {
  key: string;
  label: string;
  type: FeatureType;
  levels?: string[]; // ordinal: lowest -> highest
  levelLabels?: Record<string, string>;
  question?: string;
  help?: string;
  options?: AnswerOption[];
  sortOrder: number;
}

export interface PriceDef {
  period: BillingPeriod;
  amount: number | null;
  currency: string;
  isPromo?: boolean;
  notes?: string | null;
}

export interface PlanDef {
  slug: string;
  name: string;
  tier: number;
  status: "active" | "grandfathered" | "retired";
  confidence: "verified" | "uncertain";
  prices: PriceDef[];
  features: Record<string, FeatureValue>;
  bestFor?: string | null;
  notes?: string | null;
  seatsIncluded?: number | null;
}

export interface ProductDef {
  slug: string;
  name: string;
  companyName: string;
  category: string;
  pricingUrl?: string | null;
  /** Tracked partner link, used instead of pricingUrl for the "change my plan" action and labelled as an affiliate link. */
  affiliateUrl?: string | null;
  planHelp?: string | null;
  lastVerifiedAt?: string | null;
  verificationStatus?: string;
  features: FeatureDef[];
  plans: PlanDef[];
}

/** User answers. `null` means "I'm not sure". Missing key = not asked yet. */
export type Answers = Record<string, FeatureValue>;

export interface AnalysisInput {
  product: ProductDef;
  /** slug of the current plan, or null for "I'm not sure" */
  currentPlanSlug: string | null;
  /** what the user says they pay, in the given period (optional) */
  userPrice?: number | null;
  userPeriod?: BillingPeriod;
  answers: Answers;
  /** override "today" for tests */
  today?: Date;
}

export type FitStatus =
  | "good_fit"
  | "over_subscribed"
  | "under_subscribed"
  | "needs_review"
  | "unable_to_verify";

export type RequirementState = "met" | "not_met" | "unknown" | "unused";

export interface RequirementCheck {
  featureKey: string;
  featureLabel: string;
  state: RequirementState;
  /** plain-language sentence for this requirement vs this plan */
  text: string;
  /** what the user needs, human readable */
  needed: string;
  /** what the plan provides, human readable */
  provided: string;
}

export interface PlanEvaluation {
  plan: PlanDef;
  monthlyCost: number | null; // normalized to per-month
  annualCost: number | null;
  priceKnown: boolean;
  satisfiesAll: boolean;
  checks: RequirementCheck[];
  unknownCount: number;
  /** features this plan has beyond the current plan */
  gainedVsCurrent: string[];
  /** features the user would lose vs the current plan */
  lostVsCurrent: string[];
  /** features the user said they need that this plan lacks */
  missing: string[];
  isCurrent: boolean;
  isRecommended: boolean;
}

export interface AnalysisResult {
  status: FitStatus;
  headline: string;
  summary: string;
  currentPlan: PlanEvaluation | null;
  recommendedPlan: PlanEvaluation | null;
  /** positive = savings, negative = extra cost, null = unknown */
  monthlyDifference: number | null;
  annualDifference: number | null;
  currentMonthlyCost: number | null;
  recommendedMonthlyCost: number | null;
  /** "Why?" bullets, plain language */
  reasons: string[];
  /** requirements the user was unsure about that affect the answer */
  uncertainties: string[];
  /** features lost by switching to the recommended plan */
  featuresLost: string[];
  featuresGained: string[];
  /** all plans, for the "See all plans" section */
  allPlans: PlanEvaluation[];
  /** notes about pricing/verification the user should know */
  caveats: string[];
  dataVerifiedAt: string | null;
  dataIsStale: boolean;
  pricingUrl: string | null;
  usedUserPrice: boolean;
  questionsAsked: number;
}
