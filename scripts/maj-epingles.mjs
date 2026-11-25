// Republie tous les messages épinglés depuis la configuration.
// À lancer après toute modification de textes : garantit qu'aucun message
// affiché ne diverge de la config, sans jamais créer de doublon.
import "dotenv/config";
import { SALONS, TEXTES, COULEURS, ANNIVERSAIRES } from "../dist/config/config.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID;
const api = (path, options = {}) =>
  fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", ...options.headers },
  }).then(async (r) => {
    if (r.status === 429) {
      const retry = (await r.json()).retry_after ?? 1;
      await new Promise((res) => setTimeout(res, retry * 1000 + 100));
      return api(path, options);
    }
    if (!r.ok) throw new Error(`${options.method ?? "GET"} ${path} -> ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  });

const chs = await api(`/guilds/${GUILD}/channels`);
const me = await api("/users/@me");
const bouton = (label, emoji, id) => ({ type: 1, components: [{ type: 2, style: 2, label, emoji: { name: emoji }, custom_id: id }] });

// `repere` sert à retrouver le message quand son titre a changé
const CIBLES = [
  { salon: SALONS.bienvenue, repere: "Bienvenue", titre: TEXTES.bienvenueTitre, corps: TEXTES.bienvenueCorps, couleur: COULEURS.primaire },
  { salon: SALONS.presentations, repere: "Présente-toi", titre: TEXTES.presentationTitre, corps: TEXTES.presentationCorps, couleur: COULEURS.info },
  { salon: SALONS.billetterie, repere: "Billetterie", titre: TEXTES.billetterieTitre, corps: TEXTES.billetterieCorps, couleur: COULEURS.primaire,
    composants: [bouton(TEXTES.boutonTicket, "✉️", "btn_ticket")] },
  { salon: SALONS[ANNIVERSAIRES.salonAnnonce], repere: "anniversaires", titre: TEXTES.anniversaireTitreSalon, corps: TEXTES.anniversaireCorpsSalon, couleur: COULEURS.primaire,
    composants: [bouton(TEXTES.boutonAnniversaire, "🎂", "btn_anniversaire")] },
  { salon: SALONS.guide, repere: "Discord pour les débutants", titre: TEXTES.guideDiscordTitre, corps: TEXTES.guideDiscordCorps, couleur: COULEURS.info },
  { salon: SALONS.guide, repere: "Ce serveur", titre: TEXTES.guideServeurTitre, corps: TEXTES.guideServeurCorps, couleur: COULEURS.primaire },
];

for (const c of CIBLES) {
  const salon = chs.find((x) => x.name === c.salon);
  if (!salon) { console.log(`⚠️ salon introuvable : ${c.salon}`); continue; }
  if (c.corps === undefined) { console.log(`⚠️ texte absent de la config : ${c.repere}`); continue; }

  const messages = await api(`/channels/${salon.id}/messages?limit=50`);
  const cible = messages.find((m) => m.author.id === me.id && (m.embeds?.[0]?.title ?? "").includes(c.repere));
  const corps = { embeds: [{ title: c.titre, description: c.corps, color: c.couleur }], ...(c.composants ? { components: c.composants } : {}) };

  if (cible) {
    await api(`/channels/${salon.id}/messages/${cible.id}`, { method: "PATCH", body: JSON.stringify(corps) });
    console.log(`✅ ${c.salon} :: ${c.titre}`);
  } else {
    const m = await api(`/channels/${salon.id}/messages`, { method: "POST", body: JSON.stringify(corps) });
    await api(`/channels/${salon.id}/pins/${m.id}`, { method: "PUT" }).catch(() => {});
    console.log(`✨ ${c.salon} :: ${c.titre} (créé)`);
  }
  await new Promise((r) => setTimeout(r, 400));
}

