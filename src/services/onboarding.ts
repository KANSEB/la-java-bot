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
import { db, kvDel, kvGet, kvSet, type OnboardingRow } from "../db/database.js";
import {
  CANDIDATURES, COULEURS, DELAIS, EDITION, QUESTIONNAIRE, ROLE_ATTENTE, ROLES, SALONS, SEUIL_COMPTE_RECENT_JOURS, TEXTES,
} from "../config/config.js";
import { ageCompteJours, dmSur, estStaff, horodatage, role, roleParNom, salonTexte } from "./util.js";
import { log, logErreur } from "./logs.js";
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

// ---------- 2b. Candidatures via l'onboarding natif Discord ----------
/** Candidature (profil demandé) détectée via les rôles marqueurs du questionnaire natif. */
export function candidatureDe(membre: GuildMember): (typeof CANDIDATURES)[number] | undefined {
  return CANDIDATURES.find((c) => {
    const r = roleParNom(membre.guild, c.marqueur);
    return r !== undefined && membre.roles.cache.has(r.id);
  });
}

/** Retire le rôle d'attente et tous les marqueurs de candidature. */
export async function nettoyerCandidature(membre: GuildMember): Promise<void> {
  const aRetirer = [ROLE_ATTENTE.nom, ...CANDIDATURES.map((c) => c.marqueur)];
  for (const nom of aRetirer) {
    const r = roleParNom(membre.guild, nom);
    if (r && membre.roles.cache.has(r.id)) {
      await membre.roles.remove(r.id, "Candidature traitée").catch(() => {});
    }
  }
  // Dossier clos : le verrou anti-doublon doit sauter, sinon une seconde
  // candidature (après un refus) ne serait jamais signalée au Staff.
  kvDel(`attente_notifie:${membre.id}`);
}

/**
 * Poste la demande de validation dans #validation-demandes dès qu'un membre
 * reçoit le rôle d'attente (questionnaire natif rempli). Dédupliqué via kv.
 */
export async function signalerDemandeValidation(membre: GuildMember): Promise<void> {
  const guild = membre.guild;
  if (kvGet(`attente_notifie:${membre.id}`) === "1") return;
  // Repli sur staff-general si le salon de validation a été renommé ou supprimé :
  // une candidature ne doit jamais disparaître en silence.
  const canal = salonTexte(guild, "validation") ?? salonTexte(guild, "staffGeneral");
  if (!canal) {
    console.error(`[onboarding] salons ${SALONS.validation} / ${SALONS.staffGeneral} introuvables : candidature de ${membre.user.username} non signalée.`);
    return;
  }

  const candidature = candidatureDe(membre);
  const age = ageCompteJours(membre.user);
  const reglesLues = kvGet(`regles:${membre.id}`) === "1";

  // Trace en base pour /stats et /export-onboarding
  db.prepare(`
    INSERT INTO onboarding (userId, username, dateSubmission, source, motivation, roleDemande, pseudo, statut, nbSoumissions)
    VALUES (?, ?, ?, 'onboarding_discord', '', ?, NULL, 'en_attente', 1)
    ON CONFLICT(userId) DO UPDATE SET username = excluded.username, dateSubmission = excluded.dateSubmission,
      roleDemande = excluded.roleDemande, statut = 'en_attente'
  `).run(membre.id, membre.user.username, Date.now(), candidature?.profil ?? "inconnu");

  const embed = new EmbedBuilder()
    .setTitle("📋 Nouvelle candidature")
    .setColor(COULEURS.info)
    .setThumbnail(membre.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `<@${membre.id}> (${membre.user.username})`, inline: true },
      { name: "Profil demandé", value: candidature ? `${candidature.emoji} ${candidature.profil}` : "❔ Inconnu", inline: true },
      { name: "Règles (réaction 🎪)", value: reglesLues ? "✅ Acceptées" : "⏳ Pas encore", inline: true },
      { name: "Compte créé", value: `${horodatage(membre.user.createdTimestamp)}${age < SEUIL_COMPTE_RECENT_JOURS ? "\n⚠️ **Compte de moins de 7 jours**" : ""}`, inline: true },
      { name: "Arrivé sur le serveur", value: membre.joinedTimestamp ? horodatage(membre.joinedTimestamp) : "?", inline: true },
      { name: "Statut", value: STATUTS_AFFICHES.en_attente }
    )
    .setFooter({ text: `userId:${membre.id}` })
    .setTimestamp();

  const boutons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ob_apd:${membre.id}`).setLabel(candidature ? `Approuver « ${candidature.profil} »` : "Approuver (Membre)").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ob_ap:${membre.id}`).setLabel("Autres rôles").setEmoji("🎭").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ob_rf:${membre.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ob_mi:${membre.id}`).setLabel("Plus d'infos").setEmoji("❓").setStyle(ButtonStyle.Secondary)
  );

  // Le ping du rôle Staff est ce qui déclenche la notification Discord : sans lui
  // l'embed arrive en silence dans le salon et personne ne le voit passer.
  const staff = role(guild, "staff");
  try {
    await canal.send({
      content: TEXTES.nouvelleCandidature(membre.id, staff?.id),
      embeds: [embed],
      components: [boutons],
      allowedMentions: { roles: staff ? [staff.id] : [] },
    });
  } catch (err) {
    // Verrou non posé : le rattrapage au prochain démarrage réessaiera.
    await logErreur(guild, `signalement de la candidature de ${membre.user.username} dans #${canal.name}`, err);
    return;
  }
  kvSet(`attente_notifie:${membre.id}`, "1");
  await log(guild, "📥 Nouvelle candidature", `<@${membre.id}> a rempli le questionnaire (profil : ${candidature?.profil ?? "inconnu"}).`);
}

