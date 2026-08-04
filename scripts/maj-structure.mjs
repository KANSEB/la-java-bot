// Script one-shot : renomme les salons aux émojis mal rendus,
// supprime covoiturage (forum) et hebergement-camping (demandé par le Staff),
// puis laisse scripts/provision.mjs recréer ce qui manque.
import "dotenv/config";

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
const parNom = (nom) => salons.find((c) => c.name === nom);

// Renommages : ancien nom -> nouveau nom
const RENOMMAGES = [
  ["🎛・line-up", "🎵・line-up"],
  ["📰・actu-serveur", "🔔・actu-serveur"],
  ["🗞・presse-et-retombees", "📰・presse-et-retombees"],
  ["🎟・billetterie", "🎫・billetterie"],
  ["🗄・archives-editions", "📦・archives-editions"],
  ["🎚・infos-artistes", "🎹・infos-artistes"],
  ["🛡・staff-general", "🔒・staff-general"],
  ["🛡 STAFF", "🔒 STAFF"],
];
// ⚠️ ordre : actu-serveur d'abord (libère 📰 pour presse) — déjà le cas ci-dessus

for (const [ancien, nouveau] of RENOMMAGES) {
  const c = parNom(ancien);
  if (!c) { console.log(`(déjà fait ?) introuvable : ${ancien}`); continue; }
  await api(`/channels/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: nouveau }) });
  console.log(`renommé : ${ancien} -> ${nouveau}`);
}

// Suppressions demandées : forum covoiturage (remplacé par un salon texte) + hébergement festivaliers
for (const nom of ["🚗・covoiturage", "⛺・hebergement-camping"]) {
  const c = parNom(nom);
  if (!c) { console.log(`(déjà fait ?) introuvable : ${nom}`); continue; }
  await api(`/channels/${c.id}`, { method: "DELETE" });
  console.log(`supprimé : ${nom}`);
}
console.log("✅ Structure mise à jour — lance provision.mjs pour recréer covoiturage (texte) et hebergement-benevoles");
