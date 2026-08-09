// Script one-shot : aligne le questionnaire natif sur la config.
// Retire les options obsolètes (Partenaire, dont le rôle a été supprimé, et
// Référent : on est nommé référent, on ne se déclare pas) et supprime les
// marqueurs devenus orphelins.
import "dotenv/config";
import { CANDIDATURES } from "../dist/config/config.js";

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
const idsValides = new Set(roles.map((r) => r.id));
// Profils encore proposés = ceux de la config, plus l'entrée grand public
const profilsGardes = new Set([...CANDIDATURES.map((c) => c.profil), "Festivalier"]);

const ob = await api(`/guilds/${GUILD}/onboarding`);
const prompts = ob.prompts.map((p) => {
  if (!p.title.toLowerCase().includes("profil")) return p;
  const options = p.options
    .filter((o) => profilsGardes.has(o.title))
    // Un rôle supprimé entre-temps ferait échouer la sauvegarde du questionnaire
    .map((o) => ({ ...o, role_ids: (o.role_ids ?? []).filter((id) => idsValides.has(id)) }));
  return { ...p, options };
});

const avant = ob.prompts.find((p) => p.title.toLowerCase().includes("profil"))?.options.length ?? 0;
const apres = prompts.find((p) => p.title.toLowerCase().includes("profil"))?.options.length ?? 0;

await api(`/guilds/${GUILD}/onboarding`, {
  method: "PUT",
  body: JSON.stringify({ prompts, default_channel_ids: ob.default_channel_ids, enabled: true, mode: ob.mode }),
});
console.log(`✅ Questionnaire : ${avant} options -> ${apres}`);
for (const o of prompts.find((p) => p.title.toLowerCase().includes("profil")).options) {
  console.log(`   • ${o.title}`);
}

// Marqueurs de candidature devenus inutiles
const marqueursUtiles = new Set(CANDIDATURES.map((c) => c.marqueur));
const membres = await api(`/guilds/${GUILD}/members?limit=200`);
for (const r of roles) {
  if (!r.name.startsWith("Candidat ") || marqueursUtiles.has(r.name)) continue;
  const porteurs = membres.filter((m) => m.roles.includes(r.id)).length;
  if (porteurs > 0) {
    console.log(`⏭ ${r.name} conservé (${porteurs} membre(s))`);
    continue;
  }
  await api(`/guilds/${GUILD}/roles/${r.id}`, { method: "DELETE" });
  console.log(`🗑 marqueur supprimé : ${r.name}`);
}
