// Script one-shot : met à jour le message épinglé « leveling » dans #general
// à partir de la config compilée (source de vérité unique).
import "dotenv/config";
import { PALIERS_XP, SALONS, XP } from "../dist/config/config.js";

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

const corps = [
  "Notre serveur récompense ton implication : plus tu participes, plus tu gagnes d'XP et débloques des avantages ! ⭐",
  "",
  "**Comment gagner de l'XP :**",
  `💬 **${XP.parMessageMin} à ${XP.parMessageMax} XP** par message (cooldown 60 s)`,
  `❤️ **${XP.parReaction} XP** par réaction (cooldown 5 min)`,
  `🎙 **${XP.vocalPointsParTranche} XP** toutes les ${XP.vocalTrancheMinutes} min en vocal`,
  `🙌 **${XP.shiftBenevole} XP** par shift bénévole validé`,
  "",
  "**Les paliers** (chacun donne un rôle coloré + ses avantages) :",
  ...PALIERS_XP.filter((p) => p.seuil > 0).map((p) => `**${p.seuil} XP · ${p.nom}**\n→ ${p.avantages.join(" • ")}`),
  "",
  "📊 Tape `/mon-profil` pour voir ton XP et `/classement` pour le top 20.",
  "Continue d'échanger, de partager et de faire vivre le serveur pour monter ! 🎪",
].join("\n");

const salons = await api(`/guilds/${GUILD}/channels`);
const general = salons.find((c) => c.name === SALONS.general);
if (!general) throw new Error("Salon general introuvable");

const epingles = await api(`/channels/${general.id}/pins`);
const me = await api("/users/@me");
const cible = epingles.find((m) => m.author.id === me.id && m.embeds?.[0]?.title?.includes("leveling"));
if (!cible) throw new Error("Message épinglé leveling introuvable");

await api(`/channels/${general.id}/messages/${cible.id}`, {
  method: "PATCH",
  body: JSON.stringify({ embeds: [{ title: cible.embeds[0].title, description: corps, color: 0xffd32a }] }),
});
console.log("✅ Message leveling mis à jour dans #general");
