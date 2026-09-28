import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, BCRYPT_ROUNDS);
}

export function verifyPassword(plainTextPassword, passwordHash) {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
