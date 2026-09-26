import { Briefcase, Link2, Radar, Route, UserRound, type LucideIcon } from "lucide-react";
import { z } from "zod";
import type { PasteKind } from "@/lib/ai/paste-kinds";

export const KIND_META: Record<
  PasteKind,
  { label: string; short: string; hint: string; icon: LucideIcon; tone: string; href: string; hrefLabel: string }
> = {
  recruiter: {
    label: "Recruiter contact",
    short: "Recruiter",
    hint: "Someone reaching out, with their contact details.",
    icon: UserRound,
    tone: "bg-info/12 text-info-strong",
    href: "/jobs",
    hrefLabel: "Open in Jobs",
  },
  application: {
    label: "Application",
    short: "Application",
    hint: "Track it as a job you're applying to.",
    icon: Briefcase,
    tone: "bg-warning/15 text-warning-strong",
    href: "/jobs",
    hrefLabel: "Open in Jobs",
  },
  learning: {
    label: "Learning step",
    short: "Learning step",
    hint: "Add it to one of your learning paths.",
    icon: Route,
    tone: "bg-success/15 text-success-strong",
    href: "/learning",
    hrefLabel: "Open in Learning",
  },
  radar: {
    label: "Radar item",
    short: "Radar item",
    hint: "Save it to read later in Tech News.",
    icon: Radar,
    tone: "bg-special/12 text-special-strong",
    href: "/news",
    hrefLabel: "Open in Tech News",
  },
  portfolio: {
    label: "Portfolio link",
    short: "Portfolio link",
    hint: "Add it to your links hub.",
    icon: Link2,
    tone: "bg-stone/45 text-stone-strong",
    href: "/portfolio",
    hrefLabel: "Open in Portfolio",
  },
};

export type FieldDef = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "email" | "url" | "tel" | "date" | "textarea";
  full?: boolean;
  mono?: boolean;
};

/** Visible form fields per kind. Recruiter also has a follow-up select and the "also add an application" row. */
export const KIND_FIELDS: Record<PasteKind, FieldDef[]> = {
  recruiter: [
    { key: "name", label: "Name", placeholder: "Salma B." },
    { key: "company", label: "Company", placeholder: "Talentia" },
    { key: "email", label: "Email", placeholder: "name@company.com", type: "email" },
    { key: "phone", label: "Phone", placeholder: "+212 6…", type: "tel" },
    { key: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/…", type: "url" },
    { key: "notes", label: "Notes", placeholder: "What they want…", type: "textarea", full: true },
  ],
  application: [
    { key: "title", label: "Job title", placeholder: "Full-stack Engineer" },
    { key: "company", label: "Company", placeholder: "OCP Group" },
    { key: "url", label: "Job link", placeholder: "https://…", type: "url", full: true },
    { key: "appliedOn", label: "Applied on", placeholder: "", type: "date" },
  ],
  learning: [
    { key: "title", label: "Title", placeholder: "Docker Compose for production", full: true },
    { key: "resourceUrl", label: "Resource link", placeholder: "https://…", type: "url", full: true },
    { key: "description", label: "Description", placeholder: "What it covers…", type: "textarea", full: true },
  ],
  radar: [
    { key: "title", label: "Title", placeholder: "What it is", full: true },
    { key: "url", label: "Link", placeholder: "https://…", type: "url", full: true },
    { key: "description", label: "Summary", placeholder: "One sentence…", type: "textarea", full: true },
  ],
  portfolio: [
    { key: "title", label: "Title", placeholder: "Portfolio" },
    { key: "url", label: "Link", placeholder: "https://…", type: "url" },
  ],
};

const required = (message: string) => z.string().trim().min(1, message);
const url = z.string().trim().url("Enter a full link starting with https://");
const optionalUrl = z.union([z.literal(""), url]);

/** Client-side checks before saving (the API validates again). */
export const KIND_VALIDATION: Record<PasteKind, z.ZodObject> = {
  recruiter: z.object({
    name: required("Enter a name"),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    linkedinUrl: optionalUrl,
  }),
  application: z.object({ title: required("Enter the job title"), company: required("Enter the company"), url: optionalUrl }),
  learning: z.object({ title: required("Enter a title"), resourceUrl: optionalUrl, _path: required("Pick a path") }),
  radar: z.object({ title: required("Enter a title"), url }),
  portfolio: z.object({ title: required("Enter a title"), url }),
};

export const SAVE_LABEL: Record<PasteKind, string> = {
  recruiter: "Save recruiter",
  application: "Save application",
  learning: "Add step",
  radar: "Save to radar",
  portfolio: "Add link",
};

/** Adds https:// to bare domains the AI copied from the text ("careers.acme.com/job"). */
export function normalizeUrl(value: string) {
  const v = value.trim();
  if (!v || /^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) ? `https://${v}` : v;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
