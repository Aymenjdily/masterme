"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  JobApplication,
  LearningPath,
  MonthlyCost,
  PortfolioLink,
  Project,
  RecruiterContact,
  SocialApp,
  TechNews,
  Timeline,
} from "@/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return res.json();
}

// Same query keys as each module's page, so the dashboard shares their cache.
export const useTimeline = (date: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.timeline(date),
    queryFn: () => getJson<{ timeline: Timeline | null }>(`/api/timeline?date=${date}`),
    enabled,
  });

export const useApplications = () =>
  useQuery({ queryKey: queryKeys.jobApplications, queryFn: () => getJson<JobApplication[]>("/api/job-applications") });

export const useRecruiters = () =>
  useQuery({ queryKey: queryKeys.recruiterContacts, queryFn: () => getJson<RecruiterContact[]>("/api/recruiter-contacts") });

export const useLearningPaths = () =>
  useQuery({ queryKey: queryKeys.learningPaths, queryFn: () => getJson<LearningPath[]>("/api/learning-paths") });

export const useProjects = () =>
  useQuery({ queryKey: queryKeys.projects, queryFn: () => getJson<Project[]>("/api/projects") });

export const useMonthlyCosts = () =>
  useQuery({ queryKey: queryKeys.monthlyCosts, queryFn: () => getJson<MonthlyCost[]>("/api/monthly-costs") });

export const useTechNews = () =>
  useQuery({ queryKey: queryKeys.techNews, queryFn: () => getJson<TechNews[]>("/api/tech-news") });

export const usePortfolioLinks = () =>
  useQuery({ queryKey: queryKeys.portfolioLinks, queryFn: () => getJson<PortfolioLink[]>("/api/portfolio-links") });

export const useSocialApps = () =>
  useQuery({ queryKey: queryKeys.socialApps, queryFn: () => getJson<SocialApp[]>("/api/social-apps") });
