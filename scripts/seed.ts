import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const EMAIL = "admin@masterme.com";
const PASSWORD = "password123";
const NAME = "Admin";
const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

async function seed() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
    });

    if (response.status === 200) {
      console.log("User seeded successfully:");
      console.log("  Email:", EMAIL);
      console.log("  Password:", PASSWORD);
    } else if (response.status === 422) {
      console.log("User already exists:", EMAIL);
      console.log("Delete it first via scripts/clear-auth.ts");
    } else {
      const data = await response.json();
      console.error("Failed:", response.status, data);
    }
  } catch {
    console.error(`Could not reach dev server at ${BASE_URL}.`);
    console.error("Start it first with: npm run dev");
  }
}

seed();
