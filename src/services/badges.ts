// ============================================================
// Badges d'édition (cumulables) + Bénévole Vétéran + archivage d'édition.
// ============================================================

import { ChannelType, Guild, GuildMember, PermissionFlagsBits as P } from "discord.js";
import { BADGES, EDITION, nomBadge, ROLES } from "../config/config.js";
import { role, roleParNom } from "./util.js";
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
  if (!membre.roles.cache.has(badge.id)) {
    await membre.roles.add(badge.id, `Badge édition ${annee}`);
  }

  // Vétéran automatique à partir de 2 badges d'édition cumulés
  const nbBadges = membre.roles.cache.filter((r) => /^Java \d{4}$/.test(r.name)).size;
  if (nbBadges >= 2) {
    const veteran = role(guild, "benevoleVeteran");
    if (veteran && !membre.roles.cache.has(veteran.id)) {
      await membre.roles.add(veteran.id, "2 éditions cumulées");
      await log(guild, "🏅 Bénévole Vétéran", `<@${membre.id}> passe **Bénévole Vétéran** (${nbBadges} éditions) !`, "succes");
    }
  }
  return nom;
}

export interface RapportArchivage {
  benevolesBascules: number;
  salonsArchives: string[];
  nouveauRole: string;
}

/**
 * Fin d'édition : Bénévole {annee} → Bénévole (alumni), badges conservés,
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

  // 3. Préparation de l'année suivante : rôle bénévole + badge
  const anneeSuivante = EDITION.annee + 1;
  const nomSuivant = `Bénévole ${anneeSuivante}`;
  if (!roleParNom(guild, nomSuivant)) {
    await guild.roles.create({
      name: nomSuivant,
      color: ROLES.benevoleEdition.couleur,
      hoist: true,
      mentionable: true,
      permissions: [],
      reason: "Préparation édition suivante",
    });
  }
  if (!roleParNom(guild, nomBadge(anneeSuivante))) {
    await guild.roles.create({ name: nomBadge(anneeSuivante), color: 0x9ae66e, permissions: [], reason: "Badge édition suivante" });
  }
  rapport.nouveauRole = nomSuivant;

  await log(
    guild,
    "🗄 Édition archivée",
    `Bénévoles basculés en alumni : ${rapport.benevolesBascules}\nSalons archivés : ${rapport.salonsArchives.join(", ") || "aucun"}\nRôle préparé : ${nomSuivant}\n\n⚠️ Pense à mettre à jour \`EDITION.annee\` dans config.ts puis relancer \`/setup-serveur\`.`,
    "succes"
  );
  return rapport;
}
