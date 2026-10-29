import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const TTL_MS = 60 * 60 * 1000; // 1 hour

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Issues a single-use reset token and returns it raw (for the email link).
 * Only its hash is stored, and any older unused tokens for the user are
 * dropped, so only the newest link works.
 */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordResetToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS) },
    }),
  ]);
  return token;
}

/**
 * Sets the new password if the token is valid, unused and unexpired. Marking
 * it used is a conditional update, so two racing requests can't both succeed.
 * Bumping sessionVersion signs out every device — the point of a reset.
 * Returns the updated user, or null for a bad/expired/used token.
 */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = sha256(token);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  const password = await hashPassword(newPassword);
  return db.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    return tx.user.update({
      where: { id: record.userId },
      data: { password, sessionVersion: { increment: 1 } },
    });
  });
}
