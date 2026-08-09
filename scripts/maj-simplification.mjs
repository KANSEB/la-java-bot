// Script one-shot : simplification demandée par le Staff.
// 1. #presentations passe du public à la catégorie BÉNÉVOLES
// 2. Salons par défaut de l'onboarding réajustés (minimum 7 exigé par Discord)
// 3. Rôles supprimés : Bénévole du Mois, Bénévole Vétéran
// 4. « Bénévole » devient « Ancien bénévole » (fini la confusion avec Bénévole 2026)
import "dotenv/config";
import { SALONS, STRUCTURE } from "../dist/config/config.js";

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
const pause = () => new Promise((r) => setTimeout(r, 450));

const chs = await api(`/guilds/${GUILD}/channels`);
const parNom = (n) => chs.find((c) => c.name === n);
const presentations = parNom(SALONS.presentations);
const guide = parNom(SALONS.guide);

// ---------- 1. Salons par défaut : Discord refuse un salon non visible de tous ----------
// À faire AVANT de restreindre #presentations, sinon la sauvegarde échoue.
const ob = await api(`/guilds/${GUILD}/onboarding`);
let defauts = ob.default_channel_ids.filter((id) => id !== presentations?.id);
if (guide && !defauts.includes(guide.id)) defauts.push(guide.id);
if (defauts.length < 7) {
  console.log(`⚠️ ${defauts.length} salons par défaut : Discord en exige 7, on garde la configuration actuelle`);
} else {
  await api(`/guilds/${GUILD}/onboarding`, {
    method: "PUT",
    body: JSON.stringify({ prompts: ob.prompts, default_channel_ids: defauts, enabled: true, mode: ob.mode }),
  });
  console.log(`✅ Salons par défaut : ${defauts.length} (présentations retiré, guide ajouté)`);
}

// ---------- 2. Déplacement de #presentations ----------
const catBenevoles = STRUCTURE.find((c) => c.salons.some((s) => s.cle === "presentations"))?.nom;
const categorie = chs.find((c) => c.type === 4 && c.name === catBenevoles);
if (presentations && categorie) {
  await api(`/channels/${presentations.id}`, { method: "PATCH", body: JSON.stringify({ parent_id: categorie.id }) });
  console.log(`✅ ${presentations.name} déplacé dans « ${categorie.name} »`);
  await pause();
} else {
  console.log("⚠️ Salon présentations ou catégorie bénévoles introuvable");
}

// ---------- 3. Rôles supprimés ----------
const roles = await api(`/guilds/${GUILD}/roles`);
const membres = await api(`/guilds/${GUILD}/members?limit=200`);
const porteurs = (id) => membres.filter((m) => m.roles.includes(id)).length;
for (const nom of ["Bénévole du Mois", "Bénévole Vétéran"]) {
  const r = roles.find((x) => x.name === nom);
  if (!r) { console.log(`(déjà absent) ${nom}`); continue; }
  if (porteurs(r.id) > 0) { console.log(`⏭ ${nom} conservé (${porteurs(r.id)} membre(s))`); continue; }
  await api(`/guilds/${GUILD}/roles/${r.id}`, { method: "DELETE" });
  console.log(`🗑 rôle supprimé : ${nom}`);
  await pause();
}

// ---------- 4. Renommage du rôle alumni ----------
const alumni = roles.find((r) => r.name === "Bénévole");
if (alumni) {
  await api(`/guilds/${GUILD}/roles/${alumni.id}`, { method: "PATCH", body: JSON.stringify({ name: "Ancien bénévole" }) });
  console.log("✅ « Bénévole » renommé « Ancien bénévole »");
} else {
  console.log("(déjà renommé) Ancien bénévole");
}

console.log("\n➡️ Lance maintenant scripts/provision.mjs pour resynchroniser les permissions et poster les infos pratiques.");
