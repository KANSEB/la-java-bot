// Prépare une copie propre de la base pour l'upload sur l'hébergeur.
// SQLite est en mode WAL (3 fichiers) : VACUUM INTO produit UN seul fichier
// cohérent, sans avoir à arrêter proprement le bot au préalable.
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = process.env.DB_PATH?.trim() || resolve(process.cwd(), "data", "lajava.db");
if (!existsSync(source)) {
  console.error(`Base introuvable : ${source}`);
  process.exit(1);
}

const dossier = resolve(process.cwd(), "export");
mkdirSync(dossier, { recursive: true });
const cible = resolve(dossier, "lajava.db");
rmSync(cible, { force: true });

const db = new Database(source, { readonly: true });
db.exec(`VACUUM INTO '${cible.replaceAll("\\", "/").replaceAll("'", "''")}'`);

// Petit récapitulatif de ce que contient la copie
const compte = (table) => db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
console.log(`✅ Copie prête : ${cible}`);
console.log(`   onboarding : ${compte("onboarding")} • xp : ${compte("xp")} • anniversaires : ${compte("anniversaires")} • kv : ${compte("kv")}`);
console.log("\n👉 Upload ce fichier dans le dossier data/ de ton hébergeur (bot arrêté).");
db.close();
