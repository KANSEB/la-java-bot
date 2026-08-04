// Script one-shot : (re)poste le message avec bouton d'ouverture de ticket dans #billetterie.
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

const salons = await api(`/guilds/${GUILD}/channels`);
const billetterie = salons.find((c) => c.name === SALONS.billetterie);
if (!billetterie) throw new Error("Salon billetterie introuvable");

// Existe-t-il déjà un message du bot AVEC bouton ? (on ne vérifie plus juste l'embed)
const me = await api("/users/@me");
const messages = await api(`/channels/${billetterie.id}/messages?limit=20`);
const dejaLa = messages.find((m) => m.author.id === me.id && m.components?.length > 0);
if (dejaLa) {
  console.log("Le bouton ticket existe déjà, rien à faire.");
} else {
  await api(`/channels/${billetterie.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [{ title: TEXTES.billetterieTitre, description: TEXTES.billetterieCorps, color: COULEURS.info }],
      components: [{ type: 1, components: [{ type: 2, style: 1, label: TEXTES.boutonTicket, emoji: { name: "✉️" }, custom_id: "btn_ticket" }] }],
    }),
  });
  console.log("✅ Bouton d'ouverture de ticket posté dans #billetterie");
}
