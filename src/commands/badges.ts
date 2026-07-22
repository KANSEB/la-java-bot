// Commandes badges d'édition : /attribuer-badge et /archiver-edition (avec confirmation).

import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
  PermissionFlagsBits, SlashCommandBuilder,
} from "discord.js";
import { EDITION } from "../config/config.js";
import { archiverEdition, attribuerBadge } from "../services/badges.js";
import type { Commande } from "./types.js";

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("attribuer-badge")
      .setDescription("Attribue rétroactivement un badge d'édition (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
      .addIntegerOption((o) => o.setName("annee").setDescription("Année de l'édition (ex : 2024)").setRequired(true).setMinValue(2015).setMaxValue(2100)),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("membre", true);
      const annee = interaction.options.getInteger("annee", true);
      const membre = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!membre) {
        await interaction.editReply("⚠️ Ce membre n'est pas (ou plus) sur le serveur.");
        return;
      }
      const badge = await attribuerBadge(membre, annee);
      await interaction.editReply(`🏅 Badge **${badge}** attribué à <@${user.id}> (Vétéran vérifié automatiquement à partir de 2 badges).`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("archiver-edition")
      .setDescription(`Clôture l'édition ${EDITION.annee} : alumni, archives, préparation ${EDITION.annee + 1} (Staff)`)
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    staffUniquement: true,
    execute: async (interaction) => {
      // Action lourde et difficilement réversible → confirmation explicite par boutons
      const boutons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("archiver_oui").setLabel(`Oui, archiver ${EDITION.annee}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("archiver_non").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
      );
      const reponse = await interaction.reply({
        content:
          `⚠️ **Archiver l'édition ${EDITION.annee} ?**\nCette action va :\n` +
          `• basculer tous les **Bénévole ${EDITION.annee}** en **Bénévole** (alumni)\n` +
          `• passer les salons de l'édition en lecture seule\n` +
          `• créer **Bénévole ${EDITION.annee + 1}** et le badge **Java ${EDITION.annee + 1}**\n\nLes badges d'édition sont conservés.`,
        components: [boutons],
        ephemeral: true,
      });

      try {
        const clic = await reponse.awaitMessageComponent({ componentType: ComponentType.Button, time: 60_000 });
        if (clic.customId === "archiver_non") {
          await clic.update({ content: "Archivage annulé.", components: [] });
          return;
        }
        await clic.update({ content: "🗄 Archivage en cours...", components: [] });
        const rapport = await archiverEdition(interaction.guild);
        await interaction.editReply({
          content:
            `🗄 **Édition ${EDITION.annee} archivée !**\n` +
            `• Bénévoles basculés en alumni : ${rapport.benevolesBascules}\n` +
            `• Salons archivés : ${rapport.salonsArchives.length}\n` +
            `• Rôle préparé : ${rapport.nouveauRole}\n\n` +
            `➡️ Mets à jour \`EDITION.annee\` dans config.ts puis relance \`/setup-serveur\` pour la nouvelle édition.`,
          components: [],
        });
      } catch {
        await interaction.editReply({ content: "⏳ Temps écoulé, archivage annulé.", components: [] });
      }
    },
  },
];
