// ============================================================
// Tous les événements Discord : arrivées/départs, interactions,
// messages (XP + filtre liens), logs de modération.
// ============================================================

import { AuditLogEvent, Client, EmbedBuilder, Events, Message, PartialMessage } from "discord.js";
import { COULEURS, DOMAINES_SUSPECTS, TEXTES } from "../config/config.js";
import { db } from "../db/database.js";
import { surveillerArrivee } from "../services/antiraid.js";
import { log, logErreur } from "../services/logs.js";
import {
  boutonApprouver, boutonPlusInfos, boutonRefuser, modalPlusInfos, modalRefus,
  ouvrirQuestionnaire, selectionRoles, soumettreQuestionnaire,
} from "../services/onboarding.js";
import { ouvrirTicket } from "../services/tickets.js";
import { xpMessage, xpReaction } from "../services/xp.js";
import { dmSur, estStaff, role, salonTexte } from "../services/util.js";
import type { Commande } from "../commands/types.js";

// Détection d'invitations Discord tierces et de liens suspects (raccourcisseurs, grabbers)
const REGEX_INVITATION = /(discord\.(gg|io|me)|discord(app)?\.com\/invite)\/[\w-]+/i;
const REGEX_SUSPECT = new RegExp(`https?://(www\\.)?(${DOMAINES_SUSPECTS.map((d) => d.replaceAll(".", "\\.")).join("|")})/`, "i");

