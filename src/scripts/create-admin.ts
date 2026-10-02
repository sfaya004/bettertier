/**
 * Create (or promote) an admin user.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' npm run create-admin
 *
 * If the user already exists it is promoted to admin and the password is updated.
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "../db";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !email.includes("@")) throw new Error("Set ADMIN_EMAIL to a valid email address.");
  if (password.length < 12) throw new Error("Set ADMIN_PASSWORD to at least 12 characters.");
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) {
    await db.update(schema.users).set({ role: "admin", passwordHash }).where(eq(schema.users.id, existing.id));
    console.log(`Updated ${email}: now an admin with the new password.`);
  } else {
    await db.insert(schema.users).values({ email, passwordHash, role: "admin" });
    console.log(`Created admin user ${email}.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
