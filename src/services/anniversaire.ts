// ============================================================
// Anniversaire saisi par bouton + formulaire (pas de commande à taper).
// RGPD : jour et mois uniquement, jamais l'année de naissance.
// ============================================================

import {
  ButtonInteraction,
  LabelBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "../db/database.js";
import { TEXTES } from "../config/config.js";

// Février à 29 jours : on accepte le 29/02, l'annonce tombera les années bissextiles
const JOURS_PAR_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export async function ouvrirModalAnniversaire(interaction: ButtonInteraction<"cached">): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("modal_anniversaire")
    .setTitle(TEXTES.anniversaireTitre)
    .addLabelComponents(
      new LabelBuilder().setLabel(TEXTES.anniversaireLabelJour).setTextInputComponent(
        new TextInputBuilder().setCustomId("jour").setStyle(TextInputStyle.Short)
          .setPlaceholder("15").setMinLength(1).setMaxLength(2).setRequired(true)
      ),
      new LabelBuilder().setLabel(TEXTES.anniversaireLabelMois).setTextInputComponent(
        new TextInputBuilder().setCustomId("mois").setStyle(TextInputStyle.Short)
          .setPlaceholder("3").setMinLength(1).setMaxLength(2).setRequired(true)
      )
    );
  await interaction.showModal(modal);
}

export async function enregistrerAnniversaire(interaction: ModalSubmitInteraction<"cached">): Promise<void> {
  const jour = Number(interaction.fields.getTextInputValue("jour").trim());
  const mois = Number(interaction.fields.getTextInputValue("mois").trim());

  const valide =
    Number.isInteger(jour) && Number.isInteger(mois) &&
    mois >= 1 && mois <= 12 &&
    jour >= 1 && jour <= JOURS_PAR_MOIS[mois - 1];

  if (!valide) {
    await interaction.reply({ content: TEXTES.anniversaireInvalide, ephemeral: true });
    return;
  }

  db.prepare(`
    INSERT INTO anniversaires (userId, jour, mois) VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET jour = excluded.jour, mois = excluded.mois
  `).run(interaction.user.id, jour, mois);

  await interaction.reply({ content: TEXTES.anniversaireEnregistre(jour, mois), ephemeral: true });
}
