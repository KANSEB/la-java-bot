// ============================================================
// Journalisation centralisée dans #logs-bot.
// Ne lève JAMAIS d'exception : un log qui échoue ne casse rien.
// ============================================================

import { EmbedBuilder, Guild } from "discord.js";
import { COULEURS } from "../config/config.js";
import { salonTexte } from "./util.js";

type NiveauLog = "info" | "succes" | "erreur" | "alerte";

const COULEUR_PAR_NIVEAU: Record<NiveauLog, number> = {
  info: COULEURS.info,
  succes: COULEURS.succes,
  erreur: COULEURS.erreur,
  alerte: COULEURS.alerte,
};

export async function log(guild: Guild, titre: string, description: string, niveau: NiveauLog = "info"): Promise<void> {
  try {
    const canal = salonTexte(guild, "logs");
    if (!canal) return;
    const embed = new EmbedBuilder()
      .setTitle(titre)
      .setDescription(description.slice(0, 4000))
      .setColor(COULEUR_PAR_NIVEAU[niveau])
      .setTimestamp();
    await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error("[logs] impossible d'écrire dans #logs-bot :", err);
  }
}

/** Log console + #logs-bot pour les erreurs runtime. */
export async function logErreur(guild: Guild | null, contexte: string, err: unknown): Promise<void> {
  console.error(`[erreur] ${contexte} :`, err);
  if (guild) {
    const msg = err instanceof Error ? err.message : String(err);
    await log(guild, "⚠️ Erreur bot", `**Contexte :** ${contexte}\n\`\`\`${msg.slice(0, 1000)}\`\`\``, "erreur");
  }
}
