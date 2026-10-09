import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const { collectForAllUsers } = await import("@/lib/jobradar/collector");

  if (!process.env.APIFY_TOKEN) {
    console.error("APIFY_TOKEN is missing from .env.local — Apify collection will fail.");
  }

  const summaries = await collectForAllUsers();

  for (const summary of summaries) {
    console.log(
      `user ${summary.userId}: status=${summary.status}, retrieved=${summary.resultsRetrieved}, new=${summary.newJobs}, est=$${summary.apifyUsdEstimated.toFixed(2)}${summary.apifyUsdActual !== null ? `, actual=$${summary.apifyUsdActual.toFixed(2)}` : ", actual=unknown"}${summary.note ? ` — ${summary.note}` : ""}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
