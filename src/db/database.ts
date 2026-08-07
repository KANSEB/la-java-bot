// ============================================================
// Base SQLite (better-sqlite3) + migrations versionnées.
// La version du schéma est stockée dans PRAGMA user_version.
// ============================================================

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = process.env.DB_PATH?.trim() || resolve(process.cwd(), "data", "lajava.db");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------- Migrations : ajouter chaque évolution du schéma À LA FIN, jamais modifier l'existant ----------
const MIGRATIONS: string[] = [
  // v1 — schéma initial
  `
  CREATE TABLE IF NOT EXISTS onboarding (
    userId TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    dateSubmission INTEGER NOT NULL,
    source TEXT NOT NULL,
    motivation TEXT NOT NULL,
    roleDemande TEXT NOT NULL,
    pseudo TEXT,
    statut TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | infos | approuve | refuse
    validateurId TEXT,
    dateValidation INTEGER,
    motifRefus TEXT,
    nbSoumissions INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS xp (
    userId TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    dernierMessage INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS anniversaires (
    userId TEXT PRIMARY KEY,
    jour INTEGER NOT NULL,
    mois INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shoutouts (
    userId TEXT PRIMARY KEY,
    expireA INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dm_sequences (
    userId TEXT PRIMARY KEY,
    etape INTEGER NOT NULL DEFAULT 0,
    prochainEnvoi INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rappels_verif (
    userId TEXT PRIMARY KEY,
    rappele INTEGER NOT NULL DEFAULT 0,
    averti INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sondages (
    messageId TEXT PRIMARY KEY,
    channelId TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON array
    creePar TEXT NOT NULL,
    creeA INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  );
  `,
  // v2 : XP sur les réactions (cooldown dédié)
  `
  ALTER TABLE xp ADD COLUMN dernierReaction INTEGER NOT NULL DEFAULT 0;
  `,
];

function migrer(): void {
  const version = (db.pragma("user_version", { simple: true }) as number) ?? 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec(MIGRATIONS[v]);
    db.pragma(`user_version = ${v + 1}`);
    console.log(`[db] migration v${v + 1} appliquée`);
  }
}
migrer();

// ---------- Types des lignes ----------
export interface OnboardingRow {
  userId: string;
  username: string;
  dateSubmission: number;
  source: string;
  motivation: string;
  roleDemande: string;
  pseudo: string | null;
  statut: "en_attente" | "infos" | "approuve" | "refuse";
  validateurId: string | null;
  dateValidation: number | null;
  motifRefus: string | null;
  nbSoumissions: number;
}

export interface XpRow {
  userId: string;
  points: number;
  dernierMessage: number;
  dernierReaction: number;
}

export interface AnniversaireRow {
  userId: string;
  jour: number;
  mois: number;
}

export interface SondageRow {
  messageId: string;
  channelId: string;
  question: string;
  options: string;
  creePar: string;
  creeA: number;
}

// ---------- Helpers KV (état persistant simple : lockdown, ids de messages épinglés...) ----------
export function kvGet(cle: string): string | null {
  const row = db.prepare("SELECT valeur FROM kv WHERE cle = ?").get(cle) as { valeur: string } | undefined;
  return row?.valeur ?? null;
}

export function kvSet(cle: string, valeur: string): void {
  db.prepare("INSERT INTO kv (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").run(cle, valeur);
}

export function kvDel(cle: string): void {
  db.prepare("DELETE FROM kv WHERE cle = ?").run(cle);
}

/** Toutes les entrées dont la clé commence par `prefixe` (pour lister un état : profils en réserve...). */
export function kvListe(prefixe: string): { cle: string; valeur: string }[] {
  return db.prepare("SELECT cle, valeur FROM kv WHERE cle LIKE ? ORDER BY cle").all(`${prefixe}%`) as { cle: string; valeur: string }[];
}

// ---------- Purge RGPD : efface TOUTES les données d'un membre ----------
export function purgerMembre(userId: string): number {
  let total = 0;
  for (const table of ["onboarding", "xp", "anniversaires", "shoutouts", "dm_sequences", "rappels_verif"]) {
    total += db.prepare(`DELETE FROM ${table} WHERE userId = ?`).run(userId).changes;
  }
  return total;
}
