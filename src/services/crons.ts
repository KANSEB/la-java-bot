// ============================================================
// Tâches planifiées (node-cron), toutes à l'heure de Paris :
// - 09h00 : compte à rebours, panthéon, fenêtre du badge, archivage covoit
// - 10h00 : annonces d'anniversaire
// - 18h00 : relance des membres restés à la porte
// - lundi 11h : rappel anniversaire à l'équipe
// - chaque heure : séquence de DM aux nouveaux bénévoles
// - chaque minute : filet de sécurité sur les candidatures
// - toutes les 10 min : XP vocal
// ============================================================

import { ChannelType, Client, Guild } from "discord.js";
import cron from "node-cron";
import { db, kvGet, kvSet } from "../db/database.js";
import { ANNIVERSAIRES, COULEURS, DELAIS, EDITION, FUSEAU, PALIERS_XP, RECLAMATION_BADGE, ROLE_PORTE, ROLES, SALONS, TEXTES, XP } from "../config/config.js";
import { dmSur, estStaff, joursAvant, roleParNom, salonTexte } from "./util.js";
import { log, logErreur } from "./logs.js";
import { tickVocal } from "./xp.js";
import { debloquerCharteAcceptee, verifierCandidaturesEnAttente } from "./onboarding.js";

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

// ---------- Rappel anniversaire (une seule fois par personne) ----------
async function rappelerAnniversaires(guild: Guild): Promise<void> {
  const salon = salonTexte(guild, ANNIVERSAIRES.salonAnnonce);
  if (!salon) return;

  const idsAutorises = ANNIVERSAIRES.rolesAutorises
    .map((cle) => roleParNom(guild, ROLES[cle].nom)?.id)
    .filter((id): id is string => id !== undefined);

  for (const membre of guild.members.cache.values()) {
    if (membre.user.bot) continue;
    if (!membre.roles.cache.hasAny(...idsAutorises)) continue;
    if (kvGet(`anniv_rappel:${membre.id}`) === "1") continue; // on ne relance jamais deux fois
    const deja = db.prepare("SELECT 1 FROM anniversaires WHERE userId = ?").get(membre.id);
    if (deja) continue;

    kvSet(`anniv_rappel:${membre.id}`, "1");
    await dmSur(membre, TEXTES.rappelAnniversaire(salon.name));
  }
}

// ---------- Panthéon : la liste des Légendes, tenue à jour toute seule ----------
async function majPantheon(guild: Guild): Promise<void> {
  const salon = salonTexte(guild, "niveaux");
  if (!salon) return;
  const dernier = PALIERS_XP[PALIERS_XP.length - 1];
  const role = roleParNom(guild, dernier.nom);
  const noms = role ? [...role.members.values()].map((m) => `<@${m.id}>`) : [];

  const texte = TEXTES.pantheonCorps(noms);
  const messageId = kvGet("pantheon");
  if (messageId) {
    const message = await salon.messages.fetch(messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [{ title: TEXTES.pantheonTitre, description: texte, color: dernier.couleur }] }).catch(() => {});
      return;
    }
  }
  const message = await salon.send({ embeds: [{ title: TEXTES.pantheonTitre, description: texte, color: dernier.couleur }] }).catch(() => null);
  if (message) {
    await message.pin().catch(() => {});
    kvSet("pantheon", message.id);
  }
}

// ---------- Réclamation du badge d'édition ----------
/**
 * Impossible de savoir qui était sur place : on ouvre une fenêtre déclarative
 * le lendemain du festival, et elle se referme seule un mois plus tard.
 */
