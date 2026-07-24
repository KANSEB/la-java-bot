// Commandes Staff liées à l'onboarding : export CSV, rappels manuels, purge RGPD.

import { AttachmentBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, purgerMembre, type OnboardingRow } from "../db/database.js";
import { csv } from "../services/util.js";
import { log } from "../services/logs.js";
import type { Commande } from "./types.js";

export const commandes: Commande[] = [
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
