// ============================================================
// Onboarding : modal questionnaire → embed de validation Staff →
// Approuver / Refuser / Plus d'infos. RÈGLE ABSOLUE : aucun accès
// sans validation manuelle, y compris "Curieux - Public".
// ============================================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  LabelBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db, kvGet, type OnboardingRow } from "../db/database.js";
import {
  COULEURS, DELAIS, EDITION, QUESTIONNAIRE, ROLES, SEUIL_COMPTE_RECENT_JOURS, TEXTES,
} from "../config/config.js";
import { ageCompteJours, dmSur, estStaff, horodatage, role, salonTexte } from "./util.js";
import { log } from "./logs.js";
import { attribuerBadge } from "./badges.js";

const STATUTS_AFFICHES: Record<OnboardingRow["statut"], string> = {
  en_attente: "🕐 En attente",
  infos: "❓ En attente d'infos",
  approuve: "✅ Approuvée",
  refuse: "❌ Refusée",
};

// ---------- 1. Bouton "Rejoindre" → Modal ----------
export async function ouvrirQuestionnaire(interaction: ButtonInteraction<"cached">): Promise<void> {
  // Lockdown anti-raid : validations suspendues
  if (kvGet("lockdown") === "1") {
    await interaction.reply({ content: TEXTES.verrouilleLockdown, ephemeral: true });
    return;
  }

  const existante = db.prepare("SELECT * FROM onboarding WHERE userId = ?").get(interaction.user.id) as OnboardingRow | undefined;
  if (existante) {
    if (existante.statut === "en_attente" || existante.statut === "infos") {
      await interaction.reply({ content: TEXTES.soumissionDejaEnCours, ephemeral: true });
      return;
    }
    // Droit à UNE seule nouvelle soumission après refus
    if (existante.statut === "refuse" && existante.nbSoumissions >= QUESTIONNAIRE.maxSoumissions) {
      await interaction.reply({ content: TEXTES.soumissionEpuisee, ephemeral: true });
      return;
    }
  }

  const modal = new ModalBuilder().setCustomId("modal_questionnaire").setTitle(QUESTIONNAIRE.titre);

  const selectSource = new StringSelectMenuBuilder()
    .setCustomId("q_source")
    .setPlaceholder("Choisis une option")
    .addOptions(QUESTIONNAIRE.sources.map((s) => ({ label: s.label, value: s.value, emoji: s.emoji })));

  const selectProfil = new StringSelectMenuBuilder()
    .setCustomId("q_profil")
    .setPlaceholder("Choisis ton profil")
    .addOptions(QUESTIONNAIRE.profils.map((p) => ({ label: p.label, value: p.value, emoji: p.emoji })));

  const motivation = new TextInputBuilder()
    .setCustomId("q_motivation")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(TEXTES.placeholderMotivation)
    .setMaxLength(300)
    .setRequired(true);

  const pseudo = new TextInputBuilder()
    .setCustomId("q_pseudo")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60)
    .setRequired(false);

  modal.addLabelComponents(
    new LabelBuilder().setLabel(TEXTES.labelSource).setStringSelectMenuComponent(selectSource),
    new LabelBuilder().setLabel(TEXTES.labelMotivation).setTextInputComponent(motivation),
    new LabelBuilder().setLabel(TEXTES.labelProfil).setStringSelectMenuComponent(selectProfil),
    new LabelBuilder().setLabel(TEXTES.labelPseudo).setTextInputComponent(pseudo)
  );

  await interaction.showModal(modal);
}

// ---------- 2. Modal soumis → enregistrement + embed Staff ----------
export async function soumettreQuestionnaire(interaction: ModalSubmitInteraction<"cached">): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const source = interaction.fields.getStringSelectValues("q_source")[0] ?? "autre";
  const motivation = interaction.fields.getTextInputValue("q_motivation");
  const profil = interaction.fields.getStringSelectValues("q_profil")[0] ?? "curieux";
  const pseudo = interaction.fields.getTextInputValue("q_pseudo") || null;

  const existante = db.prepare("SELECT * FROM onboarding WHERE userId = ?").get(interaction.user.id) as OnboardingRow | undefined;
  const nbSoumissions = existante ? existante.nbSoumissions + 1 : 1;

  db.prepare(`
    INSERT INTO onboarding (userId, username, dateSubmission, source, motivation, roleDemande, pseudo, statut, nbSoumissions)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)
    ON CONFLICT(userId) DO UPDATE SET
      username = excluded.username, dateSubmission = excluded.dateSubmission, source = excluded.source,
      motivation = excluded.motivation, roleDemande = excluded.roleDemande, pseudo = excluded.pseudo,
      statut = 'en_attente', validateurId = NULL, dateValidation = NULL, motifRefus = NULL,
      nbSoumissions = excluded.nbSoumissions
  `).run(interaction.user.id, interaction.user.username, Date.now(), source, motivation, profil, pseudo, nbSoumissions);

  await posterEmbedValidation(interaction, source, motivation, profil, pseudo, nbSoumissions);
  await interaction.editReply({ content: TEXTES.soumissionRecue });
  await log(interaction.guild, "📥 Nouvelle candidature", `<@${interaction.user.id}> a soumis le questionnaire (profil demandé : ${profil}).`);
}

