/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getEncryptionKey(): Buffer {
  const secret = process.env.PLAID_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('Missing environment variable: PLAID_ENCRYPTION_SECRET');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptString(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptString(payload: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(payload, 'base64');

  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
