import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Same as the daily cron (/api/infra/recalculate): stores today's Neon cost for every linked project.
async function main() {
  const { recalculateForAllUsers } = await import("@/lib/infra-cost");
  const { prisma } = await import("@/lib/prisma");
  const result = await recalculateForAllUsers();
  console.log(`updated ${result.updated} project(s)${result.failed.length ? `, failed: ${result.failed.join(", ")}` : ""}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