/** [Approuver « profil »] : attribution en un clic du profil demandé dans le questionnaire. */
export async function approuverProfilDemande(interaction: ButtonInteraction<"cached">): Promise<void> {
  if (!verifStaff(interaction)) {
    await interaction.reply({ content: "Réservé au Staff.", ephemeral: true });
    return;
  }
  if (kvGet("lockdown") === "1") {
    await interaction.reply({ content: TEXTES.lockdownOn, ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.customId.split(":")[1];
  const guild = interaction.guild;
  const membre = await guild.members.fetch(userId).catch(() => null);
  if (!membre) {
    await interaction.editReply("⚠️ Ce membre n'est plus sur le serveur.");
    return;
  }

  // Garde anti-double traitement (deux Staff qui cliquent, vieil embed résiduel...)
  const dossier = db.prepare("SELECT statut FROM onboarding WHERE userId = ?").get(userId) as { statut: string } | undefined;
  if (dossier?.statut === "approuve") {
    await interaction.editReply("✅ Cette candidature a déjà été approuvée.");
    return;
  }

  const candidature = candidatureDe(membre);
  const rolesAAjouter: string[] = [];
  const membreRole = role(guild, "membre");
  if (membreRole) rolesAAjouter.push(membreRole.id);
  const nomsAttribues: string[] = membreRole ? [membreRole.name] : [];
  if (candidature?.roleKey) {
    const r = role(guild, candidature.roleKey);
    if (r) {
      rolesAAjouter.push(r.id);
      nomsAttribues.push(r.name);
    }
  }

  try {
    await membre.roles.add(rolesAAjouter, "Candidature approuvée");
  } catch (err) {
    await interaction.editReply(`⚠️ Impossible d'attribuer les rôles (le rôle du bot doit être au-dessus). ${err instanceof Error ? err.message : ""}`);
    return;
  }
  await nettoyerCandidature(membre);

  const estBenevole = candidature?.roleKey === "benevoleEdition";
  const estArtiste = candidature?.roleKey === "artiste";
  if (estBenevole || estArtiste) await attribuerBadge(membre, EDITION.annee).catch(() => {});
  if (estBenevole) {
    db.prepare("INSERT INTO dm_sequences (userId, etape, prochainEnvoi) VALUES (?, 0, ?) ON CONFLICT(userId) DO UPDATE SET etape = 0, prochainEnvoi = excluded.prochainEnvoi")
      .run(membre.id, Date.now());
  }

  db.prepare("UPDATE onboarding SET statut = 'approuve', validateurId = ?, dateValidation = ? WHERE userId = ?")
    .run(interaction.user.id, Date.now(), userId);

  const dmOk = await dmSur(membre, TEXTES.dmApprouve(nomsAttribues.join(", ")));
  // Message de bienvenue : une seule fois par membre, avec le vrai profil attribué
  const profilAffiche = candidature?.profil ?? nomsAttribues.find((n) => n !== "Membre") ?? "Membre";
  const general = salonTexte(guild, "general");
  if (general && kvGet(`bienvenue:${userId}`) !== "1") {
    await general.send(TEXTES.bienvenueGeneral(userId, profilAffiche)).catch(() => {});
    kvSet(`bienvenue:${userId}`, "1");
  }

  await mettreAJourEmbed(interaction, interaction.message.id, "approuve", interaction.user.id);
  await interaction.editReply(`✅ <@${userId}> approuvé avec : ${nomsAttribues.join(", ")}.${dmOk ? "" : "\n⚠️ DM impossible (messages privés fermés)."}`);
  await log(guild, "✅ Candidature approuvée", `<@${userId}> validé par <@${interaction.user.id}> — rôles : ${nomsAttribues.join(", ")}`, "succes");
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

  // Garde anti-double traitement (deux Staff qui cliquent, vieil embed résiduel...)
  const dossier = db.prepare("SELECT statut FROM onboarding WHERE userId = ?").get(userId) as { statut: string } | undefined;
  if (dossier?.statut === "approuve") {
    await interaction.editReply({ content: "✅ Cette candidature a déjà été approuvée.", components: [] });
    return;
  }

  // Attribution : Membre (toujours) + rôles choisis
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
    await nettoyerCandidature(membre);
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

  // DM de confirmation + bienvenue publique (une seule fois, avec le vrai rôle attribué)
  const dmOk = await dmSur(membre, TEXTES.dmApprouve(nomsAttribues.join(", ")));
  const profilLabel = nomsAttribues.find((n) => n !== ROLES.membre.nom) ?? ROLES.membre.nom;
  const general = salonTexte(guild, "general");
  if (general && kvGet(`bienvenue:${userId}`) !== "1") {
    await general.send(TEXTES.bienvenueGeneral(userId, profilLabel)).catch(() => {});
    kvSet(`bienvenue:${userId}`, "1");
  }

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
  if (membre) await nettoyerCandidature(membre);

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
  interaction: ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached"> | ModalSubmitInteraction<"cached">,
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

// ---------- 3b. Rattrapage des réactions d'accès ----------
/**
 * Discord ne rejoue pas les réactions posées pendant que le bot était hors ligne
 * (redémarrage, mise à jour...). Au démarrage on relit donc la liste des membres
 * ayant réagi 🎪 sur le post de bienvenue et on donne le rôle Membre à ceux qui
 * ne l'ont pas : sans ça, ils resteraient bloqués dehors sans comprendre pourquoi.
 */
export async function rattraperReactionsAcces(guild: import("discord.js").Guild): Promise<number> {
  const bienvenue = salonTexte(guild, "bienvenue");
  const membreRole = role(guild, "membre");
  if (!bienvenue || !membreRole) return 0;

  const messages = await bienvenue.messages.fetch({ limit: 20 }).catch(() => null);
  const post = messages?.find((m) => m.author.id === guild.client.user.id && m.embeds.length > 0);
  const reaction = post?.reactions.cache.find((r) => r.emoji.name === TEXTES.emojiDeblocage);
  if (!reaction) return 0;

  const utilisateurs = await reaction.users.fetch().catch(() => null);
  if (!utilisateurs) return 0;

  let ajoutes = 0;
  for (const user of utilisateurs.values()) {
    if (user.bot) continue;
    const membre = await guild.members.fetch(user.id).catch(() => null);
    if (!membre || membre.roles.cache.has(membreRole.id)) continue;
    await membre.roles.add(membreRole.id, "Rattrapage : réaction 🎪 posée hors ligne").catch(() => {});
    kvSet(`regles:${membre.id}`, "1");
    ajoutes++;
  }
  if (ajoutes > 0) {
    await log(guild, "🎪 Accès rattrapés", `${ajoutes} membre(s) avaient réagi pendant une coupure du bot : rôle Membre attribué.`, "succes");
  }
  return ajoutes;
}

// ---------- 4. Rappels et kick automatique des Non vérifiés ----------
