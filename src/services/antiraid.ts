// ============================================================
// Anti-raid : > N arrivées en 60 s → lockdown automatique
// (validations bloquées + #verification verrouillé + alerte Staff).
// ============================================================

import { Guild } from "discord.js";
import { ANTIRAID, TEXTES } from "../config/config.js";
import { kvGet, kvSet } from "../db/database.js";
import { verrouillerVerification } from "../setup/provision.js";
import { role, salonTexte } from "./util.js";
import { log } from "./logs.js";

// Horodatages des arrivées récentes (en mémoire : un raid est un événement temps réel)
const arrivees: number[] = [];

export function estEnLockdown(): boolean {
  return kvGet("lockdown") === "1";
}

export async function surveillerArrivee(guild: Guild): Promise<void> {
  const maintenant = Date.now();
  arrivees.push(maintenant);
  // Ne garder que la fenêtre glissante
  const limite = maintenant - ANTIRAID.fenetreSecondes * 1000;
  while (arrivees.length > 0 && arrivees[0] < limite) arrivees.shift();

  if (arrivees.length > ANTIRAID.seuilArrivees && !estEnLockdown()) {
    await activerLockdown(guild, true);
    const staff = role(guild, "staff");
    const alertes = salonTexte(guild, "alertes");
    if (alertes) await alertes.send(TEXTES.alerteRaid(arrivees.length, staff?.id ?? "")).catch(() => {});
  }
}

export async function activerLockdown(guild: Guild, actif: boolean): Promise<void> {
  kvSet("lockdown", actif ? "1" : "0");
  await verrouillerVerification(guild, actif).catch(() => {});
  await log(guild, actif ? "🚨 Lockdown activé" : "✅ Lockdown désactivé", actif ? TEXTES.lockdownOn : TEXTES.lockdownOff, actif ? "alerte" : "succes");
}
