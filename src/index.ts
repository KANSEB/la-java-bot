// ============================================================
// Point d'entrée du bot La Java.
// Charge la config, la base, les commandes, les événements, les crons,
// puis enregistre les slash commands sur le serveur.
// ============================================================

import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { assertEnv } from "./services/util.js";
import "./db/database.js"; // initialise la base + migrations au chargement
import { demarrerCrons, majCountdown } from "./services/crons.js";
import { enregistrerEvenements } from "./events/index.js";
import type { Commande } from "./commands/types.js";

import { commandes as cmdSetup } from "./commands/setup.js";
import { commandes as cmdOnboarding } from "./commands/onboarding-admin.js";
import { commandes as cmdBadges } from "./commands/badges.js";
import { commandes as cmdXp } from "./commands/xp.js";
import { commandes as cmdAnniv } from "./commands/anniversaires.js";
import { commandes as cmdCommunaute } from "./commands/communaute.js";
import { commandes as cmdModeration } from "./commands/moderation.js";

const TOKEN = assertEnv("DISCORD_TOKEN");
const GUILD_ID = assertEnv("GUILD_ID");

// ---------- Registre des commandes ----------
const toutes: Commande[] = [
  ...cmdSetup, ...cmdOnboarding, ...cmdBadges, ...cmdXp, ...cmdAnniv, ...cmdCommunaute, ...cmdModeration,
];
const registre = new Map<string, Commande>(toutes.map((c) => [c.data.name, c]));

// ---------- Client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // arrivées, rôles, kick auto (intent privilégié)
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,    // filtre liens + XP (intent privilégié)
    GatewayIntentBits.GuildVoiceStates,  // XP vocal
    GatewayIntentBits.GuildMessageReactions, // sondages
  ],
  partials: [Partials.Message, Partials.GuildMember, Partials.Channel],
});

enregistrerEvenements(client, registre);

client.once("clientReady", async () => {
  // Enregistrement des slash commands (scopées au serveur : mise à jour instantanée)
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`⚠️ Serveur ${GUILD_ID} introuvable — le bot est-il bien invité dessus ?`);
    return;
  }
  await guild.commands.set(toutes.map((c) => c.data.toJSON()));
  console.log(`[commandes] ${toutes.length} slash commands enregistrées sur ${guild.name}`);

  demarrerCrons(client);
  // Compte à rebours mis à jour dès le démarrage (sans attendre le cron de 9h)
  await majCountdown(guild).catch((err) => console.error("countdown initial :", err));
});

// Filets de sécurité : le bot ne crashe jamais sur une promesse oubliée
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

void client.login(TOKEN);
