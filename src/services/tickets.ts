// ============================================================
// Tickets support billetterie : thread privé membre ↔ Staff,
// fermeture avec transcript archivé dans #logs-bot.
// ============================================================

import {
  AttachmentBuilder,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  ThreadAutoArchiveDuration,
  ThreadChannel,
} from "discord.js";
import { TEXTES } from "../config/config.js";
import { estStaff, role, salonTexte } from "./util.js";
import { log } from "./logs.js";

const PREFIXE_TICKET = "ticket-";

export async function ouvrirTicket(interaction: ButtonInteraction<"cached">): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const billetterie = salonTexte(guild, "billetterie");
  if (!billetterie) {
    await interaction.editReply("⚠️ Salon billetterie introuvable — préviens le Staff.");
    return;
  }

  // Un seul ticket ouvert à la fois par membre
  const actifs = await billetterie.threads.fetchActive().catch(() => null);
  const existant = actifs?.threads.find((t) => t.name === `${PREFIXE_TICKET}${interaction.user.id}`);
  if (existant) {
    await interaction.editReply(`Tu as déjà un ticket ouvert : <#${existant.id}>`);
    return;
  }

  const thread = await billetterie.threads.create({
    name: `${PREFIXE_TICKET}${interaction.user.id}`,
    type: ChannelType.PrivateThread,
    autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
    invitable: false,
    reason: `Ticket support de ${interaction.user.username}`,
  });
  await thread.members.add(interaction.user.id).catch(() => {});

  const staff = role(guild, "staff");
  await thread.send(TEXTES.ticketOuvert(interaction.user.id, staff?.id ?? ""));
  await interaction.editReply(`✉️ Ton ticket est ouvert : <#${thread.id}>`);
  await log(guild, "🎟 Ticket ouvert", `<@${interaction.user.id}> a ouvert un ticket : <#${thread.id}>`);
}

/** /fermer-ticket — dans un thread ticket uniquement. Transcript → #logs-bot. */
export async function fermerTicket(interaction: ChatInputCommandInteraction<"cached">): Promise<void> {
  const canal = interaction.channel;
  if (!canal || !canal.isThread() || !canal.name.startsWith(PREFIXE_TICKET)) {
    await interaction.reply({ content: "Cette commande s'utilise dans un ticket.", ephemeral: true });
    return;
  }
  const thread = canal as ThreadChannel;
  const proprietaireId = thread.name.slice(PREFIXE_TICKET.length);
  if (!estStaff(interaction.member) && interaction.user.id !== proprietaireId) {
    await interaction.reply({ content: "Seul le Staff ou l'auteur du ticket peut le fermer.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  // Transcript complet (ordre chronologique)
  const lignes: string[] = [`Transcript du ticket ${thread.name} — fermé le ${new Date().toLocaleString("fr-FR")}`];
  let avant: string | undefined;
  for (;;) {
    const lot = await thread.messages.fetch({ limit: 100, ...(avant ? { before: avant } : {}) }).catch(() => null);
    if (!lot || lot.size === 0) break;
    for (const m of lot.values()) {
      lignes.push(`[${new Date(m.createdTimestamp).toLocaleString("fr-FR")}] ${m.author.username} : ${m.content || "(embed/fichier)"}`);
    }
    avant = lot.last()?.id;
    if (lot.size < 100) break;
  }
  lignes.reverse(); // fetch renvoie du plus récent au plus ancien

  const fichier = new AttachmentBuilder(Buffer.from(lignes.join("\n"), "utf-8"), { name: `${thread.name}-transcript.txt` });
  const logs = salonTexte(interaction.guild, "logs");
  if (logs) {
    await logs.send({
      content: `📄 Transcript du ticket de <@${proprietaireId}> (fermé par <@${interaction.user.id}>)`,
      files: [fichier],
    }).catch(() => {});
  }

  await interaction.editReply(TEXTES.ticketFerme);
  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true, "Ticket fermé").catch(() => {});
}
