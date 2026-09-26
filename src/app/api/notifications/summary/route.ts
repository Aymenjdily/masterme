import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDueForFollowUp } from "@/lib/follow-up";

// Same open statuses as /api/job-applications so the header count matches the Jobs page.
const OPEN_STATUSES = ["applied", "interviewing"];

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [newOffers, openApplications, contactedRecruiters] = await Promise.all([
    prisma.jobOffer.count({ where: { userId, status: "new" } }),
    prisma.jobApplication.findMany({
      where: {
        userId,
        OR: [{ status: { in: OPEN_STATUSES } }, { status: null }],
      },
      select: { applicationDate: true, lastFollowUpAt: true },
    }),
    prisma.recruiterContact.findMany({
      where: { userId, lastContactedAt: { not: null }, endedAt: null },
      select: { lastContactedAt: true },
    }),
  ]);

  const applicationsDue = openApplications.filter((a) =>
    isDueForFollowUp(a.lastFollowUpAt ?? a.applicationDate)
  ).length;

  const contactsDue = contactedRecruiters.filter(
    (c) => c.lastContactedAt && isDueForFollowUp(c.lastContactedAt)
  ).length;

  return Response.json({ newOffers, applicationsDue, contactsDue });
}
