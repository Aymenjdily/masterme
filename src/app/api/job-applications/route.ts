import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobApplicationCreateSchema, manualApplicationSchema } from "@/lib/validations";
import { isDueForFollowUp } from "@/lib/follow-up";

const OPEN_STATUSES = new Set(["applied", "interviewing"]);

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await prisma.jobApplication.findMany({
    where: { userId: session.user.id },
    include: { jobOffer: true },
    orderBy: { applicationDate: "desc" },
  });

  const withDueFlag = applications.map((application) => ({
    ...application,
    dueForFollowUp:
      OPEN_STATUSES.has(application.status ?? "applied") &&
      isDueForFollowUp(application.lastFollowUpAt ?? application.applicationDate),
  }));

  return Response.json(withDueFlag);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Manual entry: { company, title, url?, appliedOn? } — not tied to a scraped offer.
  if ("company" in body || "title" in body) {
    const parsed = manualApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { company, title, url, appliedOn } = parsed.data;
    const applicationDate = appliedOn ? new Date(appliedOn) : new Date();

    const jobOffer = await prisma.jobOffer.create({
      data: {
        userId: session.user.id,
        title,
        company,
        source: "manual",
        url: url ?? `manual://${crypto.randomUUID()}`,
        status: "applied",
      },
    });

    const application = await prisma.jobApplication.create({
      data: {
        userId: session.user.id,
        jobOfferId: jobOffer.id,
        applicationDate,
        lastFollowUpAt: applicationDate,
        status: "applied",
      },
      include: { jobOffer: true },
    });

    return Response.json(application, { status: 201 });
  }

  // Apply flow: { jobOfferId } — from an existing (scraped) JobOffer.
  const parsed = jobApplicationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const jobOffer = await prisma.jobOffer.findFirst({
    where: { id: parsed.data.jobOfferId, userId: session.user.id },
  });
  if (!jobOffer) {
    return Response.json({ error: "Job offer not found" }, { status: 404 });
  }

  const now = new Date();
  const [, application] = await prisma.$transaction([
    prisma.jobOffer.update({
      where: { id: jobOffer.id },
      data: { status: "applied" },
    }),
    prisma.jobApplication.create({
      data: {
        userId: session.user.id,
        jobOfferId: jobOffer.id,
        applicationDate: now,
        lastFollowUpAt: now,
        status: "applied",
      },
      include: { jobOffer: true },
    }),
  ]);

  return Response.json(application, { status: 201 });
}
