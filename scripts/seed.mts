/**
 * Applies the schema and MSID's first-run content, and creates the first administrator.
 *
 *   npm run seed
 *
 * On a serverless host this is usually unnecessary — the application seeds itself the
 * first time it connects, because Vercel has no entrypoint to run a script from and
 * `vercel env pull` cannot retrieve encrypted values to seed remotely. The script stays
 * useful for a local database, for a container, and for re-running the seed on purpose.
 *
 * Everything it does is idempotent, and nothing in it is invented: the content is
 * MSID's own published wording, founding date, contact details and the partner
 * organisations they link to. Board members, guidelines, congress dates and
 * publications are deliberately left empty for MSID to supply.
 */

import { db, runTransaction } from "../src/lib/db/index.ts";
import { seedDatabase } from "../src/lib/db/seed-data.ts";

const client = await db();

// Connecting already seeds, so this second pass normally reports nothing left to do —
// which is exactly what an idempotent seed should say.
const result = await runTransaction(client, (tx) => seedDatabase(tx));

console.log(
  result.seededContent
    ? "Seeded first-run content."
    : "Content already present — nothing to add.",
);

if (result.createdAdmin) {
  console.log(`Administrator created: ${result.createdAdmin}`);
  console.log("Sign in at /mn/admin and change the password.");
} else {
  console.log("Administrator already exists — left unchanged.");
}