async function gererReclamationBadge(guild: Guild): Promise<void> {
  const ecoules = -joursAvant(EDITION.dateEvenement);
  const { ouvertureJoursApresEvent: ouverture, dureeJours } = RECLAMATION_BADGE;
  const cle = `badge_reclamation:${EDITION.annee}`;
  const messageId = kvGet(cle);
  const annonces = salonTexte(guild, "annonces");
  if (!annonces) return;

  // Fermeture : le message reste, mais il annonce que c'est terminé
  if (ecoules >= ouverture + dureeJours) {
    if (messageId && kvGet(`${cle}:clos`) !== "1") {
      const message = await annonces.messages.fetch(messageId).catch(() => null);
      await message?.edit({
        embeds: [{ title: TEXTES.badgeReclamationTitre(EDITION.annee), description: TEXTES.badgeReclamationClos(EDITION.annee), color: COULEURS.neutre }],
      }).catch(() => {});
      kvSet(`${cle}:clos`, "1");
      await log(guild, "🏅 Réclamation close", `Les badges Java ${EDITION.annee} ne sont plus réclamables.`);
    }
    return;
  }

  // Ouverture, une seule fois
  if (ecoules >= ouverture && !messageId) {
    const fin = new Date(Date.now() + (ouverture + dureeJours - ecoules) * 86_400_000)
      .toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const message = await annonces.send({
      embeds: [{
        title: TEXTES.badgeReclamationTitre(EDITION.annee),
        description: TEXTES.badgeReclamationCorps(EDITION.annee, TEXTES.emojiDeblocage, XP.badgeEdition, fin),
        color: COULEURS.primaire,
      }],
    }).catch(() => null);
    if (message) {
      await message.react(TEXTES.emojiDeblocage).catch(() => {});
      kvSet(cle, message.id);
      await log(guild, "🏅 Réclamation ouverte", `Les badges Java ${EDITION.annee} sont réclamables jusqu'au ${fin}.`, "succes");
    }
  }
}

// ---------- Relance des membres restés à la porte ----------
/**
 * Un membre qui n'a pas réagi 🎪 ne voit rien et n'est relancé par personne.
 * Une relance unique après 24 h, jamais deux fois : au-delà, c'est un choix.
 * Au passage, la barrière est retirée au Staff, chez qui elle ne sert à rien.
 */
async function rappelerPorte(guild: Guild): Promise<void> {
  const porte = roleParNom(guild, ROLE_PORTE.nom);
  const bienvenue = salonTexte(guild, "bienvenue");
  if (!porte || !bienvenue) return;

  for (const membre of [...porte.members.values()]) {
    if (membre.user.bot) continue;

    if (estStaff(membre)) {
      await membre.roles.remove(porte.id, "Le Staff n'est pas concerné par la barrière").catch(() => {});
      continue;
    }
    const heures = membre.joinedTimestamp ? (Date.now() - membre.joinedTimestamp) / 3_600_000 : 0;
    if (heures < 24) continue;
    if (kvGet(`rappel_porte:${membre.id}`) === "1") continue;

    kvSet(`rappel_porte:${membre.id}`, "1");
    const ok = await dmSur(membre, TEXTES.rappelPorte(guild.name, bienvenue.name, TEXTES.emojiDeblocage));
    if (!ok) {
      await log(guild, "📪 Relance impossible",
        `<@${membre.id}> est bloqué à la porte depuis ${Math.round(heures)} h et a ses messages privés fermés : il faudra l'attraper autrement.`, "alerte");
    }
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
      await majPantheon(guild);
      await gererReclamationBadge(guild);
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

  // 18h — relance des membres restés à la porte
  cron.schedule("0 18 * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await rappelerPorte(guild);
    } catch (err) {
      await logErreur(guild, "cron rappel porte", err);
    }
  }, OPTIONS);

  // Lundi 11h — rappel anniversaire aux membres de l'équipe qui n'ont rien saisi
  cron.schedule("0 11 * * 1", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      await rappelerAnniversaires(guild);
    } catch (err) {
      await logErreur(guild, "cron rappel anniversaires", err);
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

  // Chaque minute — filet de sécurité sur les candidatures : un événement
  // Discord manqué ne doit pas laisser quelqu'un à la porte. Le balayage ne
  // touche au réseau que si le cache des membres est incomplet.
  cron.schedule("* * * * *", async () => {
    const guild = guildPrincipale(client);
    if (!guild) return;
    try {
      const signalees = await verifierCandidaturesEnAttente(guild);
      if (signalees > 0) console.log(`[onboarding] filet de sécurité : ${signalees} candidature(s) récupérée(s)`);
      const ouverts = await debloquerCharteAcceptee(guild);
      if (ouverts > 0) console.log(`[acces] filet de sécurité : ${ouverts} membre(s) ouvert(s)`);
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
