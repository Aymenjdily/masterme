import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Manual playground: classify any text you pass in and extract its fields.
// Usage: npm run ai:try -- "Hi, I'm Sara from Capgemini..."
// Rows are kept in AiEvent (feature "playground") so you can inspect them in Prisma Studio.

async function main() {
  const text = process.argv.slice(2).join(" ").trim();
  if (!text) throw new Error('Pass some text: npm run ai:try -- "your text here"');

  const { z } = await import("zod");
  const { prisma } = await import("@/lib/prisma");
  const { decide, choice, score } = await import("@/lib/ai/decisions");
  const { generateObject } = await import("@/lib/ai/openai");
  const { gate } = await import("@/lib/ai/confidence");

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("No user in the database.");

  const decision = await decide({
    userId: user.id,
    feature: "playground",
    state: `Pasted text: ${text}`,
    questions: {
      kind: choice("What kind of item is this?", ["job_offer", "recruiter_contact", "learning_resource", "tech_news", "other"]),
      urgency: score("How urgent is acting on it?", 5, { 1: "can wait weeks", 5: "today" }),
    },
  });

  const { kind, urgency } = decision.answers;
  console.log(`\nKind:     ${kind.choice}`);
  for (const [option, p] of Object.entries(kind.probabilities)) {
    console.log(`          ${option.padEnd(18)} ${(p * 100).toFixed(1)}%`);
  }
  console.log(`Urgency:  ${urgency.score}/5 (${(urgency.confidence * 100).toFixed(1)}% sure)`);
  console.log(`Gate:     ${gate(decision.confidence)}  (overall confidence ${(decision.confidence * 100).toFixed(1)}%)`);

  const { data } = await generateObject({
    userId: user.id,
    feature: "playground",
    name: "fields",
    schema: z.object({
      title: z.string().describe("short title for this item"),
      person: z.string().nullable(),
      company: z.string().nullable(),
      email: z.string().nullable(),
      url: z.string().nullable(),
    }),
    system: "Extract the fields from the text. Use null when a field is not present. Never invent values.",
    prompt: text,
  });
  console.log("\nExtracted:", data);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
