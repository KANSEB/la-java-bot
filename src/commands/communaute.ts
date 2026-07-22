// Commandes communautaires : /shoutout (Bénévole du Mois), /sondage, /sondage-resultats.

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, type SondageRow } from "../db/database.js";
import { COULEURS, DELAIS, ROLE_BENEVOLE_DU_MOIS, TEXTES } from "../config/config.js";
import { roleParNom, salonTexte } from "../services/util.js";
import { log } from "../services/logs.js";
import type { Commande } from "./types.js";

// Emojis de vote (A → J), max 10 options par sondage
const EMOJIS_VOTE = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("shoutout")
      .setDescription("Met un bénévole à l'honneur : annonce + rôle Bénévole du Mois 30 jours (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName("membre").setDescription("Le bénévole à féliciter").setRequired(true))
      .addStringOption((o) => o.setName("texte").setDescription("Pourquoi il/elle le mérite").setRequired(true).setMaxLength(500)),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser("membre", true);
      const texte = interaction.options.getString("texte", true);
      const membre = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!membre) {
        await interaction.editReply("⚠️ Membre introuvable sur le serveur.");
        return;
      }

      const roleBdm = roleParNom(interaction.guild, ROLE_BENEVOLE_DU_MOIS.nom);
      if (roleBdm) await membre.roles.add(roleBdm.id, "Bénévole du Mois").catch(() => {});
      db.prepare("INSERT INTO shoutouts (userId, expireA) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET expireA = excluded.expireA")
        .run(user.id, Date.now() + DELAIS.benevoleDuMoisJours * 86_400_000);

      const annonces = salonTexte(interaction.guild, "annonces");
      const embed = new EmbedBuilder()
        .setDescription(TEXTES.shoutout(user.id, texte))
        .setColor(ROLE_BENEVOLE_DU_MOIS.couleur)
        .setThumbnail(user.displayAvatarURL());
      if (annonces) await annonces.send({ embeds: [embed] }).catch(() => {});

      await log(interaction.guild, "🌟 Bénévole du Mois", `<@${user.id}> mis à l'honneur par <@${interaction.user.id}>.`, "succes");
      await interaction.editReply(`🌟 <@${user.id}> est le/la nouveau·elle **Bénévole du Mois** ! Annonce publiée, rôle attribué pour ${DELAIS.benevoleDuMoisJours} jours.`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("sondage")
      .setDescription("Crée un sondage à réactions")
      .addStringOption((o) => o.setName("question").setDescription("La question posée").setRequired(true).setMaxLength(256))
      .addStringOption((o) => o.setName("options").setDescription("Options séparées par des ; (2 à 10)").setRequired(true)),
    execute: async (interaction) => {
      const question = interaction.options.getString("question", true);
      const options = interaction.options.getString("options", true).split(";").map((s) => s.trim()).filter(Boolean);
      if (options.length < 2 || options.length > EMOJIS_VOTE.length) {
        await interaction.reply({ content: `⚠️ Il faut entre 2 et ${EMOJIS_VOTE.length} options, séparées par des \`;\``, ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((o, i) => `${EMOJIS_VOTE[i]} ${o}`).join("\n"))
        .setColor(COULEURS.info)
        .setFooter({ text: `Sondage lancé par ${interaction.user.username} — vote avec les réactions !` });
      const message = await interaction.editReply({ embeds: [embed] });
      for (let i = 0; i < options.length; i++) {
        await message.react(EMOJIS_VOTE[i]).catch(() => {});
      }
      db.prepare("INSERT INTO sondages (messageId, channelId, question, options, creePar, creeA) VALUES (?, ?, ?, ?, ?, ?)")
        .run(message.id, interaction.channelId, question, JSON.stringify(options), interaction.user.id, Date.now());
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("sondage-resultats")
      .setDescription("Affiche les résultats du dernier sondage du salon (ou d'un message précis)")
      .addStringOption((o) => o.setName("message-id").setDescription("ID du message du sondage (optionnel)").setRequired(false)),
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.getString("message-id");
      const sondage = (messageId
        ? db.prepare("SELECT * FROM sondages WHERE messageId = ?").get(messageId)
        : db.prepare("SELECT * FROM sondages WHERE channelId = ? ORDER BY creeA DESC LIMIT 1").get(interaction.channelId)) as SondageRow | undefined;
      if (!sondage) {
        await interaction.editReply("Aucun sondage trouvé dans ce salon.");
        return;
      }
      const canal = interaction.guild.channels.cache.get(sondage.channelId);
      if (!canal?.isTextBased()) {
        await interaction.editReply("⚠️ Le salon du sondage n'existe plus.");
        return;
      }
      const message = await canal.messages.fetch(sondage.messageId).catch(() => null);
      if (!message) {
        await interaction.editReply("⚠️ Le message du sondage a été supprimé.");
        return;
      }
      const options = JSON.parse(sondage.options) as string[];
      const resultats: { option: string; votes: number }[] = [];
      for (let i = 0; i < options.length; i++) {
        const reaction = message.reactions.cache.get(EMOJIS_VOTE[i]);
        // -1 : on ne compte pas la réaction du bot
        resultats.push({ option: options[i], votes: Math.max(0, (reaction?.count ?? 0) - 1) });
      }
      resultats.sort((a, b) => b.votes - a.votes);
      const total = resultats.reduce((s, r) => s + r.votes, 0);
      const embed = new EmbedBuilder()
        .setTitle(`📊 Résultats — ${sondage.question}`)
        .setColor(COULEURS.succes)
        .setDescription(
          resultats.map((r) => {
            const pct = total > 0 ? Math.round((r.votes / total) * 100) : 0;
            return `**${r.option}** — ${r.votes} vote(s) (${pct} %)`;
          }).join("\n") + `\n\n**Total : ${total} vote(s)**`
        );
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
