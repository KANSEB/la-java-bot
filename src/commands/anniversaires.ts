// Commandes anniversaires : /anniversaire (membre) et /anniversaires-liste (Staff).
// RGPD : jour et mois uniquement, jamais l'année de naissance.

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, type AnniversaireRow } from "../db/database.js";
import { COULEURS, TEXTES } from "../config/config.js";
import { peutRenseignerAnniversaire } from "../services/anniversaire.js";
import type { Commande } from "./types.js";

const JOURS_PAR_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("anniversaire")
      .setDescription("Enregistre ton anniversaire (jour et mois uniquement, jamais l'année)")
      .addIntegerOption((o) => o.setName("jour").setDescription("Jour (1-31)").setRequired(true).setMinValue(1).setMaxValue(31))
      .addIntegerOption((o) => o.setName("mois").setDescription("Mois (1-12)").setRequired(true).setMinValue(1).setMaxValue(12)),
    execute: async (interaction) => {
      // Même règle que le bouton : rituel réservé à l'équipe
      if (!peutRenseignerAnniversaire(interaction.member)) {
        await interaction.reply({ content: TEXTES.anniversaireReserve, ephemeral: true });
        return;
      }
      const jour = interaction.options.getInteger("jour", true);
      const mois = interaction.options.getInteger("mois", true);
      if (jour > JOURS_PAR_MOIS[mois - 1]) {
        await interaction.reply({ content: `⚠️ Le mois ${mois} n'a pas ${jour} jours — vérifie ta date !`, ephemeral: true });
        return;
      }
      db.prepare("INSERT INTO anniversaires (userId, jour, mois) VALUES (?, ?, ?) ON CONFLICT(userId) DO UPDATE SET jour = excluded.jour, mois = excluded.mois")
        .run(interaction.user.id, jour, mois);
      await interaction.reply({ content: TEXTES.anniversaireEnregistre(jour, mois), ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("anniversaires-liste")
      .setDescription("Les anniversaires des 7 prochains jours (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const rows = db.prepare("SELECT * FROM anniversaires").all() as AnniversaireRow[];
      const prochains: { userId: string; date: Date; dans: number }[] = [];
      const auj = new Date();
      auj.setHours(0, 0, 0, 0);

      for (const r of rows) {
        // Prochaine occurrence de l'anniversaire (cette année ou la suivante)
        const cetteAnnee = new Date(auj.getFullYear(), r.mois - 1, r.jour);
        const prochaine = cetteAnnee >= auj ? cetteAnnee : new Date(auj.getFullYear() + 1, r.mois - 1, r.jour);
        const dans = Math.round((prochaine.getTime() - auj.getTime()) / 86_400_000);
        if (dans <= 7) prochains.push({ userId: r.userId, date: prochaine, dans });
      }
      prochains.sort((a, b) => a.dans - b.dans);

      const embed = new EmbedBuilder()
        .setTitle("🎂 Anniversaires des 7 prochains jours")
        .setColor(COULEURS.primaire)
        .setDescription(
          prochains.length
            ? prochains.map((p) => `• <@${p.userId}> — ${p.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} ${p.dans === 0 ? "**(aujourd'hui !)**" : `(dans ${p.dans} j)`}`).join("\n")
            : "Aucun anniversaire dans les 7 prochains jours."
        );
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
