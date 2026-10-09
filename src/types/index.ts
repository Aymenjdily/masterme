export interface PortfolioLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  order: number;
}

export interface SocialApp {
  id: string;
  platform: string;
  username: string;
  url: string;
  icon?: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  status: "active" | "completed" | "paused";
  items: LearningItem[];
}

export interface LearningItem {
  id: string;
  title: string;
  description?: string | null;
  resourceUrl?: string | null;
  status: "not_started" | "in_progress" | "completed";
  order: number;
}

export interface Timeline {
  id: string;
  date: string;
  wakeUpHour: number | null;
  blocks: TimeBlock[];
}

export interface TimeBlock {
  id: string;
  hour: number;
  title: string;
  description?: string;
  status: "planned" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  /** Set when the block was made from a #todo note */
  noteId?: string | null;
}

export type JobStatus =
  | "new"
  | "interested"
  | "to_apply"
  | "applied"
  | "interviewing"
  | "rejected"
  | "accepted"
  | "offer"
  | "archived"
  | "not_interested";

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  location?: string;
  source: "linkedin" | "linkedin-apify" | "indeed" | "manual";
  url: string;
  description?: string;
  salary?: string;
  postedDate?: string;
  status: JobStatus;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  externalId?: string;
  country?: string;
  workplaceType?: string;
  employmentType?: string;
  technologies?: string[];
  technologiesMatched?: string[];
  technologiesMissing?: string[];
  matchScore?: number;
  matchReasons?: string[];
}

export interface JobApplication {
  id: string;
  jobOfferId: string;
  applicationDate: string;
  coverLetter?: string;
  resumeVersion?: string;
  status?: string;
  followUpNotes?: string;
  lastFollowUpAt?: string;
  dueForFollowUp?: boolean;
  jobOffer?: JobOffer;
}

export interface RecruiterContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  linkedinUrl?: string;
  notes?: string;
  lastContactedAt?: string;
  dueForFollowUp?: boolean;
  endedAt?: string | null;
  endReason?: "offer" | "application" | "passed" | "not_interested" | "no_reply" | "other" | null;
  endNote?: string | null;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  type: "client" | "personal" | "saas";
  status: "active" | "completed" | "paused";
  clientName?: string;
  url?: string;
  previewImageUrl?: string;
  neonProjectId?: string | null;
  vercelHosting?: boolean;
  vercelProjectId?: string | null;
  vercelProjectName?: string | null;
  /** Errors and warnings over the last 24 h (Logs) */
  logs?: { errors: number; warnings: number };
  billings: ProjectBilling[];
  monthlyCosts: MonthlyCost[];
  /** Latest stored Neon cost (daily job or Recalculate); null when not linked or not calculated yet */
  infra?: { neonUsd: number; updatedAt: string; stale: boolean } | null;
}

export interface ProjectBilling {
  id: string;
  projectId: string;
  billingType: "one_time" | "monthly";
  amount: number;
  currency: string;
  description?: string;
  invoiceDate?: string;
}

export interface TechNews {
  id: string;
  title: string;
  url: string;
  source: string;
  description?: string;
  publishedDate?: string;
  tags: string[];
  createdAt?: string;
}

export interface MonthlyCost {
  id: string;
  name: string;
  category: "app" | "home" | "other";
  amount: number;
  currency: string;
  notes?: string;
  projectId?: string | null;
  project?: { id: string; title: string } | null;
}

export interface NotificationsSummary {
  newOffers: number;
  applicationsDue: number;
  contactsDue: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobRadarConfig {
  dailyQuotaMorocco: number;
  dailyQuotaFrance: number;
  dailyQuotaSaudi: number;
  dailyQuotaUk: number;
  monthlyBudgetUsd: number;
  budgetMarginPct: number;
  matchThreshold: number;
  collectEnabled: boolean;
  timezone: string;
  profileTitle: string;
  yearsExperience: number;
  employmentTypes: string[];
  titleKeywords: string[];
}

export interface RunSummary {
  id: string;
  status: string;
  trigger: string;
  resultsRetrieved: number;
  newJobs: number;
  apifyUsd: number | null;
  note?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface JobRadarOverview {
  config: JobRadarConfig;
  stats: {
    discoveredToday: number;
    moroccoJobs: number;
    franceJobs: number;
    saudiJobs: number;
    ukJobs: number;
    highScore: number;
    newJobs: number;
    statusCounts: Record<string, number>;
  };
  quota: {
    morocco: { used: number; limit: number };
    france: { used: number; limit: number };
    saudi: { used: number; limit: number };
    uk: { used: number; limit: number };
  };
  spend: {
    monthUsd: number;
    budgetLimitUsd: number;
    budgetUsd: number;
    byCountry: { country: string; results: number; newJobs: number; usd: number }[];
  };
  runs: RunSummary[];
  todayKey: string;
}
