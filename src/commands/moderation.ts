// Commandes modération : /lockdown, /stats, /fermer-ticket.

import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, type OnboardingRow } from "../db/database.js";
import { COULEURS, EDITION, nomBadge, QUESTIONNAIRE, ROLES, TEXTES } from "../config/config.js";
import { activerLockdown, estEnLockdown } from "../services/antiraid.js";
import { fermerTicket } from "../services/tickets.js";
import { roleParNom } from "../services/util.js";
import type { Commande } from "./types.js";

export const commandes: Commande[] = [
  {
    data: new SlashCommandBuilder()
      .setName("lockdown")
      .setDescription("Active/désactive le lockdown anti-raid (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addStringOption((o) =>
        o.setName("etat").setDescription("on ou off").setRequired(true)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      ),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const actif = interaction.options.getString("etat", true) === "on";
      if (actif === estEnLockdown()) {
        await interaction.editReply(`Le lockdown est déjà ${actif ? "actif" : "inactif"}.`);
        return;
      }
      await activerLockdown(interaction.guild, actif);
      await interaction.editReply(actif ? TEXTES.lockdownOn : TEXTES.lockdownOff);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("fermer-ticket")
      .setDescription("Ferme le ticket courant (transcript archivé dans les logs)"),
    execute: async (interaction) => {
      await fermerTicket(interaction);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Dashboard : membres, conversion, sources, croissance, rétention (Staff)")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    staffUniquement: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      await guild.members.fetch().catch(() => {});

      // --- Membres par rôle fonctionnel ---
      const lignesRoles: string[] = [];
      for (const cle of Object.keys(ROLES)) {
        const r = roleParNom(guild, ROLES[cle].nom);
        if (r) lignesRoles.push(`• ${r.name} : **${r.members.size}**`);
      }

      // --- Conversion onboarding ---
      const rows = db.prepare("SELECT statut, source FROM onboarding").all() as Pick<OnboardingRow, "statut" | "source">[];
      const total = rows.length;
      const approuves = rows.filter((r) => r.statut === "approuve").length;
      const refuses = rows.filter((r) => r.statut === "refuse").length;
      const enAttente = total - approuves - refuses;
      const conversion = total > 0 ? Math.round((approuves / total) * 100) : 0;

      // --- Sources d'acquisition agrégées et classées ---
      const parSource = new Map<string, number>();
      for (const r of rows) parSource.set(r.source, (parSource.get(r.source) ?? 0) + 1);
      const sourcesTriees = [...parSource.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([source, nb]) => {
          const label = QUESTIONNAIRE.sources.find((s) => s.value === source)?.label ?? source;
          return `• ${label} : **${nb}** (${total > 0 ? Math.round((nb / total) * 100) : 0} %)`;
        });

      // --- Croissance sur 30 jours ---
      const seuil30j = Date.now() - 30 * 86_400_000;
      const arrivees30j = guild.members.cache.filter((m) => !m.user.bot && (m.joinedTimestamp ?? 0) >= seuil30j).size;

      // --- Rétention bénévoles édition N-1 → N ---
      const badgePrecedent = roleParNom(guild, nomBadge(EDITION.annee - 1));
      const roleActuel = roleParNom(guild, ROLES.benevoleEdition.nom);
      const badgeActuel = roleParNom(guild, nomBadge(EDITION.annee));
      let retention = "Pas encore de données (badge édition précédente vide)";
      if (badgePrecedent && badgePrecedent.members.size > 0) {
        const revenus = badgePrecedent.members.filter(
          (m) => (roleActuel && m.roles.cache.has(roleActuel.id)) || (badgeActuel && m.roles.cache.has(badgeActuel.id))
        ).size;
        retention = `**${Math.round((revenus / badgePrecedent.members.size) * 100)} %** (${revenus}/${badgePrecedent.members.size} bénévoles ${EDITION.annee - 1} revenus en ${EDITION.annee})`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📈 Stats — ${guild.name}`)
        .setColor(COULEURS.primaire)
        .addFields(
          { name: `👥 Membres (${guild.memberCount} au total)`, value: lignesRoles.join("\n") || "—" },
          { name: "🎯 Onboarding", value: `Soumissions : **${total}** • Approuvées : **${approuves}** • Refusées : **${refuses}** • En attente : **${enAttente}**\nTaux de conversion : **${conversion} %**` },
          { name: "📣 Sources d'acquisition", value: sourcesTriees.join("\n") || "Aucune donnée" },
          { name: "📈 Croissance 30 jours", value: `**+${arrivees30j}** arrivées` },
          { name: `🔁 Rétention bénévoles ${EDITION.annee - 1} → ${EDITION.annee}`, value: retention }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
