const crypto = require("crypto");

const HASH_PREFIX = "pbkdf2_sha256";
const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `${HASH_PREFIX}$${ITERATIONS}$${salt}$${hash}`;
};

const isHashedPassword = (value) => String(value || "").startsWith(`${HASH_PREFIX}$`);

const verifyPassword = (password, storedPassword) => {
  const stored = String(storedPassword || "");
  if (!isHashedPassword(stored)) return stored === String(password);

  const [, iterations, salt, expectedHash] = stored.split("$");
  if (!iterations || !salt || !expectedHash) return false;

  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), KEY_LENGTH, DIGEST)
    .toString("base64url");

  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

module.exports = { hashPassword, isHashedPassword, verifyPassword };
