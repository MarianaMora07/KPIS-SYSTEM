import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getSecret(): string {
  const secret =
    process.env.DB_CONNECTION_SECRET ??
    process.env.AI_MASTER_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Configure DB_CONNECTION_SECRET, AI_MASTER_SECRET o SUPABASE_SERVICE_ROLE_KEY para cifrar contraseñas"
    );
  }
  return secret;
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "kpis-db-connections", 32);
}

export function encryptConnectionPassword(plain: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(getSecret());
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptConnectionPassword(
  encrypted: Buffer | string | null | undefined
): string | null {
  if (!encrypted) return null;
  let buf: Buffer;
  if (typeof encrypted === "string") {
    const hex = encrypted.startsWith("\\x") ? encrypted.slice(2) : encrypted;
    buf = Buffer.from(hex, encrypted.startsWith("\\x") ? "hex" : "base64");
  } else {
    buf = Buffer.from(encrypted);
  }
  if (buf.length < IV_LENGTH + 16 + 1) return null;
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = buf.subarray(IV_LENGTH + 16);
  const key = deriveKey(getSecret());
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
