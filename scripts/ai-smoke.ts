import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Runs one decision (choice + score + noul) and one structured generation against the real APIs,
// checks that both wrote AiEvent rows, then removes those rows. Usage: npm run ai:smoke

async function main() {
  const { z } = await import("zod");
  const { prisma } = await import("@/lib/prisma");
  const { decide, choice, score, noul } = await import("@/lib/ai/decisions");
  const { generateObject } = await import("@/lib/ai/openai");
  const { gate } = await import("@/lib/ai/confidence");

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("No user in the database. Run the seed first.");
  const feature = "smoke-test";

  const decision = await decide({
    userId: user.id,
    feature,
    state: "Pasted text: 'Hi Aymen, I'm Sara from Capgemini Casablanca. Are you open to a React role? Reach me at sara@example.com.'",
    questions: {
      kind: choice("What kind of item is this?", ["job_offer", "recruiter_contact", "learning_resource", "tech_news"], {
        recruiter_contact: "a person reaching out, with contact details",
      }),
      urgency: score("How urgent is a reply?", 5, { 1: "can wait weeks", 5: "reply today" }),
      hasEmail: noul("Does the text contain an email address?"),
    },
    summary: { note: "smoke test decision" },
  });

  console.log("decision:", JSON.stringify(decision.answers, null, 2));
  console.log(`confidence ${decision.confidence.toFixed(3)} → gate: ${gate(decision.confidence)}`);

  const generation = await generateObject({
    userId: user.id,
    feature,
    name: "contact",
    schema: z.object({ name: z.string(), company: z.string(), email: z.string() }),
    system: "Extract the recruiter's details from the text.",
    prompt: "Hi Aymen, I'm Sara from Capgemini Casablanca. Are you open to a React role? Reach me at sara@example.com.",
    summary: { note: "smoke test generation" },
  });
  console.log("generation:", generation.data);

  const events = await prisma.aiEvent.findMany({
    where: { userId: user.id, feature },
    select: { kind: true, provider: true, model: true, latencyMs: true, inputTokens: true, outputTokens: true, costUsd: true, confidence: true },
  });
  console.table(events);

  const removed = await prisma.aiEvent.deleteMany({ where: { userId: user.id, feature } });
  console.log(`AiEvent rows written: ${events.length} (removed ${removed.count} smoke-test rows)`);
  if (events.length !== 2) throw new Error("Expected 2 AiEvent rows");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
