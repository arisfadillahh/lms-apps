'use server';

import { compare, hash } from 'bcrypt';

const DEFAULT_SALT_ROUNDS = 12;

export async function hashPassword(plain: string, saltRounds = DEFAULT_SALT_ROUNDS): Promise<string> {
  return hash(plain, saltRounds);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  if (!plain || !passwordHash) {
    return false;
  }
  return compare(plain, passwordHash);
}
