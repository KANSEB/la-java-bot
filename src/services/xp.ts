// ============================================================
// Système XP : messages (+15 à 40, cooldown 60s), réactions (+25,
// cooldown 5 min), vocal (+10 / 10 min), shifts bénévoles (+50 via
// /xp-add). Paliers → rôles + avantages (voir PALIERS_XP).
// ============================================================

import { Client, Guild, GuildMember } from "discord.js";
import { db, type XpRow } from "../db/database.js";
import { PALIERS_XP, XP } from "../config/config.js";
import { roleParNom } from "./util.js";
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