export function enregistrerEvenements(client: Client, commandes: Map<string, Commande>): void {
  // ---------- Arrivée d'un membre ----------
  client.on(Events.GuildMemberAdd, async (membre) => {
    try {
      if (membre.user.bot) return;
      await surveillerArrivee(membre.guild);

      // Les rôles sont attribués par l'onboarding natif Discord.
      await dmSur(membre, TEXTES.dmBienvenue(membre.guild.name));

      await log(membre.guild, "📥 Arrivée", `<@${membre.id}> (${membre.user.username}) a rejoint le serveur. Compte créé <t:${Math.floor(membre.user.createdTimestamp / 1000)}:R>.`);
    } catch (err) {
      await logErreur(membre.guild, "guildMemberAdd", err);
    }
  });

  // ---------- Départ / kick ----------
  client.on(Events.GuildMemberRemove, async (membre) => {
    try {
      // Distingue départ volontaire et kick via l'audit log (fenêtre de 5 s)
      let type = "📤 Départ";
      const audits = await membre.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }).catch(() => null);
      const kick = audits?.entries.find((e) => e.targetId === membre.id && Date.now() - e.createdTimestamp < 5000);
      if (kick) type = "👢 Kick";
      await log(membre.guild, type, `${membre.user?.username ?? membre.id} a quitté le serveur.${kick?.reason ? ` Raison : ${kick.reason}` : ""}`, kick ? "alerte" : "info");
    } catch (err) {
      console.error("guildMemberRemove :", err);
    }
  });

  // ---------- Changements de rôles ----------
  client.on(Events.GuildMemberUpdate, async (avant, apres) => {
    try {
      if (avant.partial) return;
      const ajoutes = apres.roles.cache.filter((r) => !avant.roles.cache.has(r.id));
      const retires = avant.roles.cache.filter((r) => !apres.roles.cache.has(r.id));
      if (ajoutes.size === 0 && retires.size === 0) return;
      const details = [
        ...ajoutes.map((r) => `➕ ${r.name}`),
        ...retires.map((r) => `➖ ${r.name}`),
      ].join(" • ");
      await log(apres.guild, "🎭 Rôles modifiés", `<@${apres.id}> : ${details}`);
    } catch (err) {
      console.error("guildMemberUpdate :", err);
    }
  });

  // ---------- Messages : XP + filtre anti-invitations/liens suspects ----------
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.inGuild() || message.author.bot || !message.member) return;

      // Filtre de sécurité pour les non-Staff
      if (!estStaff(message.member) && (REGEX_INVITATION.test(message.content) || REGEX_SUSPECT.test(message.content))) {
        await message.delete().catch(() => {});
        const alertes = salonTexte(message.guild, "alertes");
        if (alertes) {
          await alertes.send(`${TEXTES.lienSupprime(message.author.id)}\nSalon : <#${message.channelId}>\nContenu : \`${message.content.slice(0, 500)}\``).catch(() => {});
        }
        return; // pas d'XP pour un message supprimé
      }

      await xpMessage(message.member);
    } catch (err) {
      await logErreur(message.inGuild() ? message.guild : null, "messageCreate", err);
    }
  });

  // ---------- XP sur les réactions ----------
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (user.bot) return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const membre = await guild.members.fetch(user.id).catch(() => null);
      if (membre) await xpReaction(membre);
    } catch (err) {
      await logErreur(reaction.message.guild ?? null, "messageReactionAdd", err);
    }
  });

  // ---------- Logs messages supprimés / édités ----------
  const resume = (m: Message | PartialMessage): string => m.content ? m.content.slice(0, 800) : "(contenu inconnu ou embed/fichier)";

  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.inGuild() || message.author?.bot) return;
      await log(message.guild, "🗑 Message supprimé",
        `Auteur : ${message.author ? `<@${message.author.id}>` : "?"} • Salon : <#${message.channelId}>\n>>> ${resume(message)}`);
    } catch { /* jamais bloquant */ }
  });

  client.on(Events.MessageUpdate, async (avant, apres) => {
    try {
      if (!apres.inGuild() || apres.author?.bot || avant.content === apres.content) return;
      await log(apres.guild, "✏️ Message édité",
        `Auteur : <@${apres.author.id}> • Salon : <#${apres.channelId}>\n**Avant :** ${resume(avant)}\n**Après :** ${resume(apres)}`);
    } catch { /* jamais bloquant */ }
  });

  // ---------- Interactions : commandes, boutons, modals, selects ----------
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.inCachedGuild()) return;
    try {
      if (interaction.isChatInputCommand()) {
        const commande = commandes.get(interaction.commandName);
        if (!commande) return;
        if (commande.staffUniquement && !estStaff(interaction.member)) {
          await interaction.reply({ content: "⛔ Cette commande est réservée au Staff.", ephemeral: true });
          return;
        }
        await commande.execute(interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        await commandes.get(interaction.commandName)?.autocomplete?.(interaction);
        return;
      }

      if (interaction.isButton()) {
        const id = interaction.customId;
        if (id === "btn_rejoindre") return void (await ouvrirQuestionnaire(interaction));
        if (id === "btn_ticket") return void (await ouvrirTicket(interaction));
        if (id.startsWith("ob_ap:")) return void (await boutonApprouver(interaction));
        if (id.startsWith("ob_rf:")) return void (await boutonRefuser(interaction));
        if (id.startsWith("ob_mi:")) return void (await boutonPlusInfos(interaction));
        return;
      }

      if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id === "modal_questionnaire") return void (await soumettreQuestionnaire(interaction));
        if (id.startsWith("ob_rfm:")) return void (await modalRefus(interaction));
        if (id.startsWith("ob_mim:")) return void (await modalPlusInfos(interaction));
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith("ob_aps:")) {
        await selectionRoles(interaction);
      }
    } catch (err) {
      await logErreur(interaction.guild, `interaction ${interaction.isChatInputCommand() ? "/" + interaction.commandName : interaction.type}`, err);
      // Toujours répondre quelque chose à l'utilisateur, jamais de crash silencieux
      if (interaction.isRepliable()) {
        const contenu = { content: "⚠️ Oups, une erreur est survenue. Le Staff a été prévenu dans les logs.", ephemeral: true as const };
        if (interaction.deferred) await interaction.editReply(contenu).catch(() => {});
        else if (!interaction.replied) await interaction.reply(contenu).catch(() => {});
      }
    }
  });

  // ---------- Log de démarrage propre ----------
  client.on(Events.ClientReady, (c) => {
    console.log(`✅ Connecté en tant que ${c.user.tag}`);
  });
}
