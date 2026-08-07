// ============================================================
// Utilitaires partagés : résolution rôles/salons, DM sûrs, checks.
// Toute la résolution se fait PAR NOM (source de vérité : config.ts),
// ce qui rend le setup idempotent et le bot robuste aux re-créations.
// ============================================================

import {
  ChannelType,
  Guild,
  GuildMember,
  Role,
  TextChannel,
  User,
  type GuildBasedChannel,
  type MessageCreateOptions,
} from "discord.js";
import { ROLE_PORTE, ROLES, SALONS } from "../config/config.js";

export function assertEnv(nom: string): string {
  const v = process.env[nom];
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom} (voir .env.example)`);
  return v;
}

/** Retrouve un rôle fonctionnel par sa clé de config. */
export function role(guild: Guild, cle: keyof typeof ROLES): Role | undefined {
  return roleParNom(guild, ROLES[cle].nom);
}

export function roleParNom(guild: Guild, nom: string): Role | undefined {
  return guild.roles.cache.find((r) => r.name === nom);
}

/** Retrouve un salon par sa clé de config (tous types confondus). */
export function salon(guild: Guild, cle: keyof typeof SALONS): GuildBasedChannel | undefined {
  const nom = SALONS[cle];
  return guild.channels.cache.find((c) => c.name === nom);
}

/** Retrouve un salon TEXTE par sa clé (pour poster des messages). */
export function salonTexte(guild: Guild, cle: keyof typeof SALONS): TextChannel | undefined {
  const c = salon(guild, cle);
  return c && c.type === ChannelType.GuildText ? (c as TextChannel) : undefined;
}

export function estStaff(membre: GuildMember): boolean {
  const r = role(membre.guild, "staff");
  return (r !== undefined && membre.roles.cache.has(r.id)) || membre.permissions.has("Administrator");
}

/**
 * Pose la barrière : le membre ne voit plus que le salon des règles, jusqu'à
 * la réaction 🎪. Sans effet sur qui a déjà accepté, sur le Staff et sur les
 * bots — on ne se coupe jamais l'accès à soi-même.
 */
export async function poserBarriere(membre: GuildMember): Promise<void> {
  if (membre.user.bot || estStaff(membre)) return;
  const membreRole = role(membre.guild, "membre");
  if (membreRole && membre.roles.cache.has(membreRole.id)) return;

  const porte = roleParNom(membre.guild, ROLE_PORTE.nom);
  if (porte && !membre.roles.cache.has(porte.id)) {
    await membre.roles.add(porte.id, "Règles pas encore acceptées").catch(() => {});
  }
}

/** Lève la barrière : le serveur devient visible, selon les rôles du membre. */
export async function leverBarriere(membre: GuildMember): Promise<void> {
  const porte = roleParNom(membre.guild, ROLE_PORTE.nom);
  if (porte && membre.roles.cache.has(porte.id)) {
    await membre.roles.remove(porte.id, "Règles acceptées (réaction 🎪)").catch(() => {});
  }
}

/**
 * Envoie un DM sans jamais faire crasher le bot (DM fermés, blocage...).
 * Retourne false en cas d'échec pour permettre un message de repli au Staff.
 */
export async function dmSur(user: User | GuildMember, contenu: string | MessageCreateOptions): Promise<boolean> {
  try {
    await user.send(contenu);
    return true;
  } catch {
    return false;
  }
}

/** Ancienneté du compte Discord en jours. */
export function ageCompteJours(user: User): number {
  return Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
}

export function horodatage(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

/** Échappe une valeur pour un CSV (guillemets doublés, champ entre guillemets). */
export function csv(valeur: unknown): string {
  const s = valeur === null || valeur === undefined ? "" : String(valeur);
  return `"${s.replaceAll('"', '""')}"`;
}

/** Jours restants avant une date ISO (négatif si passée). */
export function joursAvant(dateISO: string): number {
  const cible = new Date(dateISO + "T00:00:00");
  const maintenant = new Date();
  maintenant.setHours(0, 0, 0, 0);
  return Math.round((cible.getTime() - maintenant.getTime()) / 86_400_000);
}
