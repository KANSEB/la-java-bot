// Commandes communautaires : /sondage et /sondage-resultats.

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, type SondageRow } from "../db/database.js";
import { COULEURS } from "../config/config.js";
import { roleParNom, salonTexte } from "../services/util.js";
import { log } from "../services/logs.js";
import type { Commande } from "./types.js";

// Emojis de vote (A → J), max 10 options par sondage
const EMOJIS_VOTE = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

export const commandes: Commande[] = [
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
