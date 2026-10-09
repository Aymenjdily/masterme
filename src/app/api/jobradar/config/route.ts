import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    dailyQuotaMorocco: z.number().int().min(0).max(1000),
    dailyQuotaFrance: z.number().int().min(0).max(1000),
    dailyQuotaSaudi: z.number().int().min(0).max(1000),
    dailyQuotaUk: z.number().int().min(0).max(1000),
    monthlyBudgetUsd: z.number().min(0).max(500),
    budgetMarginPct: z.number().int().min(0).max(90),
    matchThreshold: z.number().int().min(0).max(100),
    collectEnabled: z.boolean(),
    profileTitle: z.string().trim().min(1).max(120),
    yearsExperience: z.number().int().min(0).max(40),
    employmentTypes: z.array(z.string().trim().min(1)),
    titleKeywords: z.array(z.string().trim().min(1)),
  })
  .partial();

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.jobRadarConfig.findUnique({
    where: { userId: session.user.id },
  });
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(config);
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const config = await prisma.jobRadarConfig.update({
    where: { userId: session.user.id },
    data: parsed.data,
  });

  return Response.json(config);
}
