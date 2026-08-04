// Script one-shot : bascule le serveur en mode "tout le monde postule".
// 1. Crée les rôles marqueurs de candidature (Candidat Bénévole, etc.)
// 2. Reconfigure le questionnaire natif : CHAQUE profil → ⏳ En attente + marqueur
// 3. Salons publics en lecture seule pour les non-validés (Membre peut écrire)
// 4. Met à jour le post de bienvenue et y ajoute la réaction 🎪
import "dotenv/config";
import { CANDIDATURES, COULEURS, ROLE_ATTENTE, SALONS, TEXTES } from "../dist/config/config.js";

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

let roles = await api(`/guilds/${GUILD}/roles`);
const channels = await api(`/guilds/${GUILD}/channels`);
const roleParNom = (nom) => roles.find((r) => r.name === nom);
const salonParNom = (nom) => channels.find((c) => c.name === nom);

// ---------- 1. Rôles marqueurs ----------
for (const c of CANDIDATURES) {
  if (roleParNom(c.marqueur)) { console.log(`(existe) ${c.marqueur}`); continue; }
  const r = await api(`/guilds/${GUILD}/roles`, {
    method: "POST",
    body: JSON.stringify({ name: c.marqueur, permissions: "0", color: 0x99aab5, hoist: false, mentionable: false }),
  });
  roles.push(r);
  console.log(`✅ rôle créé : ${c.marqueur}`);
}
const attente = roleParNom(ROLE_ATTENTE.nom);
if (!attente) throw new Error(`Rôle introuvable : ${ROLE_ATTENTE.nom}`);

// ---------- 2. Questionnaire natif : tout profil → attente + marqueur ----------
const onboarding = await api(`/guilds/${GUILD}/onboarding`);
const prompts = onboarding.prompts.map((p) => {
  const estProfil = p.title.toLowerCase().includes("profil");
  return {
    ...p,
    options: p.options.map((o) => {
      if (!estProfil) return { ...o, role_ids: o.role_ids ?? [], channel_ids: o.channel_ids ?? [] };
      const cand = CANDIDATURES.find((c) => o.title.toLowerCase().startsWith(c.profil.split(" ")[0].toLowerCase()) && (c.profil === o.title || o.title.includes(c.profil) || c.profil.includes(o.title)));
      const marqueur = cand ? roleParNom(cand.marqueur) : null;
      return { ...o, role_ids: [attente.id, ...(marqueur ? [marqueur.id] : [])], channel_ids: [] };
    }),
  };
});
// Salons par défaut reconstruits depuis les salons publics existants (min 7 exigé par Discord)
const PUBLICS = [SALONS.bienvenue, SALONS.annonces, SALONS.lineUp, SALONS.actuServeur, SALONS.presse, SALONS.general, SALONS.presentations, SALONS.billetterie];
const defaults = PUBLICS.map((n) => salonParNom(n)).filter(Boolean).map((c) => c.id);
console.log(`Salons par défaut valides : ${defaults.length}`);
await api(`/guilds/${GUILD}/onboarding`, {
  method: "PUT",
  body: JSON.stringify({ prompts, default_channel_ids: defaults, enabled: true, mode: onboarding.mode }),
});
console.log("✅ Questionnaire natif : chaque profil donne ⏳ En attente + son marqueur");

// ---------- 3. Lecture seule pour les non-validés ----------
const SEND = 2048n, VIEW = 1024n, REACT = 64n;
const membre = roleParNom("Membre");
for (const nom of [SALONS.general, SALONS.presentations]) {
  const c = salonParNom(nom);
  if (!c || !membre) continue;
  await api(`/channels/${c.id}/permissions/${GUILD}`, {
    method: "PUT",
    body: JSON.stringify({ type: 0, allow: VIEW.toString(), deny: SEND.toString() }), // @everyone : voit, n'écrit pas
  });
  await api(`/channels/${c.id}/permissions/${membre.id}`, {
    method: "PUT",
    body: JSON.stringify({ type: 0, allow: (VIEW | SEND).toString(), deny: "0" }),
  });
  console.log(`✅ ${nom} : lecture pour tous, écriture réservée aux Membres validés`);
}

// ---------- 4. Post de bienvenue : nouveau texte + réaction 🎪 ----------
const bienvenue = salonParNom(SALONS.bienvenue);
const me = await api("/users/@me");
const messages = await api(`/channels/${bienvenue.id}/messages?limit=20`);
const post = messages.find((m) => m.author.id === me.id && m.embeds.length > 0);
const embed = { title: TEXTES.bienvenueTitre, description: TEXTES.bienvenueCorps, color: COULEURS.primaire };
let postId;
if (post) {
  await api(`/channels/${bienvenue.id}/messages/${post.id}`, { method: "PATCH", body: JSON.stringify({ embeds: [embed] }) });
  postId = post.id;
  console.log("✅ Post de bienvenue mis à jour");
} else {
  const nouveau = await api(`/channels/${bienvenue.id}/messages`, { method: "POST", body: JSON.stringify({ embeds: [embed] }) });
  postId = nouveau.id;
  console.log("✅ Post de bienvenue créé");
}
// Autorise les réactions des non-validés dans #bienvenue et pose la réaction 🎪
await api(`/channels/${bienvenue.id}/permissions/${GUILD}`, {
  method: "PUT",
  body: JSON.stringify({ type: 0, allow: (VIEW | REACT).toString(), deny: SEND.toString() }),
});
await api(`/channels/${bienvenue.id}/messages/${postId}/reactions/${encodeURIComponent(TEXTES.emojiDeblocage)}/@me`, { method: "PUT" });
console.log("✅ Réaction 🎪 posée sur le post de bienvenue");
console.log("\n🎉 Mode « tout le monde postule » activé !");
