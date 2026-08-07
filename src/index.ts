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
import { rattraperReactionsAcces, signalerDemandeValidation } from "./services/onboarding.js";
import { poserBarriere, roleParNom } from "./services/util.js";
import { ROLE_ATTENTE } from "./config/config.js";
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
  // Reaction/User : nécessaires pour l'XP sur les réactions aux messages non mis en cache
  partials: [Partials.Message, Partials.GuildMember, Partials.Channel, Partials.Reaction, Partials.User],
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

  // Rattrapage : candidatures en attente jamais signalées au Staff (bot hors ligne, bug...)
  try {
    await guild.members.fetch();
    const attente = roleParNom(guild, ROLE_ATTENTE.nom);
    let signalees = 0;
    if (attente) {
      for (const membre of attente.members.values()) {
        await signalerDemandeValidation(membre); // dédupliqué en interne via kv
        signalees++;
      }
    }
    console.log(`[onboarding] rattrapage : ${signalees} candidature(s) en attente vérifiée(s)`);

    // Réactions 🎪 posées pendant la coupure : Discord ne les rejoue pas
    const acces = await rattraperReactionsAcces(guild);
    console.log(`[acces] rattrapage : ${acces} membre(s) débloqué(s) via la réaction 🎪`);

    // Barrière : les arrivées survenues bot éteint n'ont pas été bloquées.
    // Après le rattrapage ci-dessus, pour ne jamais masquer le serveur à
    // quelqu'un qui avait bien accepté les règles pendant la coupure.
    let barrieres = 0;
    for (const membre of guild.members.cache.values()) {
      const avant = membre.roles.cache.size;
      await poserBarriere(membre);
      if (membre.roles.cache.size !== avant) barrieres++;
    }
    console.log(`[acces] barrière posée sur ${barrieres} membre(s) n'ayant pas accepté les règles`);
  } catch (err) {
    console.error("rattrapage candidatures :", err);
  }
});

// Filets de sécurité : le bot ne crashe jamais sur une promesse oubliée
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

void client.login(TOKEN);