async function posterEmbedValidation(
  interaction: ModalSubmitInteraction<"cached">,
  source: string, motivation: string, profil: string, pseudo: string | null, nbSoumissions: number
): Promise<void> {
  const canal = salonTexte(interaction.guild, "validation");
  if (!canal) return;

  const membre = interaction.member;
  const age = ageCompteJours(interaction.user);
  const sourceLabel = QUESTIONNAIRE.sources.find((s) => s.value === source)?.label ?? source;
  const profilLabel = QUESTIONNAIRE.profils.find((p) => p.value === profil)?.label ?? profil;

  const embed = new EmbedBuilder()
    .setTitle("📋 Demande d'accès")
    .setColor(COULEURS.info)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
      { name: "Compte créé", value: `${horodatage(interaction.user.createdTimestamp)}${age < SEUIL_COMPTE_RECENT_JOURS ? "\n⚠️ **Compte de moins de 7 jours**" : ""}`, inline: true },
      { name: "Arrivé sur le serveur", value: membre.joinedTimestamp ? horodatage(membre.joinedTimestamp) : "?", inline: true },
      { name: TEXTES.labelSource, value: sourceLabel, inline: true },
      { name: TEXTES.labelProfil, value: profilLabel, inline: true },
      { name: "Soumission n°", value: String(nbSoumissions), inline: true },
      { name: TEXTES.labelMotivation, value: motivation.slice(0, 1024) },
      ...(pseudo ? [{ name: TEXTES.labelPseudo, value: pseudo }] : []),
      { name: "Statut", value: STATUTS_AFFICHES.en_attente }
    )
    .setFooter({ text: `userId:${interaction.user.id}` })
    .setTimestamp();

  const boutons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ob_ap:${interaction.user.id}`).setLabel("Approuver").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ob_rf:${interaction.user.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ob_mi:${interaction.user.id}`).setLabel("Plus d'infos").setEmoji("❓").setStyle(ButtonStyle.Secondary)
  );

  await canal.send({ embeds: [embed], components: [boutons] });
}

// ---------- 3. Boutons Staff ----------
function verifStaff(interaction: ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached"> | ModalSubmitInteraction<"cached">): boolean {
  return interaction.member instanceof GuildMember && estStaff(interaction.member);
}

/** [Approuver] → menu de sélection du/des rôles à attribuer. */
export async function boutonApprouver(interaction: ButtonInteraction<"cached">): Promise<void> {
  if (!verifStaff(interaction)) {
    await interaction.reply({ content: "Réservé au Staff.", ephemeral: true });
    return;
  }
  if (kvGet("lockdown") === "1") {
    await interaction.reply({ content: TEXTES.lockdownOn, ephemeral: true });
    return;
  }
  const userId = interaction.customId.split(":")[1];

  // Rôles attribuables (fonctionnels, hors Non vérifié / Membre qui est automatique)
  const options = (Object.keys(ROLES) as (keyof typeof ROLES)[])
    .filter((c) => c !== "nonVerifie" && c !== "membre")
    .map((c) => ({ label: ROLES[c].nom, value: c }));
  options.push({ label: "Membre uniquement (Curieux - Public)", value: "membre" });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`ob_aps:${userId}:${interaction.message.id}`)
    .setPlaceholder("Choisis le ou les rôles à attribuer")
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 5))
    .addOptions(options);

  await interaction.reply({
    content: `Rôles à attribuer à <@${userId}> (le rôle **Membre** est ajouté automatiquement) :`,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    ephemeral: true,
  });
}

