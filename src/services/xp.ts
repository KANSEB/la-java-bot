// ============================================================
// Système XP : messages, réactions, vocal, shifts bénévoles et badge
// d'édition. Toutes les valeurs vivent dans XP et PALIERS_XP (config) :
// rien n'est chiffré ici, pour que ce fichier ne puisse pas mentir.
// ============================================================

import { Client, Guild, GuildMember } from "discord.js";
import { db, type XpRow } from "../db/database.js";
import { PALIERS_XP, ROLE_PORTE, XP } from "../config/config.js";
import { role, roleParNom } from "./util.js";
import { log } from "./logs.js";

export function getXp(userId: string): number {
  const row = db.prepare("SELECT points FROM xp WHERE userId = ?").get(userId) as { points: number } | undefined;
  return row?.points ?? 0;
}

export function getRang(userId: string): number {
  const rows = db.prepare("SELECT userId FROM xp ORDER BY points DESC").all() as { userId: string }[];
  const idx = rows.findIndex((r) => r.userId === userId);
  return idx === -1 ? rows.length + 1 : idx + 1;
}

export function getClassement(limite: number): XpRow[] {
  return db.prepare("SELECT * FROM xp ORDER BY points DESC LIMIT ?").all(limite) as XpRow[];
}

/** Palier atteint pour un total de points donné. */
export function palierPour(points: number): (typeof PALIERS_XP)[number] {
  let palier = PALIERS_XP[0];
  for (const p of PALIERS_XP) {
    if (points >= p.seuil) palier = p;
  }
  return palier;
}

/**
 * Ajoute des points et synchronise le rôle de palier.
 * Retourne le nouveau palier si un seuil vient d'être franchi.
 */
export async function ajouterXp(membre: GuildMember, points: number, motif?: string): Promise<string | null> {
  // Pas d'XP tant que les règles ne sont pas acceptées : un rôle de palier
  // porte des autorisations de salon qui perceraient la barrière d'entrée.
  const porte = roleParNom(membre.guild, ROLE_PORTE.nom);
  if (porte && membre.roles.cache.has(porte.id)) return null;

  const avant = getXp(membre.id);
  db.prepare(`
    INSERT INTO xp (userId, points, dernierMessage) VALUES (?, ?, 0)
    ON CONFLICT(userId) DO UPDATE SET points = points + excluded.points
  `).run(membre.id, points);
  const apres = avant + points;

  const palierAvant = palierPour(avant);
  const palierApres = palierPour(apres);
  const roleApres = roleParNom(membre.guild, palierApres.nom);

  // Synchronise le rôle dès qu'il manque (nouveau membre, rôle retiré à la main...),
  // pas uniquement lors d'un franchissement de seuil.
  if (roleApres && !membre.roles.cache.has(roleApres.id)) {
    for (const p of PALIERS_XP) {
      const r = roleParNom(membre.guild, p.nom);
      if (!r) continue;
      if (p.nom === palierApres.nom) await membre.roles.add(r.id, "Palier XP atteint").catch(() => {});
      else if (membre.roles.cache.has(r.id)) await membre.roles.remove(r.id, "Palier XP remplacé").catch(() => {});
    }
  }

  if (palierApres.nom !== palierAvant.nom) {
    await log(membre.guild, "🏆 Palier XP", `<@${membre.id}> atteint **${palierApres.nom}** (${apres} XP)${motif ? ` — ${motif}` : ""}`, "succes");
    return palierApres.nom;
  }
  return null;
}

/**
 * Recale le rôle de palier de tous les membres sur leur XP réel. Indispensable
 * après un changement de seuils : sans ça, chacun conserve le rôle obtenu sous
 * l'ancienne échelle jusqu'à son prochain gain de points.
 */
export async function resynchroniserPaliers(guild: Guild): Promise<number> {
  // Tous les Membres, pas seulement ceux qui ont une ligne XP : quelqu'un qui
  // n'a jamais écrit n'en a pas, et resterait sans palier de départ.
  const points = new Map(
    (db.prepare("SELECT userId, points FROM xp").all() as { userId: string; points: number }[]).map((l) => [l.userId, l.points])
  );
  const membreRole = role(guild, "membre");
  await guild.members.fetch().catch(() => {});
  let corriges = 0;

  for (const membre of guild.members.cache.values()) {
    if (membre.user.bot) continue;
    if (membreRole && !membre.roles.cache.has(membreRole.id) && !points.has(membre.id)) continue;

    const attendu = palierPour(points.get(membre.id) ?? 0).nom;
    const aJour = membre.roles.cache.some((r) => r.name === attendu);
    const enTrop = PALIERS_XP.filter((p) => p.nom !== attendu)
      .map((p) => roleParNom(guild, p.nom))
      .filter((r): r is NonNullable<typeof r> => r !== undefined && membre.roles.cache.has(r.id));
    if (aJour && enTrop.length === 0) continue;

    for (const r of enTrop) await membre.roles.remove(r.id, "Seuils XP mis à jour").catch(() => {});
    const bon = roleParNom(guild, attendu);
    if (bon && !membre.roles.cache.has(bon.id)) await membre.roles.add(bon.id, "Seuils XP mis à jour").catch(() => {});
    corriges++;
  }
  return corriges;
}

/** XP de message avec cooldown anti-spam. */
export async function xpMessage(membre: GuildMember): Promise<void> {
  const row = db.prepare("SELECT dernierMessage FROM xp WHERE userId = ?").get(membre.id) as { dernierMessage: number } | undefined;
  const maintenant = Date.now();
  if (row && maintenant - row.dernierMessage < XP.cooldownMessageMs) return;

  db.prepare(`
    INSERT INTO xp (userId, points, dernierMessage) VALUES (?, 0, ?)
    ON CONFLICT(userId) DO UPDATE SET dernierMessage = excluded.dernierMessage
  `).run(membre.id, maintenant);
  const gain = XP.parMessageMin + Math.floor(Math.random() * (XP.parMessageMax - XP.parMessageMin + 1));
  await ajouterXp(membre, gain);
}

/** XP de réaction avec son propre cooldown. */
export async function xpReaction(membre: GuildMember): Promise<void> {
  const row = db.prepare("SELECT dernierReaction FROM xp WHERE userId = ?").get(membre.id) as { dernierReaction: number } | undefined;
  const maintenant = Date.now();
  if (row && maintenant - row.dernierReaction < XP.cooldownReactionMs) return;

  db.prepare(`
    INSERT INTO xp (userId, points, dernierReaction) VALUES (?, 0, ?)
    ON CONFLICT(userId) DO UPDATE SET dernierReaction = excluded.dernierReaction
  `).run(membre.id, maintenant);
  await ajouterXp(membre, XP.parReaction);
}

/**
 * Tick vocal (cron toutes les `vocalTrancheMinutes` min) : +10 à chaque membre
 * humain réellement présent en vocal. Sont exclus le salon AFK et les membres
 * casque coupé : sans ça, se garer une nuit en vocal suffisait à monter d'un
 * palier sans avoir participé à quoi que ce soit.
 */
export async function tickVocal(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (!state.channelId || !state.member || state.member.user.bot) continue;
      if (state.channelId === guild.afkChannelId) continue;
      if (state.deaf || state.selfDeaf) continue;
      await ajouterXp(state.member, XP.vocalPointsParTranche).catch(() => {});
    }
  }
}
