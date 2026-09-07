/**
 * Collapse duplicate customer records before the unique email/phone indexes
 * land (Phase 1 of the enquiries omnichannel work).
 *
 * Usage:
 *   npm run customers:merge                 # DRY RUN — reports, writes nothing
 *   npm run customers:merge -- --apply      # performs the merge (irreversible)
 *
 * A dry run is the default on purpose: the merge deletes rows and cannot be
 * undone, so a mistyped or swallowed flag must never write. Anything other
 * than `--apply` / `--dry-run` / `--help` is rejected with exit code 2 before
 * the database is touched, and a run with any failure exits 1.
 *
 * Idempotent: a second run finds no groups and re-normalises nothing. Run it
 * AFTER the enquiry_threads migration and BEFORE customer_contact_unique.
 */
import { prisma } from "@bnb/core/db";
import { mergeDuplicateCustomers } from "@bnb/core/services/customer-merge";

const USAGE = `Usage:
  npm run customers:merge                 dry run — reports, writes nothing
  npm run customers:merge -- --apply      perform the merge (irreversible)

Note the "--": npm needs it to pass flags through to the script.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const unknown = args.filter((a) => a !== "--apply" && a !== "--dry-run");
  if (unknown.length) {
    console.error(`Unrecognised argument(s): ${unknown.join(" ")}\n\n${USAGE}`);
    return 2;
  }
  if (args.includes("--apply") && args.includes("--dry-run")) {
    console.error(`--apply and --dry-run contradict each other.\n\n${USAGE}`);
    return 2;
  }

  const dryRun = !args.includes("--apply");
  console.log(
    dryRun
      ? "DRY RUN — no writes. Re-run with `-- --apply` to perform the merge.\n"
      : "APPLYING — irreversible: duplicate customer rows will be deleted.\n",
  );

  const report = await mergeDuplicateCustomers({ dryRun });
  console.log(
    `\nDone. scanned=${report.scanned} groups=${report.groups} merged=${report.merged} renormalised=${report.renormalised} failed=${report.failed}${
      report.dryRun ? " (dry run)" : ""
    }`,
  );
  if (report.failed > 0) {
    console.error(
      `\n${report.failed} write(s) failed and were left untouched — see the FAILED lines above, then re-run.`,
    );
    return 1;
  }
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
