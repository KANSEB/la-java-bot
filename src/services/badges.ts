// ============================================================
// Badges d'édition (cumulables) + Bénévole Vétéran + archivage d'édition.
// ============================================================

import { ChannelType, Guild, GuildMember, PermissionFlagsBits as P } from "discord.js";
import { BADGES, EDITION, nomBadge, ROLES, XP } from "../config/config.js";
import { ajouterXp } from "./xp.js";
import { role, roleParNom } from "./util.js";
import { kvGet, kvSet } from "../db/database.js";
import { log } from "./logs.js";

/** Attribue le badge d'une édition (crée le rôle si besoin) et vérifie le passage Vétéran. */
export async function attribuerBadge(membre: GuildMember, annee: number): Promise<string> {
  const guild = membre.guild;
  const nom = nomBadge(annee);
  let badge = roleParNom(guild, nom);
  if (!badge) {
    badge = await guild.roles.create({
      name: nom,
      color: BADGES[annee]?.couleur ?? 0x74b9ff,
      hoist: false,
      mentionable: false,
      permissions: [],
      reason: `Badge d'édition ${annee}`,
    });
  }
  // L'XP n'est accordée qu'à la première pose : avoir fait une édition compte
  // une fois, qu'on repasse par le bouton ou par la commande Staff.
  if (!membre.roles.cache.has(badge.id)) {
    await membre.roles.add(badge.id, `Badge édition ${annee}`);
  }
  // L'XP est mémorisée à part : un badge retiré puis réclamé à nouveau ne rapporte pas deux fois
  const cleXp = `badge_xp:${annee}:${membre.id}`;
  if (kvGet(cleXp) !== "1") {
    kvSet(cleXp, "1");
    await ajouterXp(membre, XP.badgeEdition, `Badge ${nom}`).catch(() => {});
  }

  return nom;
}

export interface RapportArchivage {
  benevolesBascules: number;
  salonsArchives: string[];
  nouveauRole: string;
}

/**
 * Fin d'édition : Bénévole → Ancien bénévole, badges conservés,
 * salons de l'édition passés en lecture seule, préparation de l'année suivante.
 */
export async function archiverEdition(guild: Guild): Promise<RapportArchivage> {
  const rapport: RapportArchivage = { benevolesBascules: 0, salonsArchives: [], nouveauRole: "" };
  await guild.members.fetch().catch(() => {});

  const benevoleEdition = role(guild, "benevoleEdition");
  const benevoleAlumni = role(guild, "benevole");

  // 1. Bascule des bénévoles actifs en alumni
  if (benevoleEdition && benevoleAlumni) {
    for (const membre of [...benevoleEdition.members.values()]) {
      await membre.roles.add(benevoleAlumni.id, "Fin d'édition").catch(() => {});
      await membre.roles.remove(benevoleEdition.id, "Fin d'édition").catch(() => {});
      rapport.benevolesBascules++;
    }
  }

  // 2. Archivage des salons de l'édition : catégorie renommée + lecture seule
  const categorieEdition = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.includes(`LA JAVA ${EDITION.annee}`)
  );
  if (categorieEdition && categorieEdition.type === ChannelType.GuildCategory) {
    await categorieEdition.setName(`🗄 ARCHIVES ${EDITION.annee}`).catch(() => {});
    for (const salon of categorieEdition.children.cache.values()) {
      await salon.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false, SendMessagesInThreads: false }).catch(() => {});
      rapport.salonsArchives.push(salon.name);
    }
  }

  // 3. Le rôle « Bénévole » reste tel quel pour l'édition suivante : seul le
  //    badge porte l'année. On prépare juste celui de l'an prochain.
  const anneeSuivante = EDITION.annee + 1;
  if (!roleParNom(guild, nomBadge(anneeSuivante))) {
    await guild.roles.create({ name: nomBadge(anneeSuivante), color: 0x9ae66e, permissions: [], reason: "Badge édition suivante" });
  }
  rapport.nouveauRole = nomBadge(anneeSuivante);

  await log(
    guild,
    "🗄 Édition archivée",
    `Bénévoles basculés en alumni : ${rapport.benevolesBascules}\nSalons archivés : ${rapport.salonsArchives.join(", ") || "aucun"}\nBadge préparé : ${rapport.nouveauRole}\n\n⚠️ Pense à mettre à jour \`EDITION.annee\` dans config.ts puis relancer \`/setup-serveur\`.`,
    "succes"
  );
  return rapport;
}
