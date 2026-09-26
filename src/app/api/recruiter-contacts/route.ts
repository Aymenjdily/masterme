import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recruiterContactSchema } from "@/lib/validations";
import { isDueForFollowUp } from "@/lib/follow-up";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await prisma.recruiterContact.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const withDueFlag = contacts.map((contact) => ({
    ...contact,
    // Ended conversations never come due.
    dueForFollowUp: !contact.endedAt && contact.lastContactedAt ? isDueForFollowUp(contact.lastContactedAt) : false,
  }));

  return Response.json(withDueFlag);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = recruiterContactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const contact = await prisma.recruiterContact.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  return Response.json(contact, { status: 201 });
}
