import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

// scrypt is deliberately memory-hard. These parameters follow the Node.js
// documentation's guidance for interactive logins and keep hashing under ~100ms
// on a typical laptop.
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "letmein1",
  "iloveyou",
  "admin123",
  "welcome1",
]);

function deriveKey(password: string, salt: Buffer, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password.normalize("NFKC"),
      salt,
      keyLength,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  try {
    const [scheme, n, r, p, saltValue, hashValue] = storedHash.split("$");
    if (scheme !== "scrypt" || !saltValue || !hashValue) return false;

    const cost = Number(n);
    const blockSize = Number(r);
    const parallelization = Number(p);
    if (
      !Number.isInteger(cost) ||
      !Number.isInteger(blockSize) ||
      !Number.isInteger(parallelization) ||
      cost < 2 ||
      blockSize < 1 ||
      parallelization < 1
    ) {
      return false;
    }

    const salt = Buffer.from(saltValue, "base64");
    const expected = Buffer.from(hashValue, "base64");
    if (salt.length === 0 || expected.length === 0) return false;

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scryptCallback(
        password.normalize("NFKC"),
        salt,
        expected.length,
        {
          N: cost,
          r: blockSize,
          p: parallelization,
          maxmem: MAX_MEMORY,
        },
        (error, key) => {
          if (error) reject(error);
          else resolve(key);
        }
      );
    });

    if (derivedKey.length !== expected.length) return false;
    return timingSafeEqual(derivedKey, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Verify against a real hash when the account exists, otherwise spend the same
 * amount of work on a dummy hash. This keeps failed logins from revealing which
 * email addresses have accounts through response timing.
 */
export async function verifyPasswordOrDummy(
  password: string,
  storedHash: string | null | undefined
) {
  if (storedHash) return verifyPassword(password, storedHash);
  dummyHash ??= hashPassword("not-a-real-account-password");
  await verifyPassword(password, await dummyHash);
  return false;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Use at least 8 characters for your password.";
  }
  if (password.length > 128) {
    return "Keep your password under 128 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Choose something more unique.";
  }
  return null;
}
