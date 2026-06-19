// Auth admin (mot de passe haché bcrypt). Node only (bcryptjs).
// 1 seul compte admin (table admin_account, 1 ligne).

import bcrypt from "bcryptjs";
import { dbSelect, dbInsert } from "./insforge";

type Admin = { id: string; password_hash: string };

export async function hasAdmin(): Promise<boolean> {
  const rows = await dbSelect<Admin>("admin_account", "limit=1");
  return rows.length > 0;
}

export async function createAdmin(password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await dbInsert("admin_account", [{ password_hash: hash }]);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const rows = await dbSelect<Admin>("admin_account", "limit=1");
  if (rows.length === 0) return false;
  return bcrypt.compare(password, rows[0].password_hash);
}