/** Sélection des rôles → attribution + DM + bienvenue + mise à jour embed. */
export async function selectionRoles(interaction: StringSelectMenuInteraction<"cached">): Promise<void> {
  await interaction.deferUpdate();
  const [, userId, messageId] = interaction.customId.split(":");
  const guild = interaction.guild;

  const membre = await guild.members.fetch(userId).catch(() => null);
  if (!membre) {
    await interaction.editReply({ content: "⚠️ Ce membre n'est plus sur le serveur.", components: [] });
    return;
  }

  // Attribution : Membre (toujours) + rôles choisis, retrait de Non vérifié
  const rolesAAjouter = new Set<string>();
  const membreRole = role(guild, "membre");
  if (membreRole) rolesAAjouter.add(membreRole.id);
  const nomsAttribues: string[] = [];
  let estBenevole = false;
  let estArtiste = false;

  for (const cle of interaction.values) {
    if (cle === "membre") continue; // déjà ajouté
    const r = role(guild, cle as keyof typeof ROLES);
    if (r) {
      rolesAAjouter.add(r.id);
      nomsAttribues.push(r.name);
      if (cle === "benevoleEdition") estBenevole = true;
      if (cle === "artiste") estArtiste = true;
    }
  }
  if (membreRole) nomsAttribues.unshift(membreRole.name);

  try {
    await membre.roles.add([...rolesAAjouter], "Onboarding approuvé");
    const nonVerifie = role(guild, "nonVerifie");
    if (nonVerifie && membre.roles.cache.has(nonVerifie.id)) {
      await membre.roles.remove(nonVerifie.id, "Onboarding approuvé");
    }
  } catch (err) {
    await interaction.editReply({ content: `⚠️ Impossible d'attribuer les rôles (vérifie que le rôle du bot est au-dessus des rôles à attribuer). ${err instanceof Error ? err.message : ""}`, components: [] });
    return;
  }

  // Badge d'édition automatique pour bénévoles et artistes programmés
  if (estBenevole || estArtiste) {
    await attribuerBadge(membre, EDITION.annee).catch(() => {});
  }

  // Séquence d'onboarding progressif bénévole (3 DM à 24h d'intervalle)
  if (estBenevole) {
    db.prepare("INSERT INTO dm_sequences (userId, etape, prochainEnvoi) VALUES (?, 0, ?) ON CONFLICT(userId) DO UPDATE SET etape = 0, prochainEnvoi = excluded.prochainEnvoi")
      .run(membre.id, Date.now());
  }

  // Base de données
  db.prepare("UPDATE onboarding SET statut = 'approuve', validateurId = ?, dateValidation = ? WHERE userId = ?")
    .run(interaction.user.id, Date.now(), userId);

  // DM de confirmation + bienvenue publique
  const dmOk = await dmSur(membre, TEXTES.dmApprouve(nomsAttribues.join(", ")));
  const general = salonTexte(guild, "general");
  const profilRow = db.prepare("SELECT roleDemande FROM onboarding WHERE userId = ?").get(userId) as { roleDemande: string } | undefined;
  const profilLabel = QUESTIONNAIRE.profils.find((p) => p.value === profilRow?.roleDemande)?.label ?? "Membre";
  if (general) await general.send(TEXTES.bienvenueGeneral(userId, profilLabel)).catch(() => {});

  await mettreAJourEmbed(interaction, messageId, "approuve", interaction.user.id);
  await interaction.editReply({
    content: `✅ <@${userId}> approuvé avec : ${nomsAttribues.join(", ")}.${dmOk ? "" : "\n⚠️ DM impossible (messages privés fermés)."}`,
    components: [],
  });
  await log(guild, "✅ Candidature approuvée", `<@${userId}> validé par <@${interaction.user.id}> — rôles : ${nomsAttribues.join(", ")}`, "succes");
}

