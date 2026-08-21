// Script one-shot : le forum coordination-referents devient l'étagère des fiches.
// Un sujet par pôle, les PDF bénévole + référent attachés, les tags = les pôles.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SALONS } from "../dist/config/config.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID;
const DOSSIER = "C:/Users/canev/Downloads/files";
const ENTETES = { Authorization: `Bot ${TOKEN}` };
const api = (path, options = {}) =>
  fetch(`https://discord.com/api/v10${path}`, { ...options, headers: { ...ENTETES, ...(options.headers ?? {}) } })
    .then(async (r) => {
      if (r.status === 429) { const j = await r.json(); await new Promise((s) => setTimeout(s, (j.retry_after ?? 1) * 1000 + 100)); return api(path, options); }
      if (!r.ok) throw new Error(`${options.method ?? "GET"} ${path} -> ${r.status} ${await r.text()}`);
      return r.status === 204 ? null : r.json();
    });
const pause = (ms = 900) => new Promise((r) => setTimeout(r, ms));

const POLES = [
  { tag: "Bar", titre: "🍺 Bar", referents: "Malo, Matthieu, Mathilde", fichiers: ["Bar"],
    texte: "Servir vite et bien, encaisser, tenir le stand propre. Verre témoin pour le vin, appli caisse pour les calculs." },
  { tag: "Billetterie / Accueil", titre: "🎫 Billetterie / Accueil", referents: "Rémi, Oswald", fichiers: ["Billetterie-Accueil"],
    texte: "Premier contact du public : scanner, poser le bracelet, orienter. Jamais seul au poste." },
  { tag: "Cashless", titre: "🪙 Cashless", referents: "Mathieu, Nicolas", fichiers: ["Cashless"],
    texte: "Vendre les tickets, tenir la caisse. Tickets valables sur tous les bars, jamais remboursés." },
  { tag: "Déconsigne", titre: "♻️ Déconsigne", referents: "Natanaël", fichiers: ["Deconsigne"],
    texte: "Récupérer les gobelets, rembourser sur preuve, réapprovisionner les bars. Trois gobelets max par personne." },
  { tag: "Gestion du site", titre: "🧹 Gestion du site", referents: "Clément", fichiers: ["Gestion-Site"],
    texte: "Tours réguliers, propreté, signalétique, sécurité. On signale, on ne manipule jamais seul le matériel technique." },
  { tag: "Loges", titre: "🎤 Loges", referents: "Pauline", fichiers: ["Loges"],
    texte: "Accueillir les artistes, catering, propreté, contrôle des accès. Pas de photos, pas d'autographes." },
  { tag: "Merch", titre: "👕 Merch", referents: "Lucien, Angéline", fichiers: ["Merch"],
    texte: "Vendre, conseiller, tenir le stock et la caisse. Appli merch pour valider chaque vente." },
  { tag: "Prévention", titre: "💚 Prévention (RDR / VSS)", referents: "Sasha", fichiers: ["Prevention"],
    texte: "Informer et accompagner sans juger, distribuer le matériel de prévention. Code radio pour les situations VSS, confidentialité totale." },
  { tag: "Runs", titre: "🚗 Runs", referents: "Julien", fichiers: ["Runs"],
    texte: "Transport des artistes : gare, hôtel, sites. Confirmer le point de RDV, garder de la marge, zéro alcool. Canal talkie 4." },
  { tag: "Volant", titre: "🔁 Volant", referents: "Eloïse, Sasha", fichiers: ["Volant"], benevoleSeul: true,
    texte: "Renfort mobile, envoyé là où il manque quelqu'un. Se place sous les consignes du référent du pôle rejoint." },
];

const chs = await api(`/guilds/${GUILD}/channels`);
const forum = chs.find((c) => c.name === SALONS.coordination);
if (!forum) throw new Error("Forum coordination introuvable");

