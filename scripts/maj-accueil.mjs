// Script one-shot : met à jour l'embed de la charte dans #bienvenue
// (réutilise les textes compilés de dist/ — source de vérité unique : src/config/config.ts)
import "dotenv/config";
import { TEXTES, COULEURS, SALONS } from "../dist/config/config.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID;
const api = (path, options = {}) =>
  fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", ...options.headers },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`${options.method ?? "GET"} ${path} -> ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  });

// 1. Retrouver le salon #bienvenue
const salons = await api(`/guilds/${GUILD}/channels`);
const bienvenue = salons.find((c) => c.name === SALONS.bienvenue);
if (!bienvenue) throw new Error("Salon bienvenue introuvable");

// 2. Retrouver le message d'embed du bot
const me = await api("/users/@me");
const messages = await api(`/channels/${bienvenue.id}/messages?limit=20`);
const cible = messages.find((m) => m.author.id === me.id && m.embeds.length > 0);

const embed = { title: TEXTES.bienvenueTitre, description: TEXTES.bienvenueCorps, color: COULEURS.primaire };
if (cible) {
  await api(`/channels/${bienvenue.id}/messages/${cible.id}`, { method: "PATCH", body: JSON.stringify({ embeds: [embed] }) });
  console.log("✅ Charte mise à jour dans #bienvenue (message existant édité)");
} else {
  await api(`/channels/${bienvenue.id}/messages`, { method: "POST", body: JSON.stringify({ embeds: [embed] }) });
  console.log("✅ Charte postée dans #bienvenue (aucun message existant trouvé)");
}
