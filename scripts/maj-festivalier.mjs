// Script one-shot : « Curieux - Public » devient « Festivalier », accès direct sans validation.
// 1. Option du questionnaire natif : titre Festivalier 🎉, rôle attribué = Membre (direct)
// 2. Membres actuellement "Candidat Curieux" : approuvés d'office (Membre, retrait attente/marqueur)
// 3. Suppression du rôle marqueur "Candidat Curieux"
import "dotenv/config";
import { PROFIL_DIRECT, ROLE_ATTENTE } from "../dist/config/config.js";

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

const roles = await api(`/guilds/${GUILD}/roles`);
const membre = roles.find((r) => r.name === "Membre");
const attente = roles.find((r) => r.name === ROLE_ATTENTE.nom);
const marqueurCurieux = roles.find((r) => r.name === "Candidat Curieux");

// ---------- 1. Option du questionnaire ----------
const ob = await api(`/guilds/${GUILD}/onboarding`);
const prompts = ob.prompts.map((p) => ({
  ...p,
  options: p.options.map((o) => {
    if (o.title !== "Curieux - Public" && o.title !== PROFIL_DIRECT.titre) return o;
    return { ...o, title: PROFIL_DIRECT.titre, emoji: { name: PROFIL_DIRECT.emoji }, role_ids: [membre.id], channel_ids: [] };
  }),
}));
await api(`/guilds/${GUILD}/onboarding`, {
  method: "PUT",
  body: JSON.stringify({ prompts, default_channel_ids: ob.default_channel_ids, enabled: true, mode: ob.mode }),
});
console.log(`✅ Option « ${PROFIL_DIRECT.titre} » ${PROFIL_DIRECT.emoji} : accès direct (rôle Membre)`);

// ---------- 2. Curieux en attente : approuvés d'office ----------
if (marqueurCurieux) {
  const membres = await api(`/guilds/${GUILD}/members?limit=1000`);
  const curieux = membres.filter((m) => m.roles.includes(marqueurCurieux.id));
  for (const m of curieux) {
    await api(`/guilds/${GUILD}/members/${m.user.id}/roles/${membre.id}`, { method: "PUT" });
    await api(`/guilds/${GUILD}/members/${m.user.id}/roles/${marqueurCurieux.id}`, { method: "DELETE" });
    if (attente && m.roles.includes(attente.id)) {
      await api(`/guilds/${GUILD}/members/${m.user.id}/roles/${attente.id}`, { method: "DELETE" });
    }
    console.log(`✅ ${m.user.username} : festivalier approuvé d'office`);
  }
  if (curieux.length === 0) console.log("(aucun Candidat Curieux en attente)");

  // ---------- 3. Suppression du marqueur ----------
  await api(`/guilds/${GUILD}/roles/${marqueurCurieux.id}`, { method: "DELETE" });
  console.log("✅ Rôle marqueur « Candidat Curieux » supprimé");
} else {
  console.log("(marqueur Candidat Curieux déjà absent)");
}
console.log("\n🎉 Festivaliers en accès direct !");
