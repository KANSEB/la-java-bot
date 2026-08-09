// ============================================================
// Tâches planifiées (node-cron) :
// - 09h00 : compte à rebours + rappels/kicks Non vérifiés + archivage covoit
// - 10h00 : anniversaires
// - toutes les heures : expiration Bénévole du Mois + séquence DM bénévoles
// - toutes les 10 min : XP vocal
// ============================================================

import { ChannelType, Client, Guild } from "discord.js";
import cron from "node-cron";
import { db, kvGet, kvSet } from "../db/database.js";
import { ANNIVERSAIRES, DELAIS, EDITION, FUSEAU, SALONS, TEXTES, XP } from "../config/config.js";
import { dmSur, joursAvant, roleParNom, salonTexte } from "./util.js";
import { log, logErreur } from "./logs.js";
import { tickVocal } from "./xp.js";
import { verifierCandidaturesEnAttente } from "./onboarding.js";

function guildPrincipale(client: Client): Guild | undefined {
  const id = process.env.GUILD_ID;
  return id ? client.guilds.cache.get(id) : client.guilds.cache.first();
}

// ---------- Compte à rebours (message épinglé, mis à jour chaque jour) ----------
export async function majCountdown(guild: Guild): Promise<void> {
  const jours = joursAvant(EDITION.dateEvenement);
  const texte = TEXTES.countdown(jours);

  for (const cle of ["general", "benevoles"] as const) {
    const canal = salonTexte(guild, cle);
    if (!canal) continue;
    const kvCle = `countdown:${cle}`;
    const messageId = kvGet(kvCle);
    let edite = false;

    if (messageId) {
      const message = await canal.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.edit(texte).catch(() => {});
        edite = true;
      }
    }
    if (!edite) {
      const message = await canal.send(texte).catch(() => null);
      if (message) {
        await message.pin().catch(() => {});
        kvSet(kvCle, message.id);
      }
    }
  }
}

// ---------- Anniversaires (10h heure française, jamais l'année : RGPD) ----------
async function annoncerAnniversaires(guild: Guild): Promise<void> {
  // Date lue à l'heure de Paris, pas à celle du serveur (UTC chez l'hébergeur)
  const parisien = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "numeric" })
    .formatToParts(new Date());
  const jour = Number(parisien.find((p) => p.type === "day")?.value);
  const mois = Number(parisien.find((p) => p.type === "month")?.value);

  const rows = db.prepare("SELECT userId FROM anniversaires WHERE jour = ? AND mois = ?")
    .all(jour, mois) as { userId: string }[];
  if (rows.length === 0) return;

  // Annonce dans le salon d'équipe, pas dans le général (rituel interne)
  const salon = salonTexte(guild, ANNIVERSAIRES.salonAnnonce);
  if (!salon) return;
  for (const { userId } of rows) {
    const membre = await guild.members.fetch(userId).catch(() => null);
    if (!membre) continue; // parti du serveur → on n'annonce pas
    const messages = TEXTES.messagesAnniversaire;
    const message = messages[Math.floor(Math.random() * messages.length)];
    await salon.send(message(userId)).catch(() => {});
  }
}

// ---------- Séquence DM bénévoles (J+0 / J+1 / J+2) ----------
async function envoyerSequencesDm(guild: Guild): Promise<void> {
  const dus = db.prepare("SELECT userId, etape FROM dm_sequences WHERE prochainEnvoi <= ? AND etape < 3")
    .all(Date.now()) as { userId: string; etape: number }[];

  for (const { userId, etape } of dus) {
    const membre = await guild.members.fetch(userId).catch(() => null);
    if (!membre) {
      db.prepare("DELETE FROM dm_sequences WHERE userId = ?").run(userId);
      continue;
    }
    const ok = await dmSur(membre, TEXTES.dmSequenceBenevole[etape]);
    if (!ok) await log(guild, "📪 DM bénévole impossible", `Étape ${etape + 1}/3 non délivrée à <@${userId}> (DM fermés).`, "alerte");

    const suivante = etape + 1;
    if (suivante >= TEXTES.dmSequenceBenevole.length) {
      db.prepare("DELETE FROM dm_sequences WHERE userId = ?").run(userId);
    } else {
      db.prepare("UPDATE dm_sequences SET etape = ?, prochainEnvoi = ? WHERE userId = ?")
        .run(suivante, Date.now() + DELAIS.dmSequenceHeures * 3_600_000, userId);
    }
  }
}

// ---------- Auto-archivage covoiturage (7 jours après l'événement) ----------
async function archiverCovoitSiFini(guild: Guild): Promise<void> {
  if (kvGet("covoitArchive") === "1") return;
  if (joursAvant(EDITION.dateEvenement) > -DELAIS.archivageCovoitJoursApresEvent) return;

  const covoit = guild.channels.cache.find((c) => c.name === SALONS.covoiturage);
  if (!covoit || !("permissionOverwrites" in covoit)) return;
  await covoit.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false }).catch(() => {});
  kvSet("covoitArchive", "1");
  await log(guild, "🚗 Covoiturage archivé", `Le salon covoiturage est verrouillé (${DELAIS.archivageCovoitJoursApresEvent} jours après l'événement).`);
}

// ---------- Enregistrement des crons ----------
// Toutes les heures sont exprimées à l'heure française : sans le fuseau
// explicite, un serveur en UTC décalerait tout d'une ou deux heures.
const OPTIONS = { timezone: FUSEAU };

export function demarrerCrons(client: Client): void {
  // 09h00 — maintenance quotidienne
  cron.schedule("0 9 * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await majCountdown(guild);
      await archiverCovoitSiFini(guild);
    } catch (err) {
      await logErreur(guild, "cron 9h", err);
    }
  }, OPTIONS);

  // 10h00 — anniversaires
  cron.schedule("0 10 * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await annoncerAnniversaires(guild);
    } catch (err) {
      await logErreur(guild, "cron anniversaires", err);
    }
  }, OPTIONS);

  // Toutes les heures — expirations + séquences DM
  cron.schedule("0 * * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await envoyerSequencesDm(guild);
    } catch (err) {
      await logErreur(guild, "cron horaire", err);
    }
  }, OPTIONS);

  // Toutes les 5 minutes — filet de sécurité sur les candidatures :
  // un événement Discord manqué ne doit pas laisser quelqu'un à la porte
  cron.schedule("*/5 * * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      const signalees = await verifierCandidaturesEnAttente(guild);
      if (signalees > 0) console.log(`[onboarding] filet de sécurité : ${signalees} candidature(s) récupérée(s)`);
    } catch (err) {
      await logErreur(guild, "cron candidatures", err);
    }
  }, OPTIONS);

  // Toutes les N minutes — XP vocal
  cron.schedule(`*/${XP.vocalTrancheMinutes} * * * *`, async () => {
    try {
      await tickVocal(client);
    } catch (err) {
      await logErreur(guildPrincipale(client) ?? null, "cron XP vocal", err);
    }
  }, OPTIONS);

  console.log(`[crons] tâches planifiées démarrées (fuseau ${FUSEAU})`);
}
