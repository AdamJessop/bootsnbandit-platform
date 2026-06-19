/**
 * Mint a one-time passkey-enrolment link for a seeded staff user.
 * Usage: npm run admin:link [email]   (default: the seeded OWNER)
 * Visit the printed URL in a browser to register your first passkey, then sign in.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "crypto";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const email = process.argv[2] || "adamjjessop@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No staff user with email ${email}. Run \`npm run db:seed\` first.`);
    process.exit(1);
  }
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.staffInvite.create({
    data: { token, email, role: user.role, userId: user.id, expiresAt },
  });
  console.log(`\nPasskey enrolment link for ${email} (${user.role}):\n`);
  console.log(`  ${origin}/sign-in?invite=${token}\n`);
  console.log("Open it in a browser, register a passkey, and you're in. Expires in 7 days.\n");
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
