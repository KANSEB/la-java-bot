// ============================================================
// Tous les événements Discord : arrivées/départs, interactions,
// messages (XP + filtre liens), logs de modération.
// ============================================================

import {
  AuditLogEvent, Client, EmbedBuilder, Events, Message, MessageReaction, PartialMessage,
  PartialMessageReaction, PartialUser, User,
} from "discord.js";
import { COULEURS, DOMAINES_SUSPECTS, PROFIL_DIRECT, ROLE_ATTENTE, ROLES, SALONS, TEXTES } from "../config/config.js";
import { db, kvGet, kvSet } from "../db/database.js";
import { surveillerArrivee } from "../services/antiraid.js";
import { log, logErreur } from "../services/logs.js";
import {
  approuverProfilDemande, boutonApprouver, boutonPlusInfos, boutonRefuser, modalPlusInfos, modalRefus,
  nettoyerCandidature, ouvrirQuestionnaire, selectionRoles, signalerDemandeValidation, soumettreQuestionnaire,
} from "../services/onboarding.js";
import { enregistrerAnniversaire, ouvrirModalAnniversaire } from "../services/anniversaire.js";
import { ouvrirTicket } from "../services/tickets.js";
import { xpMessage, xpReaction } from "../services/xp.js";
import { dmSur, estStaff, role, roleParNom, salonTexte } from "../services/util.js";
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
      // `avant` est partiel quand le membre n'était pas en cache (redémarrage récent
      // du bot, membre inactif) : impossible de comparer les rôles. On ne peut pas
      // pour autant ignorer l'événement, sinon la candidature d'un membre non mis en
      // cache passe à la trappe jusqu'au prochain redémarrage. Repli sur l'état actuel.
      if (avant.partial) {
        const attente = roleParNom(apres.guild, ROLE_ATTENTE.nom);
        if (attente && apres.roles.cache.has(attente.id)) await signalerDemandeValidation(apres);
        return;
      }
      const ajoutes = apres.roles.cache.filter((r) => !avant.roles.cache.has(r.id));
      const retires = avant.roles.cache.filter((r) => !apres.roles.cache.has(r.id));
      if (ajoutes.size === 0 && retires.size === 0) return;
      const details = [
        ...ajoutes.map((r) => `➕ ${r.name}`),
        ...retires.map((r) => `➖ ${r.name}`),
      ].join(" • ");
      await log(apres.guild, "🎭 Rôles modifiés", `<@${apres.id}> : ${details}`);

      // Candidature : le questionnaire natif vient de poser le rôle d'attente → demande au Staff
      if (ajoutes.some((r) => r.name === ROLE_ATTENTE.nom)) {
        await signalerDemandeValidation(apres);
      }

      // Rôle fonctionnel attribué (bouton du Staff ou à la main dans Discord) :
      // la candidature n'a plus lieu d'être, et l'accès communauté doit suivre.
      const fonctionnels = new Set(
        (["staff", "referent", "artiste", "artisteCommunaute", "partenaire", "benevoleEdition", "benevole", "benevoleVeteran"] as (keyof typeof ROLES)[])
          .map((cle) => ROLES[cle].nom)
      );
      if (ajoutes.some((r) => fonctionnels.has(r.name))) {
        await nettoyerCandidature(apres); // retire ⏳ En attente + les marqueurs Candidat
        const membreRole = role(apres.guild, "membre");
        if (membreRole && !apres.roles.cache.has(membreRole.id)) {
          await apres.roles.add(membreRole.id, "Rôle attribué : accès communauté").catch(() => {});
        }
      }

      // Festivalier : Membre reçu directement via le questionnaire (sans candidature)
      // → message de bienvenue public. Les parcours validés (attente_notifie) sont gérés à l'approbation.
      if (
        ajoutes.some((r) => r.name === ROLES.membre.nom) &&
        kvGet(`attente_notifie:${apres.id}`) !== "1" &&
        kvGet(`bienvenue:${apres.id}`) !== "1"
      ) {
        kvSet(`bienvenue:${apres.id}`, "1");
        const general = salonTexte(apres.guild, "general");
        if (general) await general.send(TEXTES.bienvenueGeneral(apres.id, PROFIL_DIRECT.titre)).catch(() => {});
      }
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

  // ---------- Réactions ----------
  /**
   * Résout la réaction en (membre, est-ce le post de bienvenue du bot, est-ce l'emoji 🎪).
   * Les réactions peuvent arriver « partielles » : on complète avant de décider.
   */
  const contexteReaction = async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ) => {
    if (user.bot) return null;
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
    if (!message?.guild) return null;
    const membre = await message.guild.members.fetch(user.id).catch(() => null);
    if (!membre) return null;

    const surPostBienvenue =
      "name" in message.channel &&
      message.channel.name === SALONS.bienvenue &&
      message.author?.id === client.user?.id;
    const bonEmoji = reaction.emoji.name === TEXTES.emojiDeblocage;
    return { guild: message.guild, membre, porteDacces: surPostBienvenue && bonEmoji };
  };

  // Réaction 🎪 sur le post de bienvenue = acceptation des règles → accès au serveur
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      const ctx = await contexteReaction(reaction, user);
      if (!ctx) return;
      const { guild, membre, porteDacces } = ctx;

      if (porteDacces) {
        kvSet(`regles:${membre.id}`, "1");
        const membreRole = role(guild, "membre");
        if (membreRole && !membre.roles.cache.has(membreRole.id)) {
          await membre.roles.add(membreRole.id, "Règles acceptées (réaction 🎪)").catch(() => {});
          await dmSur(membre, TEXTES.accesDebloque(membre.id));
          await log(guild, "🎪 Accès débloqué", `<@${membre.id}> a accepté les règles : rôle Membre attribué.`, "succes");
        }
      }

      await xpReaction(membre);
    } catch (err) {
      await logErreur(reaction.message.guild ?? null, "messageReactionAdd", err);
    }
  });

  // Réaction 🎪 retirée = accès suspendu (réversible : il suffit de re-réagir)
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      const ctx = await contexteReaction(reaction, user);
      if (!ctx?.porteDacces) return;
      const { guild, membre } = ctx;

      kvSet(`regles:${membre.id}`, "0");
      const membreRole = role(guild, "membre");
      if (membreRole && membre.roles.cache.has(membreRole.id)) {
        await membre.roles.remove(membreRole.id, "Réaction 🎪 retirée").catch(() => {});
        await dmSur(membre, TEXTES.accesRetire);
        await log(guild, "🚪 Accès suspendu", `<@${membre.id}> a retiré sa réaction : rôle Membre retiré.`, "alerte");
      }
    } catch (err) {
      await logErreur(reaction.message.guild ?? null, "messageReactionRemove", err);
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
        if (id === "btn_anniversaire") return void (await ouvrirModalAnniversaire(interaction));
        if (id === "btn_ticket") return void (await ouvrirTicket(interaction));
        if (id.startsWith("ob_apd:")) return void (await approuverProfilDemande(interaction));
        if (id.startsWith("ob_ap:")) return void (await boutonApprouver(interaction));
        if (id.startsWith("ob_rf:")) return void (await boutonRefuser(interaction));
        if (id.startsWith("ob_mi:")) return void (await boutonPlusInfos(interaction));
        return;
      }

      if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id === "modal_questionnaire") return void (await soumettreQuestionnaire(interaction));
        if (id === "modal_anniversaire") return void (await enregistrerAnniversaire(interaction));
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
