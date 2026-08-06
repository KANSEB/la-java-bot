// Script one-shot : la réaction 🎪 devient la clé d'accès au serveur.
// 1. Le questionnaire natif n'attribue plus « Membre » aux festivaliers
//    (sinon ils entreraient sans jamais lire les règles)
// 2. Le message de bienvenue est réécrit, reçoit le bouton anniversaire
//    et la réaction 🎪 posée par le bot
import "dotenv/config";
import { ANNIVERSAIRES, COULEURS, SALONS, TEXTES } from "../dist/config/config.js";

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

const salons = await api(`/guilds/${GUILD}/channels`);
const salonParNom = (n) => salons.find((c) => c.name === n);
const bienvenue = salonParNom(SALONS.bienvenue);
const general = salonParNom(SALONS.general);
if (!bienvenue || !general) throw new Error("Salon bienvenue ou general introuvable");

// ---------- 1. Le questionnaire n'ouvre plus les portes tout seul ----------
const ob = await api(`/guilds/${GUILD}/onboarding`);
const prompts = ob.prompts.map((p) => ({
  ...p,
  options: p.options.map((o) => {
    // L'option grand public ne donne plus aucun rôle : c'est la réaction qui débloque.
    // Discord exige au moins un salon ou un rôle par option -> on pointe le général, déjà public.
    if (o.title === "Festivalier") return { ...o, role_ids: [], channel_ids: [general.id] };
    return o;
  }),
}));
await api(`/guilds/${GUILD}/onboarding`, {
  method: "PUT",
  body: JSON.stringify({ prompts, default_channel_ids: ob.default_channel_ids, enabled: true, mode: ob.mode }),
});
console.log("✅ Questionnaire : « Festivalier » n'attribue plus le rôle Membre");

// ---------- 2. Message de bienvenue : texte + bouton + réaction ----------
const me = await api("/users/@me");
const messages = await api(`/channels/${bienvenue.id}/messages?limit=20`);
const post = messages.find((m) => m.author.id === me.id && m.embeds.length > 0);

const corps = {
  embeds: [{ title: TEXTES.bienvenueTitre, description: TEXTES.bienvenueCorps, color: COULEURS.primaire }],
  components: [],
};

let postId;
if (post) {
  await api(`/channels/${bienvenue.id}/messages/${post.id}`, { method: "PATCH", body: JSON.stringify(corps) });
  postId = post.id;
  console.log("✅ Message de bienvenue mis à jour");
} else {
  const nouveau = await api(`/channels/${bienvenue.id}/messages`, { method: "POST", body: JSON.stringify(corps) });
  postId = nouveau.id;
  console.log("✅ Message de bienvenue créé");
}

await api(`/channels/${bienvenue.id}/messages/${postId}/reactions/${encodeURIComponent(TEXTES.emojiDeblocage)}/@me`, { method: "PUT" });
console.log(`✅ Réaction ${TEXTES.emojiDeblocage} posée : c'est elle qui ouvre le serveur`);

// ---------- 3. Bouton anniversaire dans le salon d'équipe ----------
const salonAnniv = salonParNom(SALONS[ANNIVERSAIRES.salonAnnonce]);
if (!salonAnniv) {
  console.log("⚠️ Salon d'équipe introuvable, bouton anniversaire non posé");
} else {
  const anciens = await api(`/channels/${salonAnniv.id}/messages?limit=30`);
  const dejaLa = anciens.find((m) => m.author.id === me.id && m.components?.length > 0);
  if (dejaLa) {
    console.log("ℹ️ Bouton anniversaire déjà présent dans le salon d'équipe");
  } else {
    const msg = await api(`/channels/${salonAnniv.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        embeds: [{ title: TEXTES.anniversaireTitreSalon, description: TEXTES.anniversaireCorpsSalon, color: COULEURS.primaire }],
        components: [{
          type: 1,
          components: [{ type: 2, style: 2, label: TEXTES.boutonAnniversaire, emoji: { name: "🎂" }, custom_id: "btn_anniversaire" }],
        }],
      }),
    });
    await api(`/channels/${salonAnniv.id}/pins/${msg.id}`, { method: "PUT" }).catch(() => {});
    console.log(`✅ Bouton anniversaire posé et épinglé dans ${salonAnniv.name}`);
  }
}

console.log("\n🎪 Nouveau parcours d'arrivée actif !");