// 1. Tags = les pôles (+ Résolu pour clore une question)
const dejaLa = Object.fromEntries((forum.available_tags ?? []).map((t) => [t.name, t]));
const tagsVoulus = [...POLES.map((p) => p.tag), "Résolu"].map((n) => dejaLa[n] ?? { name: n });
const maj = await api(`/channels/${forum.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    available_tags: tagsVoulus,
    topic: "Un sujet par pôle : sa fiche bénévole et sa fiche référent en haut, les échanges du pôle en dessous.",
  }),
});
const tagId = Object.fromEntries(maj.available_tags.map((t) => [t.name, t.id]));
console.log(`✅ Tags du forum : ${maj.available_tags.map((t) => t.name).join(", ")}`);

// 2. Mode d'emploi du forum (réécrit dans le sujet existant)
const actifs = await api(`/guilds/${GUILD}/threads/active`);
const guide = (actifs.threads ?? []).find((t) => t.parent_id === forum.id && t.name.includes("Comment utiliser"));
const texteGuide = [
  "**🧭 Un sujet par pôle, et tout ce qui concerne le pôle dedans.**",
  "",
  "En haut de chaque sujet : la **fiche bénévole** (ce qu'on fait à son poste, à transmettre à ton équipe) et la **fiche référent** (ta mission, le setup, les points de vigilance).",
  "En dessous : questions, besoins, remontées du terrain, tout ce qui touche au pôle.",
  "",
  "📻 Talkie : canal 2 pour tout le monde, canal 1 pour joindre l'orga, canal 4 pour les runs.",
  "",
  "Les fiches contiennent les numéros des référents : elles restent entre nous, on ne les partage pas en dehors de l'équipe.",
].join("\n");
if (guide) {
  const ms = await api(`/channels/${guide.id}/messages?limit=5`);
  const premier = ms[ms.length - 1];
  await api(`/channels/${guide.id}/messages/${premier.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: texteGuide }),
  });
  await api(`/channels/${guide.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "🧭 Comment marche ce forum", applied_tags: [] }) });
  console.log("✅ Mode d'emploi du forum réécrit");
}

// 3. Un sujet par pôle, PDF attachés
const existants = new Set((actifs.threads ?? []).filter((t) => t.parent_id === forum.id).map((t) => t.name));
for (const p of POLES) {
  const existant = (actifs.threads ?? []).find((t) => t.parent_id === forum.id && t.name === p.titre);
  const form = new FormData();
  const pieces = [];
  let i = 0;
  for (const base of p.fichiers) {
    const versions = p.benevoleSeul ? ["Benevole"] : ["Benevole", "Referent"];
    for (const v of versions) {
      const nom = `Fiche-${v}-${base}.pdf`;
      const contenu = await readFile(join(DOSSIER, nom));
      form.append(`files[${i}]`, new Blob([contenu], { type: "application/pdf" }), nom);
      pieces.push({ id: i, filename: nom });
      i++;
    }
  }
  const contenu = [
    `**${p.titre.toUpperCase()}** · ${p.referents}`,
    p.texte,
    "",
    p.benevoleSeul ? "📎 Fiche bénévole (pas de fiche référent pour ce pôle)." : "📎 Fiche bénévole et fiche référent ci-dessous.",
  ].join("\n");
  form.append("payload_json", JSON.stringify({
    name: p.titre,
    applied_tags: tagId[p.tag] ? [tagId[p.tag]] : [],
    message: { content: contenu, attachments: pieces },
  }));
  if (existant) {
    // Sujet déjà là : on remplace le message de tête (texte + PDF), les échanges en dessous restent
    const ms = await api(`/channels/${existant.id}/messages?limit=100`);
    const tete = ms[ms.length - 1];
    const formMaj = new FormData();
    for (const [k, v] of form.entries()) if (k !== "payload_json") formMaj.append(k, v, v.name);
    formMaj.append("payload_json", JSON.stringify({ content: contenu, attachments: pieces }));
    await api(`/channels/${existant.id}/messages/${tete.id}`, { method: "PATCH", body: formMaj });
    await api(`/channels/${existant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applied_tags: tagId[p.tag] ? [tagId[p.tag]] : [] }) });
    console.log(`🔄 sujet mis à jour : ${p.titre} (${pieces.length} PDF)`);
  } else {
    await api(`/channels/${forum.id}/threads`, { method: "POST", body: form });
    console.log(`✅ sujet créé : ${p.titre} (${pieces.length} PDF)`);
  }
  await pause();
}
console.log("\n🧭 Le forum est devenu l'étagère des fiches.");
