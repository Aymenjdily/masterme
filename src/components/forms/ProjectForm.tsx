"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "@/lib/query-keys";
import { VERCEL_PLAN_MONTHLY_USD } from "@/lib/hosting";
import type { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { selectClassName } from "@/components/forms/MonthlyCostForm";

// Blank optional fields are allowed here and sent as "not set" (the API's url() rejects "").
const formSchema = z.object({
  title: z.string().trim().min(1, "Give the project a title"),
  type: z.enum(["client", "personal", "saas"]),
  status: z.enum(["active", "paused", "completed"]),
  clientName: z.string(),
  url: z.union([z.literal(""), z.string().trim().url("Enter a full link starting with https://")]),
  description: z.string(),
  neonProjectId: z.string(),
  vercelHosting: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const TYPE_OPTIONS = [
  { value: "client" as const, label: "Client" },
  { value: "personal" as const, label: "Personal" },
  { value: "saas" as const, label: "SaaS" },
];

const STATUS_OPTIONS = [
  { value: "active" as const, label: "Active", dotClassName: "bg-success" },
  { value: "paused" as const, label: "Paused", dotClassName: "bg-stone" },
  { value: "completed" as const, label: "Done", dotClassName: "bg-muted-foreground" },
];

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

async function fetchNeonProjects(): Promise<{ projects: { id: string; name: string; estimateUsd: number | null }[] }> {
  const res = await fetch("/api/neon/projects");
  if (!res.ok) throw new Error("Failed to load Neon projects");
  return res.json();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t pt-4 font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:col-span-2">
      {children}
    </p>
  );
}

export function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: project?.title ?? "",
      type: project?.type ?? "personal",
      status: project?.status ?? "active",
      clientName: project?.clientName ?? "",
      url: project?.url ?? "",
      description: project?.description ?? "",
      neonProjectId: project?.neonProjectId ?? "",
      vercelHosting: project?.vercelHosting ?? false,
    },
  });
  const type = useWatch({ control, name: "type" });

  const { data: neonData } = useQuery({
    queryKey: ["neon-projects"],
    queryFn: fetchNeonProjects,
    staleTime: 5 * 60 * 1000,
  });
  const neonProjects = neonData?.projects ?? [];

  // First income (new projects only) becomes billing records after the project is created.
  const [buildCost, setBuildCost] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [currency, setCurrency] = useState("MAD");

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        title: values.title.trim(),
        type: values.type,
        status: values.status,
        clientName: values.type === "client" ? values.clientName.trim() || undefined : undefined,
        url: values.url.trim() || undefined,
        description: values.description.trim() || undefined,
        neonProjectId: values.neonProjectId || null,
        vercelHosting: values.vercelHosting,
      };
      const saved = project
        ? await send(`/api/projects/${project.id}`, "PATCH", { ...body, refreshPreview: !project.previewImageUrl })
        : await send("/api/projects", "POST", body);

      if (!project) {
        const oneTime = Number(buildCost);
        const monthly = Number(monthlyRevenue);
        if (oneTime > 0) {
          await send(`/api/projects/${saved.id}/billing`, "POST", { billingType: "one_time", amount: oneTime, currency });
        }
        if (monthly > 0) {
          await send(`/api/projects/${saved.id}/billing`, "POST", { billingType: "monthly", amount: monthly, currency });
        }
      }
      return saved;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.appsSummary });
    },
    onSuccess: () => onDone(),
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="grid grid-cols-1 gap-4.5 px-6 pb-6 sm:grid-cols-2">
        <Field className={type === "client" ? "" : "sm:col-span-2"}>
          <FieldLabel htmlFor="project-title">Title</FieldLabel>
          <Input id="project-title" placeholder="Atlas CRM" autoFocus {...register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        {type === "client" && (
          <Field>
            <FieldLabel htmlFor="project-client">Client name</FieldLabel>
            <Input id="project-client" placeholder="Atlas Digital" {...register("clientName")} />
          </Field>
        )}
        <Field>
          <FieldLabel>Type</FieldLabel>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SegmentedControl label="Project type" value={field.value} onChange={field.onChange} options={TYPE_OPTIONS} />
            )}
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl label="Project status" value={field.value} onChange={field.onChange} options={STATUS_OPTIONS} />
            )}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="project-url">
            Live URL <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="project-url" type="url" placeholder="https://…" {...register("url")} />
          <FieldError errors={[errors.url]} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="project-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="project-description" placeholder="What it is, for whom" {...register("description")} />
        </Field>

        <SectionLabel>Hosting</SectionLabel>
        <Field>
          <FieldLabel htmlFor="project-neon">
            Neon project <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <select id="project-neon" className={`${selectClassName} font-mono`} {...register("neonProjectId")}>
            <option value="">Not linked</option>
            {neonProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.estimateUsd !== null ? `${p.name} · ~$${p.estimateUsd.toFixed(2)} this month` : p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field orientation="horizontal" className="items-center self-end sm:h-10">
          <Controller
            control={control}
            name="vercelHosting"
            render={({ field }) => (
              <Checkbox id="project-vercel" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <FieldLabel htmlFor="project-vercel" className="font-normal">
            <span>
              Hosted on Vercel{" "}
              <span className="text-muted-foreground">(shared ${VERCEL_PLAN_MONTHLY_USD}/mo plan)</span>
            </span>
          </FieldLabel>
        </Field>

        {!project && (
          <>
            <SectionLabel>
              First income <span className="font-sans tracking-normal normal-case">(optional)</span>
            </SectionLabel>
            <div className="grid grid-cols-[1fr_1fr_96px] gap-2.5 sm:col-span-2">
              <Field>
                <FieldLabel htmlFor="project-build">Build cost</FieldLabel>
                <Input
                  id="project-build"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  className="font-mono"
                  value={buildCost}
                  onChange={(e) => setBuildCost(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-monthly">Monthly revenue</FieldLabel>
                <Input
                  id="project-monthly"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  className="font-mono"
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-currency">Currency</FieldLabel>
                <select
                  id="project-currency"
                  className={`${selectClassName} font-mono`}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["MAD", "USD", "EUR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">Something went wrong. Please try again.</p>
      )}
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
