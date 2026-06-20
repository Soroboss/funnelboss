// Auth admin (mot de passe haché bcrypt). Node only (bcryptjs).
// 1 seul compte admin (table admin_account, 1 ligne).

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { dbSelect, dbInsert, dbPatch } from "./insforge";

type Admin = { id: string; password_hash: string; recovery_hash: string | null };

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

// ── Récupération / changement de mot de passe ────────────────────────

function genRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans caractères ambigus
  const bytes = randomBytes(16);
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += alphabet[bytes[i] % alphabet.length];
    if ((i + 1) % 4 === 0 && i < 15) code += "-";
  }
  return code; // ex: AB3K-9XQ2-MN7P-RT5W
}

/** Génère un nouveau code de récupération (remplace l'ancien). Retourne le code en clair UNE fois. */
export async function generateRecoveryCode(): Promise<string | null> {
  const rows = await dbSelect<Admin>("admin_account", "limit=1");
  if (!rows[0]) return null;
  const code = genRecoveryCode();
  await dbPatch("admin_account", `id=eq.${rows[0].id}`, { recovery_hash: await bcrypt.hash(code, 10) });
  return code;
}

/** Réinitialise le mot de passe via le code de récupération (usage unique). */
export async function resetWithRecovery(code: string, newPassword: string): Promise<boolean> {
  const rows = await dbSelect<Admin>("admin_account", "limit=1");
  const a = rows[0];
  if (!a?.recovery_hash) return false;
  if (!(await bcrypt.compare(code.trim(), a.recovery_hash))) return false;
  await dbPatch("admin_account", `id=eq.${a.id}`, {
    password_hash: await bcrypt.hash(newPassword, 10),
    recovery_hash: null, // invalidé après usage
  });
  return true;
}

/** Change le mot de passe (vérifie l'actuel). */
export async function changePassword(current: string, next: string): Promise<boolean> {
  const rows = await dbSelect<Admin>("admin_account", "limit=1");
  const a = rows[0];
  if (!a || !(await bcrypt.compare(current, a.password_hash))) return false;
  await dbPatch("admin_account", `id=eq.${a.id}`, { password_hash: await bcrypt.hash(next, 10) });
  return true;
}
