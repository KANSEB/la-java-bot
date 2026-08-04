// Script one-shot : exécute le provisioning complet (équivalent de /setup-serveur)
// sans passer par Discord — pratique après une modification de config.
import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { provisionner } from "../dist/setup/provision.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const rapport = await provisionner(guild);
    console.log("Rôles créés :", rapport.rolesCrees.join(", ") || "aucun");
    console.log("Salons créés :", rapport.salonsCrees.join(", ") || "aucun");
    console.log("Déjà existants :", rapport.existants);
  } catch (err) {
    console.error("Erreur provisioning :", err);
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
});
await client.login(process.env.DISCORD_TOKEN);
