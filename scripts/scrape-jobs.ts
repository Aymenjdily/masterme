import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const { scrapeAndSaveOffersForAllUsers } = await import("@/lib/job-matcher");
  const summaries = await scrapeAndSaveOffersForAllUsers();

  if (summaries.length === 0) {
    console.log("No users with skills configured. Add skills in Settings first.");
    return;
  }

  for (const summary of summaries) {
    console.log(
      `user ${summary.userId}: searched ${summary.skillsSearched} skill(s), found ${summary.offersFound} offer(s), saved ${summary.offersSaved} new`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
