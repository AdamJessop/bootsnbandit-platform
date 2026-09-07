/**
 * Collapse duplicate customer records before the unique email/phone indexes
 * land (Phase 1 of the enquiries omnichannel work).
 *
 * Usage:
 *   npm run customers:merge -- --dry-run    # report only, writes nothing
 *   npm run customers:merge                 # merge for real
 *
 * Idempotent: a second run finds no groups and re-normalises nothing. Run it
 * AFTER the enquiry_threads migration and BEFORE customer_contact_unique.
 */
import { prisma } from "@bnb/core/db";
import { mergeDuplicateCustomers } from "@bnb/core/services/customer-merge";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("Dry run — no changes will be written.\n");
  const report = await mergeDuplicateCustomers({ dryRun });
  console.log(
    `\nDone. scanned=${report.scanned} groups=${report.groups} merged=${report.merged} renormalised=${report.renormalised}${
      report.dryRun ? " (dry run)" : ""
    }`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