/** [Refuser] → modal motif. */
export async function boutonRefuser(interaction: ButtonInteraction<"cached">): Promise<void> {
  if (!verifStaff(interaction)) {
    await interaction.reply({ content: "Réservé au Staff.", ephemeral: true });
    return;
  }
  const userId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setCustomId(`ob_rfm:${userId}:${interaction.message.id}`)
    .setTitle("Motif du refus")
    .addLabelComponents(
      new LabelBuilder().setLabel("Motif (envoyé au membre en DM)").setTextInputComponent(
        new TextInputBuilder().setCustomId("motif").setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

export async function modalRefus(interaction: ModalSubmitInteraction<"cached">): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const [, userId, messageId] = interaction.customId.split(":");
  const motif = interaction.fields.getTextInputValue("motif");

  db.prepare("UPDATE onboarding SET statut = 'refuse', validateurId = ?, dateValidation = ?, motifRefus = ? WHERE userId = ?")
    .run(interaction.user.id, Date.now(), motif, userId);

  const membre = await interaction.guild.members.fetch(userId).catch(() => null);
  const dmOk = membre ? await dmSur(membre, TEXTES.dmRefuse(motif)) : false;

  await mettreAJourEmbed(interaction, messageId, "refuse", interaction.user.id, motif);
  await interaction.editReply(`❌ Demande de <@${userId}> refusée.${dmOk ? "" : " ⚠️ DM impossible."}`);
  await log(interaction.guild, "❌ Candidature refusée", `<@${userId}> refusé par <@${interaction.user.id}> — motif : ${motif}`, "alerte");
}

/** [Plus d'infos] → modal question. */
export async function boutonPlusInfos(interaction: ButtonInteraction<"cached">): Promise<void> {
  if (!verifStaff(interaction)) {
    await interaction.reply({ content: "Réservé au Staff.", ephemeral: true });
    return;
  }
  const userId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setCustomId(`ob_mim:${userId}:${interaction.message.id}`)
    .setTitle("Demande d'infos complémentaires")
    .addLabelComponents(
      new LabelBuilder().setLabel("Ta question (envoyée au membre en DM)").setTextInputComponent(
        new TextInputBuilder().setCustomId("question").setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

export async function modalPlusInfos(interaction: ModalSubmitInteraction<"cached">): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const [, userId, messageId] = interaction.customId.split(":");
  const question = interaction.fields.getTextInputValue("question");

  db.prepare("UPDATE onboarding SET statut = 'infos' WHERE userId = ?").run(userId);
  const membre = await interaction.guild.members.fetch(userId).catch(() => null);
  const dmOk = membre ? await dmSur(membre, TEXTES.dmPlusInfos(question)) : false;

  await mettreAJourEmbed(interaction, messageId, "infos", interaction.user.id);
  await interaction.editReply(`❓ Question envoyée à <@${userId}>.${dmOk ? "" : " ⚠️ DM impossible."}`);
}

/** Met à jour l'embed de validation avec le statut et l'identité du validateur. */
async function mettreAJourEmbed(
  interaction: StringSelectMenuInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  messageId: string,
  statut: OnboardingRow["statut"],
  validateurId: string,
  motif?: string
): Promise<void> {
  const canal = salonTexte(interaction.guild, "validation");
  if (!canal) return;
  const message = await canal.messages.fetch(messageId).catch(() => null);
  if (!message || message.embeds.length === 0) return;

  const embed = EmbedBuilder.from(message.embeds[0]);
  const champs = message.embeds[0].fields.filter((f) => f.name !== "Statut");
  embed.setFields(
    ...champs,
    { name: "Statut", value: `${STATUTS_AFFICHES[statut]} — par <@${validateurId}>${motif ? `\n**Motif :** ${motif}` : ""}` }
  );
  embed.setColor(statut === "approuve" ? COULEURS.succes : statut === "refuse" ? COULEURS.erreur : COULEURS.alerte);

  // Demande traitée définitivement → on retire les boutons ; "infos" les conserve
  const composants = statut === "approuve" || statut === "refuse" ? [] : message.components;
  await message.edit({ embeds: [embed], components: composants as never }).catch(() => {});
}

// ---------- 4. Rappels et kick automatique des Non vérifiés ----------
export async function traiterNonVerifies(guildParam: import("discord.js").Guild): Promise<{ rappels: number; avertis: number; kicks: number }> {
  const guild = guildParam;
  const stats = { rappels: 0, avertis: 0, kicks: 0 };
  const nonVerifie = role(guild, "nonVerifie");
  if (!nonVerifie) return stats;

  await guild.members.fetch().catch(() => {});
  const maintenant = Date.now();

  for (const membre of nonVerifie.members.values()) {
    if (!membre.joinedTimestamp || membre.user.bot) continue;
    const heures = (maintenant - membre.joinedTimestamp) / 3_600_000;
    const jours = heures / 24;
    const suivi = db.prepare("SELECT * FROM rappels_verif WHERE userId = ?").get(membre.id) as { rappele: number; averti: number } | undefined;

    if (jours >= DELAIS.kickVerifJours) {
      // Kick après 7 jours (l'avertissement J-1 a été envoyé avant)
      await dmSur(membre, TEXTES.dmAvertissementKick);
      await membre.kick(TEXTES.raisonKick).catch(() => {});
      db.prepare("DELETE FROM rappels_verif WHERE userId = ?").run(membre.id);
      stats.kicks++;
      await log(guild, "👢 Kick automatique", `<@${membre.id}> retiré : ${TEXTES.raisonKick}.`, "alerte");
    } else if (jours >= DELAIS.avertissementKickJours && !suivi?.averti) {
      await dmSur(membre, TEXTES.dmAvertissementKick);
      db.prepare("INSERT INTO rappels_verif (userId, rappele, averti) VALUES (?, 1, 1) ON CONFLICT(userId) DO UPDATE SET averti = 1").run(membre.id);
      stats.avertis++;
    } else if (heures >= DELAIS.rappelVerifHeures && !suivi?.rappele) {
      await dmSur(membre, TEXTES.dmRappel48h);
      db.prepare("INSERT INTO rappels_verif (userId, rappele, averti) VALUES (?, 1, 0) ON CONFLICT(userId) DO UPDATE SET rappele = 1").run(membre.id);
      stats.rappels++;
    }
  }
  return stats;
}
