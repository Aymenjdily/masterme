"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ai/Toast";
import type { JobRadarOverview } from "@/types";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

/** Compact editor for the collection profile quotas, budget and matching. */
export function JobRadarSettings({ overview }: { overview: JobRadarOverview }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dailyQuotaMorocco: String(overview.config.dailyQuotaMorocco),
    dailyQuotaFrance: String(overview.config.dailyQuotaFrance),
    dailyQuotaSaudi: String(overview.config.dailyQuotaSaudi),
    dailyQuotaUk: String(overview.config.dailyQuotaUk),
    monthlyBudgetUsd: String(overview.config.monthlyBudgetUsd),
    budgetMarginPct: String(overview.config.budgetMarginPct),
    matchThreshold: String(overview.config.matchThreshold),
    profileTitle: overview.config.profileTitle,
    yearsExperience: String(overview.config.yearsExperience),
    titleKeywords: overview.config.titleKeywords.join(", "),
    employmentTypes: overview.config.employmentTypes.join(", "),
    collectEnabled: overview.config.collectEnabled,
  });

  const mutation = useMutation({
    mutationFn: () =>
      send("/api/jobradar/config", "PATCH", {
        dailyQuotaMorocco: Number(form.dailyQuotaMorocco),
        dailyQuotaFrance: Number(form.dailyQuotaFrance),
        dailyQuotaSaudi: Number(form.dailyQuotaSaudi),
        dailyQuotaUk: Number(form.dailyQuotaUk),
        monthlyBudgetUsd: Number(form.monthlyBudgetUsd),
        budgetMarginPct: Number(form.budgetMarginPct),
        matchThreshold: Number(form.matchThreshold),
        profileTitle: form.profileTitle,
        yearsExperience: Number(form.yearsExperience),
        titleKeywords: splitList(form.titleKeywords),
        employmentTypes: splitList(form.employmentTypes).map((s) => s.toLowerCase()),
        collectEnabled: form.collectEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRadarOverview });
      showToast({ title: "Saved", detail: "JobRadar settings updated." });
    },
    onError: () => {
      showToast({ title: "Invalid values", detail: "Check the numbers and try again." });
    },
  });

  const num = (key: keyof typeof form) =>
    setForm((f) => ({ ...f, [key]: Number.isNaN(Number(f[key] as string)) ? "0" : String(f[key]) }));

  return (
    <Card className="mt-3.5 gap-4 rounded-[20px] p-4.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[0.9375rem] font-medium">Collection</h3>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {form.collectEnabled
              ? "The collector runs on schedule while the budget allows."
              : "Paused — existing jobs stay available, nothing new is collected."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setForm((f) => ({ ...f, collectEnabled: !f.collectEnabled }))}
        >
          {form.collectEnabled ? "Pause" : "Resume"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Field label="Morocco results / day">
          <Input
            value={form.dailyQuotaMorocco}
            onChange={(e) => setForm((f) => ({ ...f, dailyQuotaMorocco: e.target.value }))}
            onBlur={() => num("dailyQuotaMorocco")}
            inputMode="numeric"
          />
        </Field>
        <Field label="France results / day">
          <Input
            value={form.dailyQuotaFrance}
            onChange={(e) => setForm((f) => ({ ...f, dailyQuotaFrance: e.target.value }))}
            onBlur={() => num("dailyQuotaFrance")}
            inputMode="numeric"
          />
        </Field>
        <Field label="Saudi Arabia results / day">
          <Input
            value={form.dailyQuotaSaudi}
            onChange={(e) => setForm((f) => ({ ...f, dailyQuotaSaudi: e.target.value }))}
            onBlur={() => num("dailyQuotaSaudi")}
            inputMode="numeric"
          />
        </Field>
        <Field label="UK results / day">
          <Input
            value={form.dailyQuotaUk}
            onChange={(e) => setForm((f) => ({ ...f, dailyQuotaUk: e.target.value }))}
            onBlur={() => num("dailyQuotaUk")}
            inputMode="numeric"
          />
        </Field>
        <Field label="Monthly budget (USD)">
          <Input
            value={form.monthlyBudgetUsd}
            onChange={(e) => setForm((f) => ({ ...f, monthlyBudgetUsd: e.target.value }))}
            onBlur={() => num("monthlyBudgetUsd")}
            inputMode="decimal"
          />
        </Field>
        <Field label="Budget margin (%)">
          <Input
            value={form.budgetMarginPct}
            onChange={(e) => setForm((f) => ({ ...f, budgetMarginPct: e.target.value }))}
            onBlur={() => num("budgetMarginPct")}
            inputMode="numeric"
          />
        </Field>
        <Field label="Notify from score ≥">
          <Input
            value={form.matchThreshold}
            onChange={(e) => setForm((f) => ({ ...f, matchThreshold: e.target.value }))}
            onBlur={() => num("matchThreshold")}
            inputMode="numeric"
          />
        </Field>
        <Field label="Years of experience">
          <Input
            value={form.yearsExperience}
            onChange={(e) => setForm((f) => ({ ...f, yearsExperience: e.target.value }))}
            onBlur={() => num("yearsExperience")}
            inputMode="numeric"
          />
        </Field>
        <Field label="Profile title" className="col-span-2 lg:col-span-1">
          <Input
            value={form.profileTitle}
            onChange={(e) => setForm((f) => ({ ...f, profileTitle: e.target.value }))}
          />
        </Field>
        <Field label="Title keywords (comma separated)" className="lg:col-span-2">
          <Input
            value={form.titleKeywords}
            onChange={(e) => setForm((f) => ({ ...f, titleKeywords: e.target.value }))}
          />
        </Field>
        <Field label="Employment types (comma separated)" className="lg:col-span-3">
          <Input
            value={form.employmentTypes}
            onChange={(e) => setForm((f) => ({ ...f, employmentTypes: e.target.value }))}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Skills used for matching come from Settings → Skills. Changing the profile or
        weights does not rescore stored jobs — refresh with `npm run jobradar:score`.
      </p>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
