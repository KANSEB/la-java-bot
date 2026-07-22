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
import { DELAIS, EDITION, ROLE_BENEVOLE_DU_MOIS, SALONS, TEXTES, XP } from "../config/config.js";
import { dmSur, joursAvant, roleParNom, salonTexte } from "./util.js";
import { log, logErreur } from "./logs.js";
import { tickVocal } from "./xp.js";
import { traiterNonVerifies } from "./onboarding.js";

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

// ---------- Anniversaires (10h, jamais l'année : RGPD) ----------
async function annoncerAnniversaires(guild: Guild): Promise<void> {
  const auj = new Date();
  const rows = db.prepare("SELECT userId FROM anniversaires WHERE jour = ? AND mois = ?")
    .all(auj.getDate(), auj.getMonth() + 1) as { userId: string }[];
  if (rows.length === 0) return;

  const general = salonTexte(guild, "general");
  if (!general) return;
  for (const { userId } of rows) {
    const membre = await guild.members.fetch(userId).catch(() => null);
    if (!membre) continue; // parti du serveur → on n'annonce pas
    const messages = TEXTES.messagesAnniversaire;
    const message = messages[Math.floor(Math.random() * messages.length)];
    await general.send(message(userId)).catch(() => {});
  }
}

// ---------- Expiration Bénévole du Mois (30 jours) ----------
async function expirerShoutouts(guild: Guild): Promise<void> {
  const expires = db.prepare("SELECT userId FROM shoutouts WHERE expireA <= ?").all(Date.now()) as { userId: string }[];
  if (expires.length === 0) return;
  const roleBdm = roleParNom(guild, ROLE_BENEVOLE_DU_MOIS.nom);

  for (const { userId } of expires) {
    if (roleBdm) {
      const membre = await guild.members.fetch(userId).catch(() => null);
      if (membre?.roles.cache.has(roleBdm.id)) {
        await membre.roles.remove(roleBdm.id, "Fin des 30 jours Bénévole du Mois").catch(() => {});
      }
    }
    db.prepare("DELETE FROM shoutouts WHERE userId = ?").run(userId);
    await log(guild, "🌟 Fin Bénévole du Mois", `Le rôle de <@${userId}> a expiré (30 jours).`);
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

  const forum = guild.channels.cache.find((c) => c.name === SALONS.covoiturage && c.type === ChannelType.GuildForum);
  if (!forum || forum.type !== ChannelType.GuildForum) return;
  await forum.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false }).catch(() => {});
  kvSet("covoitArchive", "1");
  await log(guild, "🚗 Covoiturage archivé", `Le forum covoiturage est verrouillé (${DELAIS.archivageCovoitJoursApresEvent} jours après l'événement).`);
}

// ---------- Enregistrement des crons ----------
export function demarrerCrons(client: Client): void {
  // 09h00 — maintenance quotidienne
  cron.schedule("0 9 * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await majCountdown(guild);
      const stats = await traiterNonVerifies(guild);
      if (stats.rappels + stats.avertis + stats.kicks > 0) {
        await log(guild, "⏰ Rappels vérification", `Rappels 48h : ${stats.rappels} • Avertissements J-1 : ${stats.avertis} • Kicks : ${stats.kicks}`);
      }
      await archiverCovoitSiFini(guild);
    } catch (err) {
      await logErreur(guild, "cron 9h", err);
    }
  });

  // 10h00 — anniversaires
  cron.schedule("0 10 * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await annoncerAnniversaires(guild);
    } catch (err) {
      await logErreur(guild, "cron anniversaires", err);
    }
  });

  // Toutes les heures — expirations + séquences DM
  cron.schedule("0 * * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await expirerShoutouts(guild);
      await envoyerSequencesDm(guild);
    } catch (err) {
      await logErreur(guild, "cron horaire", err);
    }
  });

  // Toutes les N minutes — XP vocal
  cron.schedule(`*/${XP.vocalTrancheMinutes} * * * *`, async () => {
    try {
      await tickVocal(client);
    } catch (err) {
      await logErreur(guildPrincipale(client) ?? null, "cron XP vocal", err);
    }
  });

  console.log("[crons] tâches planifiées démarrées");
}
