// Commandes XP : /xp-add (Staff), /classement, /mon-profil.

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { COULEURS, XP } from "../config/config.js";
import { ajouterXp, getClassement, getRang, getXp, palierPour } from "../services/xp.js";
import { horodatage } from "../services/util.js";
import { log } from "../services/logs.js";
import type { Commande } from "./types.js";

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("xp-add")
      .setDescription("Ajoute des points XP à un membre, ex : shift bénévole validé (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
      .addIntegerOption((o) => o.setName("points").setDescription(`Points (shift = ${XP.shiftBenevole})`).setRequired(true).setMinValue(1).setMaxValue(1000))
      .addStringOption((o) => o.setName("motif").setDescription("Motif (ex : Shift bar vendredi soir)").setRequired(true).setMaxLength(200)),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("membre", true);
      const points = interaction.options.getInteger("points", true);
      const motif = interaction.options.getString("motif", true);
      const membre = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!membre) {
        await interaction.editReply("⚠️ Membre introuvable sur le serveur.");
        return;
      }
      const nouveauPalier = await ajouterXp(membre, points, motif);
      await log(interaction.guild, "➕ XP ajouté", `<@${user.id}> +${points} XP par <@${interaction.user.id}> — ${motif}`);
      await interaction.editReply(`➕ **+${points} XP** pour <@${user.id}> (${motif}).${nouveauPalier ? ` 🏆 Nouveau palier : **${nouveauPalier}** !` : ""}`);
    },
  },
  {
    data: new SlashCommandBuilder().setName("classement").setDescription("Top 20 des membres les plus actifs"),
    execute: async (interaction) => {
      await interaction.deferReply();
      const top = getClassement(XP.tailleClassement);
      if (top.length === 0) {
        await interaction.editReply("Personne n'a encore d'XP — sois la première personne à en gagner ! 🎉");
        return;
      }
      const medailles = ["🥇", "🥈", "🥉"];
      const lignes = top.map((r, i) => `${medailles[i] ?? `**${i + 1}.**`} <@${r.userId}> — **${r.points} XP** (${palierPour(r.points).nom})`);
      const embed = new EmbedBuilder().setTitle("🏆 Classement de la communauté").setDescription(lignes.join("\n")).setColor(COULEURS.primaire);
      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder().setName("mon-profil").setDescription("Ton XP, ton rang, tes badges et ton ancienneté"),
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const membre = interaction.member;
      const points = getXp(membre.id);
      const rang = getRang(membre.id);
      const palier = palierPour(points);
      const badges = membre.roles.cache.filter((r) => /^Java \d{4}$/.test(r.name)).map((r) => r.name);
      const embed = new EmbedBuilder()
        .setTitle(`🎪 Profil de ${membre.displayName}`)
        .setThumbnail(membre.user.displayAvatarURL())
        .setColor(COULEURS.info)
        .addFields(
          { name: "XP", value: `**${points}** points`, inline: true },
          { name: "Rang", value: `#${rang}`, inline: true },
          { name: "Palier", value: palier.nom, inline: true },
          { name: "Badges d'édition", value: badges.length ? badges.join(" • ") : "Aucun (pas encore !)", inline: false },
          { name: "Sur le serveur depuis", value: membre.joinedTimestamp ? horodatage(membre.joinedTimestamp) : "?", inline: true }
        );
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
