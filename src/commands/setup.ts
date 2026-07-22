// Commandes de provisioning : /setup-serveur et /ouvrir-salon.

import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { provisionner, revelerSalon, salonsMasques } from "../setup/provision.js";
import { SALONS, TEXTES } from "../config/config.js";
import { salonTexte } from "../services/util.js";
import { logErreur } from "../services/logs.js";
import type { Commande } from "./types.js";

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("setup-serveur")
      .setDescription("Crée/complète rôles, catégories, salons et messages (idempotent, admin)")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      try {
        const rapport = await provisionner(interaction.guild);
        await interaction.editReply(
          `🏗 **Setup terminé !**\n` +
          `• Rôles créés : ${rapport.rolesCrees.length ? rapport.rolesCrees.join(", ") : "aucun (tout existait)"}\n` +
          `• Salons créés : ${rapport.salonsCrees.length ? rapport.salonsCrees.join(", ") : "aucun (tout existait)"}\n` +
          `• Éléments déjà en place : ${rapport.existants}\n\n` +
          `⚠️ Vérifie que le rôle du bot est **au-dessus** de tous les rôles créés (Paramètres → Rôles).`
        );
      } catch (err) {
        await logErreur(interaction.guild, "/setup-serveur", err);
        await interaction.editReply(`⚠️ Erreur pendant le setup : ${err instanceof Error ? err.message : err}\nRelance la commande : elle reprendra là où elle s'est arrêtée.`);
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("ouvrir-salon")
      .setDescription("Révèle un salon masqué (permissions normales appliquées)")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption((o) =>
        o.setName("salon").setDescription("Salon à révéler").setRequired(true).setAutocomplete(true)
      ),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const cle = interaction.options.getString("salon", true) as keyof typeof SALONS;
      const canal = await revelerSalon(interaction.guild, cle);
      if (!canal) {
        await interaction.editReply("⚠️ Salon introuvable ou non configuré comme masqué.");
        return;
      }
      // Changelog dans #actu-serveur
      const actu = salonTexte(interaction.guild, "actuServeur");
      if (actu) await actu.send(`🔓 Nouveau salon ouvert : <#${canal.id}> — allez voir !`).catch(() => {});
      await interaction.editReply(`🔓 Salon <#${canal.id}> révélé !`);
    },
    autocomplete: async (interaction) => {
      const saisie = interaction.options.getFocused().toLowerCase();
      const choix = salonsMasques()
        .filter((s) => s.nom.toLowerCase().includes(saisie))
        .slice(0, 25)
        .map((s) => ({ name: s.nom, value: s.cle }));
      await interaction.respond(choix);
    },
  },
];
