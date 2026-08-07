// Commandes Staff liées à l'onboarding : export CSV, rappels manuels, purge RGPD.

import { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, kvGet, kvListe, purgerMembre, type OnboardingRow } from "../db/database.js";
import { COULEURS, ROLE_PORTE, ROLES, SALONS } from "../config/config.js";
import { csv, horodatage, roleParNom } from "../services/util.js";
import { log } from "../services/logs.js";
import type { Commande } from "./types.js";

/** Coupe une liste trop longue pour un champ d'embed (1024 caractères). */
function champ(lignes: string[], vide: string): string {
  if (lignes.length === 0) return vide;
  let sortie = "";
  for (let i = 0; i < lignes.length; i++) {
    if (sortie.length + lignes[i].length > 950) return `${sortie}… et ${lignes.length - i} de plus`;
    sortie += `${lignes[i]}\n`;
  }
  return sortie.trimEnd();
}

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("suivi")
      .setDescription("Qui attend quoi : candidatures, profils en réserve, membres bloqués à la porte (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      await guild.members.fetch().catch(() => {});

      // 1. Candidatures ouvertes : en attente de ta décision
      const ouvertes = db
        .prepare("SELECT * FROM onboarding WHERE statut IN ('en_attente', 'infos') ORDER BY dateSubmission")
        .all() as OnboardingRow[];
      const aValider = ouvertes.map(
        (o) => `• <@${o.userId}> — ${o.roleDemande || "profil inconnu"} — depuis ${horodatage(o.dateSubmission)}${o.statut === "infos" ? " *(infos demandées)*" : ""}`
      );

      // 2. Profils validés mais pas encore posés : le membre n'a pas accepté les règles
      const enReserve = kvListe("profil_attente:").map(({ cle, valeur }) => {
        const userId = cle.slice("profil_attente:".length);
        const noms = valeur
          .split(",")
          .map((c) => ROLES[c]?.nom ?? c)
          .join(", ");
        return `• <@${userId}> — **${noms}** en réserve`;
      });

      // 3. Bloqués à la porte : arrivés, jamais passés par la réaction 🎪
      const porte = roleParNom(guild, ROLE_PORTE.nom);
      const enAttenteDeDecision = new Set(ouvertes.map((o) => o.userId));
      const reserves = new Set(enReserve.map((l) => l.slice(l.indexOf("<@") + 2, l.indexOf(">"))));
      const bloques = porte
        ? [...porte.members.values()]
            .filter((m) => !enAttenteDeDecision.has(m.id) && !reserves.has(m.id))
            .sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0))
            .map((m) => `• <@${m.id}> — arrivé ${m.joinedTimestamp ? horodatage(m.joinedTimestamp) : "?"}`)
        : [];

      const embed = new EmbedBuilder()
        .setTitle("🧭 Suivi des arrivées")
        .setColor(COULEURS.primaire)
        .setDescription(
          porte
            ? "Trois files d'attente distinctes. Seule la première demande une action de ta part."
            : `⚠️ Le rôle **${ROLE_PORTE.nom}** n'existe pas : lance \`/setup-serveur\`.`
        )
        .addFields(
          {
            name: `🕐 À valider par toi — ${aValider.length}`,
            value: champ(aValider, `Rien en attente. Les fiches arrivent dans ${SALONS.validation}.`),
          },
          {
            name: `⏳ Validés, en attente de leur réaction 🎪 — ${enReserve.length}`,
            value: champ(enReserve, "Personne. Tous les profils validés ont été posés."),
          },
          {
            name: `🚧 Bloqués à la porte — ${bloques.length}`,
            value: champ(bloques, "Personne n'attend devant la porte."),
          }
        )
        .setFooter({ text: "Les deux dernières files se vident toutes seules quand le membre réagit 🎪." })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("export-onboarding")
      .setDescription("Exporte toutes les candidatures en CSV (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const rows = db.prepare("SELECT * FROM onboarding ORDER BY dateSubmission DESC").all() as OnboardingRow[];
      const entetes = ["userId", "username", "dateSubmission", "source", "motivation", "roleDemande", "pseudo", "statut", "validateurId", "dateValidation", "motifRefus", "nbSoumissions"];
      const lignes = [entetes.join(";")];
      for (const r of rows) {
        lignes.push([
          csv(r.userId), csv(r.username),
          csv(r.dateSubmission ? new Date(r.dateSubmission).toISOString() : ""),
          csv(r.source), csv(r.motivation), csv(r.roleDemande), csv(r.pseudo), csv(r.statut),
          csv(r.validateurId), csv(r.dateValidation ? new Date(r.dateValidation).toISOString() : ""),
          csv(r.motifRefus), csv(r.nbSoumissions),
        ].join(";"));
      }
      const fichier = new AttachmentBuilder(Buffer.from("﻿" + lignes.join("\n"), "utf-8"), { name: "onboarding-la-java.csv" });
      await interaction.editReply({ content: `📊 ${rows.length} candidature(s) exportée(s).`, files: [fichier] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("oublier-membre")
      .setDescription("Purge RGPD : efface TOUTES les données d'un membre (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("membre").setDescription("Membre à oublier").setRequired(true)),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("membre", true);
      const supprimees = purgerMembre(user.id);
      await log(interaction.guild, "🗑 Purge RGPD", `Données de ${user.username} (${user.id}) purgées par <@${interaction.user.id}> — ${supprimees} enregistrement(s).`, "alerte");
      await interaction.editReply(`🗑 ${supprimees} enregistrement(s) de **${user.username}** supprimé(s) de la base (onboarding, XP, anniversaire, séquences...).`);
    },
  },
];
