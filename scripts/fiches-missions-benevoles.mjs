// Ouvre un sujet par pôle dans le forum 📋・fiches-missions (catégorie BÉNÉVOLES).
// Le message de tête pose le décor (pôle, référents, mission en une phrase) et
// laisse la place à la fiche : c'est la responsable qui l'attache ensuite.
//
// Relançable sans risque : un sujet déjà là voit son message de tête réécrit,
// les réponses en dessous et les pièces jointes ajoutées à la main sont
// conservées. Seuls les sujets manquants sont créés.
//
// Usage :  npm run build && node scripts/fiches-missions-benevoles.mjs           → dry-run
//          npm run build && node scripts/fiches-missions-benevoles.mjs --apply   → applique
import "dotenv/config";
import { SALONS } from "../dist/config/config.js";
import { POLES } from "./poles.mjs";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID;
const APPLY = process.argv.includes("--apply");
if (!TOKEN || !GUILD) throw new Error("DISCORD_TOKEN et GUILD_ID doivent être dans le .env");

const api = (path, options = {}) =>
  fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: { Authorization: `Bot ${TOKEN}`, ...(options.headers ?? {}) },
  }).then(async (r) => {
    if (r.status === 429) {
      const j = await r.json();
      await new Promise((s) => setTimeout(s, (j.retry_after ?? 1) * 1000 + 100));
      return api(path, options);
    }
    if (!r.ok) throw new Error(`${options.method ?? "GET"} ${path} -> ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  });
const json = (methode, body) => ({ method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const pause = (ms = 900) => new Promise((r) => setTimeout(r, ms));

const chs = await api(`/guilds/${GUILD}/channels`);
const forum = chs.find((c) => c.name === SALONS.fichesMissions);
if (!forum) throw new Error(`Forum ${SALONS.fichesMissions} introuvable : lance /setup-serveur d'abord.`);

// 1. Tags : ceux de la config, complétés si le forum en a perdu
const dejaLa = Object.fromEntries((forum.available_tags ?? []).map((t) => [t.name, t]));
const manquants = POLES.map((p) => p.tag).filter((n) => !dejaLa[n]);
let tags = forum.available_tags ?? [];
if (manquants.length > 0) {
  console.log(`${APPLY ? "▶" : "(dry-run)"} Ajoute les tags manquants : ${manquants.join(", ")}`);
  if (APPLY) {
    const maj = await api(`/channels/${forum.id}`, json("PATCH", {
      available_tags: [...tags, ...manquants.map((name) => ({ name }))],
    }));
    tags = maj.available_tags;
  }
} else {
  console.log(`Tags déjà en place : ${tags.map((t) => t.name).join(", ")}`);
}
const tagId = Object.fromEntries(tags.map((t) => [t.name, t.id]));

// 2. Un sujet par pôle
const actifs = await api(`/guilds/${GUILD}/threads/active`);
const duForum = (actifs.threads ?? []).filter((t) => t.parent_id === forum.id);

const enTete = (p) =>
  [
    `**${p.titre.toUpperCase()}**`,
    `Référent·es : ${p.referents}`,
    "",
    p.texte,
    "",
    "📎 **La fiche mission de ce pôle sera attachée ici.**",
    "Une question sur le poste ? Pose-la en réponse dans ce sujet, tu auras la réponse au même endroit que tout le monde.",
  ].join("\n");

let crees = 0, majs = 0;
for (const p of POLES) {
  const existant = duForum.find((t) => t.name === p.titre);
  const applique = tagId[p.tag] ? [tagId[p.tag]] : [];

  if (existant) {
    console.log(`${APPLY ? "🔄" : "(dry-run) 🔄"} sujet existant, message de tête réécrit : ${p.titre}`);
    if (APPLY) {
      // Le message de tête d'un sujet de forum porte l'id du sujet lui-même
      await api(`/channels/${existant.id}/messages/${existant.id}`, json("PATCH", { content: enTete(p) }));
      await api(`/channels/${existant.id}`, json("PATCH", { applied_tags: applique }));
    }
    majs++;
  } else {
    console.log(`${APPLY ? "✅" : "(dry-run) ✅"} sujet créé : ${p.titre}  [tag ${p.tag}]`);
    if (APPLY) {
      await api(`/channels/${forum.id}/threads`, json("POST", {
        name: p.titre,
        applied_tags: applique,
        message: { content: enTete(p) },
      }));
    }
    crees++;
  }
  if (APPLY) await pause();
}

console.log(
  APPLY
    ? `\n📋 Terminé : ${crees} sujet(s) créé(s), ${majs} mis à jour. Il ne reste qu'à attacher les fiches.`
    : `\n(dry-run terminé : ${crees} à créer, ${majs} à mettre à jour. Relance avec --apply pour appliquer.)`
);
