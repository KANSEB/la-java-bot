// ============================================================
// Point d'entrée du bot La Java.
// Charge la config, la base, les commandes, les événements, les crons,
// puis enregistre les slash commands sur le serveur.
// ============================================================

import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { assertEnv } from "./services/util.js";
import { kvGet, kvSet } from "./db/database.js"; // initialise aussi la base + migrations
import { demarrerCrons, gererReclamationBadge, majCountdown } from "./services/crons.js";
import { debloquerCharteAcceptee, rattraperReactionsAcces, signalerDemandeValidation } from "./services/onboarding.js";
import { resynchroniserPaliers } from "./services/xp.js";
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
  // La fenêtre du badge se vérifie aussi au démarrage : le cron de 9h est loin
  await gererReclamationBadge(guild).catch((err) => console.error("réclamation badge :", err));

  // Rattrapage : candidatures en attente jamais signalées à l'orga (bot hors ligne, bug...)
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
    const charte = await debloquerCharteAcceptee(guild);
    console.log(`[acces] ${charte} membre(s) ouvert(s) : charte acceptée, barrière encore posée`);


    // Migration unique (22/08/2026) : le badge Java 2026 était posé dès la
    // validation d'un bénévole, avec ses 500 XP. Il a été retiré à tout le monde
    // pour n'être réclamé qu'après le festival. Ces membres ont déjà touché l'XP :
    // on le note pour que la réclamation ne la verse pas une seconde fois.
    if (kvGet("migration:badge2026_xp") !== "1") {
      const dejaPayes = ["1540342557282668594", "1538900413498265610", "1538486955162210364", "1537064723600777237", "1536845076288774196", "1536129442416566345", "1536011711373516851", "1535729809668178040", "1535290728043913226", "1535275868648243233", "1535272898489483345", "1421229584011100173", "1391356608977571900", "1341118729542565888", "1330100419384316058", "1324843445566705714", "776871429181800448", "698275303864139876", "695239350027288596", "455398081547075584", "453600923143503872", "432640162296627201", "420593594311639041", "347359961635880962"];
      for (const id of dejaPayes) kvSet(`badge_xp:2026:${id}`, "1");
      kvSet("migration:badge2026_xp", "1");
      console.log(`[migration] XP du badge 2026 déjà versée pour ${dejaPayes.length} membre(s), notée`);
    }

    // Les seuils XP peuvent avoir changé depuis le dernier démarrage
    const paliers = await resynchroniserPaliers(guild);
    console.log(`[xp] paliers resynchronisés : ${paliers} membre(s) corrigé(s)`);

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
