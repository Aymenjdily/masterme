import { z } from "zod";

export const portfolioLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  icon: z.string().optional(),
  order: z.number().optional(),
});

export const socialAppSchema = z.object({
  platform: z.string().min(1),
  username: z.string().min(1),
  url: z.string().url(),
  icon: z.string().optional(),
});

export const learningPathStatus = z.enum(["active", "completed", "paused"]);
export const learningItemStatus = z.enum(["not_started", "in_progress", "completed"]);

// Update schemas have no defaults: zod 4 applies defaults inside .partial(),
// which would silently reset status on a title-only PATCH.
export const learningPathUpdateSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().nullable(),
    status: learningPathStatus,
  })
  .partial();

export const learningPathSchema = learningPathUpdateSchema.required({ title: true }).extend({
  status: learningPathStatus.default("active"),
});

export const learningItemUpdateSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().nullable(),
    resourceUrl: z.string().url().nullable(),
    status: learningItemStatus,
  })
  .partial();

export const learningItemSchema = learningItemUpdateSchema.required({ title: true }).extend({
  status: learningItemStatus.default("not_started"),
});

export const timelineSchema = z.object({
  date: z.string(),
});

export const wakeUpHourSchema = z.object({
  date: z.string(),
  wakeUpHour: z.number().int().min(0).max(23),
});

export const timeBlockSchema = z.object({
  hour: z.number().min(0).max(7),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["planned", "in_progress", "completed"]).default("planned"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  /** The #todo note this block comes from */
  noteId: z.string().min(1).max(64).optional(),
});

// Used for PATCH: no `.default()`, so omitted fields stay omitted
// instead of silently overwriting existing values with a default.
export const timeBlockUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["planned", "in_progress", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const jobOfferSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  source: z.enum(["linkedin", "linkedin-apify", "indeed", "manual"]),
  url: z.string().url(),
  description: z.string().optional(),
  salary: z.string().optional(),
  postedDate: z.string().optional(),
  // "accepted" kept for legacy rows; "offer" is the JobRadar equivalent
  status: z
    .enum([
      "new",
      "interested",
      "to_apply",
      "applied",
      "interviewing",
      "rejected",
      "accepted",
      "offer",
      "archived",
      "not_interested",
    ])
    .default("new"),
  recruiterName: z.string().optional(),
  recruiterEmail: z.string().optional(),
  recruiterPhone: z.string().optional(),
});

export const jobApplicationSchema = z.object({
  jobOfferId: z.string(),
  applicationDate: z.string(),
  coverLetter: z.string().optional(),
  resumeVersion: z.string().optional(),
  status: z.string().optional(),
  followUpNotes: z.string().optional(),
});

// Used when applying from a scraped JobOffer: applicationDate/status are set server-side.
export const jobApplicationCreateSchema = z.object({
  jobOfferId: z.string(),
});

// Used when the user manually logs an application not tied to a scraped offer.
export const manualApplicationSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  appliedOn: z.string().optional(),
});

export const jobApplicationUpdateSchema = z.object({
  status: z.string().optional(),
  followUpNotes: z.string().optional(),
  markFollowedUp: z.boolean().optional(),
  // Undo of "mark followed up": puts the previous date back.
  restoreFollowUpAt: z.iso.datetime().nullable().optional(),
});

export const jobOfferStatusSchema = z.object({
  status: z.enum([
    "new",
    "interested",
    "to_apply",
    "applied",
    "interviewing",
    "rejected",
    "accepted",
    "offer",
    "archived",
    "not_interested",
  ]),
});

export const userSkillsSchema = z.object({
  skills: z.array(z.string().min(1)),
});

export const recruiterContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export const END_REASONS = ["offer", "application", "passed", "not_interested", "no_reply", "other"] as const;
export type EndReason = (typeof END_REASONS)[number];

export const recruiterContactUpdateSchema = recruiterContactSchema.partial().extend({
  markContacted: z.boolean().optional(),
  // Undo of "mark contacted": puts the previous date back.
  restoreContactedAt: z.iso.datetime().nullable().optional(),
  // End the conversation: reminders stop until it's reopened.
  end: z.object({ reason: z.enum(END_REASONS), note: z.string().trim().max(300).optional() }).optional(),
  // Reopen: clears the end and restarts the 3-day reminder from now.
  reopen: z.boolean().optional(),
  // Undo of end / reopen: puts the previous values back.
  restoreEnd: z
    .object({
      endedAt: z.iso.datetime().nullable(),
      endReason: z.enum(END_REASONS).nullable(),
      endNote: z.string().max(300).nullable(),
      lastContactedAt: z.iso.datetime().nullable(),
    })
    .optional(),
});

export const projectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["client", "personal", "saas"]),
  status: z.enum(["active", "completed", "paused"]).default("active"),
  clientName: z.string().optional(),
  url: z.string().url().optional(),
  neonProjectId: z.string().nullable().optional(),
  vercelHosting: z.boolean().optional().default(false),
  // The name is looked up on the server; only the id comes from the form.
  vercelProjectId: z.string().nullable().optional(),
});

// Used for PATCH: no `.default()`, so omitted fields stay omitted.
export const projectUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(["client", "personal", "saas"]).optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
  clientName: z.string().optional(),
  url: z.string().url().optional(),
  neonProjectId: z.string().nullable().optional(),
  vercelHosting: z.boolean().optional(),
  vercelProjectId: z.string().nullable().optional(),
  // Re-fetch the preview image even when the URL didn't change.
  refreshPreview: z.boolean().optional(),
});

export const projectBillingSchema = z.object({
  projectId: z.string(),
  billingType: z.enum(["one_time", "monthly"]),
  amount: z.number().positive(),
  currency: z.string().default("MAD"),
  description: z.string().optional(),
  invoiceDate: z.string().optional(),
});

// Used for PATCH: no `.default()`, so omitted fields stay omitted.
export const projectBillingUpdateSchema = z.object({
  billingType: z.enum(["one_time", "monthly"]).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  invoiceDate: z.string().optional(),
});

export const techNewsSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  source: z.string(),
  description: z.string().optional(),
  publishedDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const monthlyCostSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["app", "home", "other"]).default("app"),
  amount: z.number().positive(),
  currency: z.string().default("MAD"),
  notes: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

// Used for PATCH: no `.default()`, so omitted fields stay omitted.
export const monthlyCostUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["app", "home", "other"]).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().nullable().optional(),
});

export const NOTE_BODY_MAX = 20_000;
export const NOTE_TAGS_MAX = 5;

export const noteTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,24}$/, "Tags use a–z, 0–9 and -, up to 24 characters");

export const noteSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(NOTE_BODY_MAX).optional(),
  tags: z
    .array(noteTagSchema)
    .max(NOTE_TAGS_MAX)
    .transform((tags) => [...new Set(tags)])
    .optional(),
  pinned: z.boolean().optional(),
});
