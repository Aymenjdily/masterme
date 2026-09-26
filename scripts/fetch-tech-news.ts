import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const { fetchAndSaveTechNewsForAllUsers } = await import("@/lib/tech-news");
  const summaries = await fetchAndSaveTechNewsForAllUsers();

  if (summaries.length === 0) {
    console.log("No users with skills configured. Add skills in Settings first.");
    return;
  }

  for (const summary of summaries) {
    console.log(
      `user ${summary.userId}: searched ${summary.skillsSearched} skill(s), found ${summary.itemsFound} item(s), saved ${summary.itemsSaved} new`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
