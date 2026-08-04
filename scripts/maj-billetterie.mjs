// Script one-shot : nettoie #billetterie (doublons d'embeds du bot) et poste
// UN seul message : lien officiel + mode d'emploi + bouton d'ouverture de ticket.
import "dotenv/config";
import { COULEURS, SALONS, TEXTES } from "../dist/config/config.js";

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
const me = await api("/users/@me");

// Supprime tous les anciens messages du bot (embeds + boutons en doublon)
const messages = await api(`/channels/${billetterie.id}/messages?limit=50`);
for (const m of messages.filter((m) => m.author.id === me.id)) {
  await api(`/channels/${billetterie.id}/messages/${m.id}`, { method: "DELETE" });
  console.log(`supprimé : "${m.embeds?.[0]?.title ?? m.content?.slice(0, 40) ?? "message"}"`);
  await new Promise((r) => setTimeout(r, 400));
}

// Poste LE message unique : lien + mode d'emploi + bouton ticket, épinglé
const nouveau = await api(`/channels/${billetterie.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    embeds: [{ title: TEXTES.billetterieTitre, description: TEXTES.billetterieCorps, color: COULEURS.primaire }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: TEXTES.boutonTicket, emoji: { name: "✉️" }, custom_id: "btn_ticket" }] }],
  }),
});
await api(`/channels/${billetterie.id}/pins/${nouveau.id}`, { method: "PUT" }).catch(() => {});
console.log("✅ Message unique billetterie posté et épinglé (lien + ticket)");
