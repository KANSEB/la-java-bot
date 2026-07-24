// ============================================================
// Mise à jour complète du serveur Discord La Java :
//   1. Renommage des salons (suppression des séparateurs ・)
//   2. Rôles : paliers XP renommés/créés + "⏳ En attente de validation"
//   3. Suppression du forum entraide-benevoles (doublon)
//   4. coordination-referents converti en forum
//   5. Création de #📌important (écriture réservée au fondateur)
//   6. Ouverture des salons publics (visibles des nouveaux arrivants)
//   7. Avantages des paliers XP (accès photos, Afters, archives, fils)
//   8. Messages épinglés explicatifs
//   9. Onboarding natif Discord (questionnaire d'arrivée)
//
// Usage :  npm run build && node scripts/serveur-maj.mjs           → dry-run
//          npm run build && node scripts/serveur-maj.mjs --apply   → applique
// ============================================================
import "dotenv/config";
import { COULEURS, PALIERS_XP, SALONS, TEXTES } from "../dist/config/config.js";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID;
const APPLY = process.argv.includes("--apply");

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

const act = async (description, fn) => {
  console.log(`${APPLY ? "▶" : "(dry-run)"} ${description}`);
  if (APPLY) return fn();
  return null;
};

// Permissions (bits)
const VIEW = 1024n, SEND = 2048n, CONNECT = 1048576n, THREADS_PUB = 34359738368n, THREADS_PRIV = 68719476736n;
const ov = (id, type, allow = 0n, deny = 0n) => ({ id, type, allow: allow.toString(), deny: deny.toString() });

const guild = await api(`/guilds/${GUILD}`);
const me = await api("/users/@me");
let roles = await api(`/guilds/${GUILD}/roles`);
let channels = await api(`/guilds/${GUILD}/channels`);
const roleParNom = (nom) => roles.find((r) => r.name === nom);
const salonParNom = (nom) => channels.find((c) => c.name === nom);
console.log(`Serveur : ${guild.name} — fondateur : ${guild.owner_id}\n`);

// ---------- 1. Renommage : alignement sur les noms de la config (avec ・) ----------
console.log("— 1. Renommage des salons —");
const normalise = (n) => n.replaceAll("・", "");
for (const c of channels) {
  const officiel = Object.values(SALONS).find((n) => normalise(n) === normalise(c.name));
  if (officiel && c.name !== officiel) {
    await act(`Renomme ${c.name} → ${officiel}`, () => api(`/channels/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: officiel }) }));
    c.name = officiel;
  }
}

// ---------- 1b. Suppression des salons sans intérêt ----------
console.log("\n— 1b. Salons supprimés —");
for (const motif of ["objets-trouves", "archives-editions", "verification"]) {
  const c = channels.find((ch) => ch.name.includes(motif));
  if (c) {
    await act(`Supprime ${c.name}`, () => api(`/channels/${c.id}`, { method: "DELETE" }));
    channels = channels.filter((ch) => ch.id !== c.id);
  } else console.log(`  (${motif} : déjà supprimé)`);
}

// ---------- 1c. vos-photos-videos : forum → salon texte simple ----------
const photosActuel = channels.find((c) => c.name.includes("vos-photos-videos"));
if (photosActuel && photosActuel.type !== 0) {
  console.log("\n— 1c. Photos en salon simple —");
  const nouveau = await act(`Recrée ${SALONS.photos} en salon texte (mêmes accès)`, async () => {
    const c = await api(`/guilds/${GUILD}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: SALONS.photos, type: 0, parent_id: photosActuel.parent_id, position: photosActuel.position,
        topic: "Vos plus beaux souvenirs en photo et vidéo",
        permission_overwrites: photosActuel.permission_overwrites,
      }),
    });
    await api(`/channels/${photosActuel.id}`, { method: "DELETE" });
    return c;
  });
  channels = channels.filter((c) => c.id !== photosActuel.id);
  if (nouveau) channels.push(nouveau);
}

// ---------- 2. Rôles ----------
console.log("\n— 2. Rôles paliers + validation —");
const RENOMMAGES_PALIERS = {
  "Nouveau": "Nouveau dans la Zone",
  "Habitué": "Premier Kick",
  "Pilier": "Pilier de Zone",
  "Légende de la Java": "Légende de La Java",
};
for (const [ancien, nouveau] of Object.entries(RENOMMAGES_PALIERS)) {
  const r = roleParNom(ancien);
  if (r && !roleParNom(nouveau)) {
    await act(`Renomme le rôle "${ancien}" → "${nouveau}"`, () => api(`/guilds/${GUILD}/roles/${r.id}`, { method: "PATCH", body: JSON.stringify({ name: nouveau }) }));
    r.name = nouveau;
  }
}
for (const p of PALIERS_XP) {
  if (!roleParNom(p.nom)) {
    const cree = await act(`Crée le rôle palier "${p.nom}"`, () =>
      api(`/guilds/${GUILD}/roles`, { method: "POST", body: JSON.stringify({ name: p.nom, color: p.couleur, permissions: "0" }) }));
    if (cree) roles.push(cree);
  }
}
// Le rôle "Non vérifié" appartenait à l'ancien système de vérification du bot
const obsolete = roleParNom("Non vérifié");
if (obsolete) {
  await act(`Supprime le rôle obsolète "Non vérifié"`, () => api(`/guilds/${GUILD}/roles/${obsolete.id}`, { method: "DELETE" }));
  roles = roles.filter((r) => r.id !== obsolete.id);
}

const ATTENTE = "⏳ En attente de validation";
if (!roleParNom(ATTENTE)) {
  const cree = await act(`Crée le rôle "${ATTENTE}"`, () =>
    api(`/guilds/${GUILD}/roles`, { method: "POST", body: JSON.stringify({ name: ATTENTE, color: 0x95a5a6, permissions: "0" }) }));
  if (cree) roles.push(cree);
}

// ---------- 3. Suppression du doublon entraide ----------
console.log("\n— 3. Doublon entraide-benevoles —");
const entraide = channels.find((c) => c.name.includes("entraide-benevoles"));
if (entraide) {
  await act(`Supprime le forum ${entraide.name} (doublon)`, () => api(`/channels/${entraide.id}`, { method: "DELETE" }));
  channels = channels.filter((c) => c.id !== entraide.id);
} else console.log("  (déjà supprimé)");

// ---------- 4. coordination-referents → forum ----------
console.log("\n— 4. Coordination en forum —");
const coordTexte = channels.find((c) => c.name.includes("coordination-referents") && c.type === 0);
if (coordTexte) {
  const forum = await act(`Crée le forum ${SALONS.coordination} (mêmes accès Référents/Staff)`, () =>
    api(`/guilds/${GUILD}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: SALONS.coordination, type: 15, parent_id: coordTexte.parent_id,
        topic: "Coordination des référents : un sujet par poste ou chantier",
        permission_overwrites: coordTexte.permission_overwrites,
        available_tags: ["Bar", "Entrée", "Camping", "Technique", "Sécu", "Autre", "Résolu"].map((t) => ({ name: t })),
      }),
    }));
  if (forum) channels.push(forum);
  const messages = APPLY ? await api(`/channels/${coordTexte.id}/messages?limit=1`) : [];
  if (!APPLY || messages.length === 0) {
    await act(`Supprime l'ancien salon texte ${coordTexte.name} (vide)`, () => api(`/channels/${coordTexte.id}`, { method: "DELETE" }));
    channels = channels.filter((c) => c.id !== coordTexte.id);
  } else {
    await act(`Renomme l'ancien salon en coordination-archive (des messages existent)`, () =>
      api(`/channels/${coordTexte.id}`, { method: "PATCH", body: JSON.stringify({ name: "🗄coordination-archive" }) }));
  }
} else console.log("  (déjà un forum)");

// ---------- 5. #📌important (fondateur uniquement) ----------
console.log("\n— 5. Salon #📌important —");
const catReferents = channels.find((c) => c.type === 4 && c.name.includes("RÉFÉRENTS"));
if (!salonParNom(SALONS.important) && catReferents) {
  const referent = roleParNom("Référent"), staff = roleParNom("Staff");
  await act(`Crée ${SALONS.important} — lecture Référents/Staff, écriture fondateur uniquement`, async () => {
    const c = await api(`/guilds/${GUILD}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: SALONS.important, type: 0, parent_id: catReferents.id,
        topic: "Les infos essentielles, lecture obligatoire. Seul le fondateur écrit ici.",
        permission_overwrites: [
          ov(GUILD, 0, 0n, VIEW),                    // caché à @everyone
          ov(referent.id, 0, VIEW, SEND),            // Référents : lecture seule
          ov(staff.id, 0, VIEW, SEND),               // Staff : lecture seule
          ov(guild.owner_id, 1, VIEW | SEND),        // Fondateur : écriture
          ov(me.id, 1, VIEW | SEND),                 // Le bot (épinglages)
        ],
      }),
    });
    channels.push(c);
  });
} else console.log("  (existe déjà)");

// ---------- 6. Ouverture des salons publics ----------
console.log("\n— 6. Ouverture au public —");
const LECTURE_SEULE = [SALONS.annonces, SALONS.lineUp, SALONS.actuServeur, SALONS.presse];
const OUVERTS = [SALONS.bienvenue, SALONS.general, SALONS.presentations, SALONS.billetterie, SALONS.hebergement];
const majOverwrite = async (salon, overwrite) =>
  api(`/channels/${salon.id}/permissions/${overwrite.id}`, { method: "PUT", body: JSON.stringify(overwrite) });
for (const nom of LECTURE_SEULE) {
  const c = salonParNom(nom);
  if (c) await act(`${nom} : visible de tous, lecture seule`, () => majOverwrite(c, ov(GUILD, 0, VIEW, SEND)));
}
for (const nom of OUVERTS) {
  const c = salonParNom(nom);
  if (c) await act(`${nom} : visible de tous, écriture ouverte`, () => majOverwrite(c, ov(GUILD, 0, VIEW | SEND)));
}

// ---------- 7. Avantages des paliers ----------
console.log("\n— 7. Avantages des paliers XP —");
const enfantFosse = () => roleParNom("Enfant de la Fosse");
const pilierZone = () => roleParNom("Pilier de Zone");
const legende = () => roleParNom("Légende de La Java");
const photos = salonParNom(SALONS.photos), afters = salonParNom(SALONS.vocalAfters), general = salonParNom(SALONS.general);
if (APPLY) {
  for (const [salon, rolesOk, droits] of [
    [photos, [enfantFosse(), pilierZone(), legende()], VIEW],
    [afters, [enfantFosse(), pilierZone(), legende()], VIEW | CONNECT],
  ]) {
    if (!salon) continue;
    for (const r of rolesOk.filter(Boolean)) {
      await act(`${salon.name} : accès pour "${r.name}"`, () => majOverwrite(salon, ov(r.id, 0, droits)));
    }
  }
  if (general && pilierZone() && legende()) {
    await act(`${general.name} : création de fils réservée à Pilier de Zone et +`, async () => {
      const actuel = (await api(`/channels/${general.id}`)).permission_overwrites.find((o) => o.id === GUILD);
      const deny = BigInt(actuel?.deny ?? 0) | THREADS_PUB | THREADS_PRIV;
      await majOverwrite(general, ov(GUILD, 0, BigInt(actuel?.allow ?? 0), deny));
      for (const r of [pilierZone(), legende(), roleParNom("Référent"), roleParNom("Staff")].filter(Boolean)) {
        await majOverwrite(general, ov(r.id, 0, THREADS_PUB));
      }
    });
  }
} else console.log("(dry-run) Accès photos/Afters/archives/fils selon les paliers");

// ---------- 7b. Forums : tags, sujets et permissions ----------
console.log("\n— 7b. Configuration des forums —");
const FORUMS = [
  {
    nom: SALONS.covoiturage, sujet: "Propose ou cherche un covoit' pour La Java. Un trajet = un post, pense aux tags !",
    tags: ["Je propose", "Je cherche", "Départ Paris", "Départ Quimper", "Départ Rennes", "Départ Nantes", "Complet"],
  },
  {
    nom: SALONS.demos, sujet: "Balance tes prods, demande des retours. Un morceau ou un set = un post.",
    tags: ["Techno", "House", "Bass", "Live", "DJ Set", "Feedback demandé"],
  },
  {
    nom: SALONS.coordination, sujet: "Coordination des référents : un sujet par poste ou chantier",
    tags: ["Bar", "Entrée", "Camping", "Technique", "Sécu", "Autre", "Résolu"],
  },
];
for (const f of FORUMS) {
  const c = salonParNom(f.nom);
  if (!c) { console.log(`  ⚠️ forum introuvable : ${f.nom}`); continue; }
  const patch = { topic: f.sujet };
  // On ne touche aux tags que s'ils manquent (les remplacer casserait les posts existants)
  if (!c.available_tags || c.available_tags.length === 0) patch.available_tags = f.tags.map((t) => ({ name: t }));
  await act(`${f.nom} : sujet${patch.available_tags ? " + tags (" + f.tags.join(", ") + ")" : ""}`, () =>
    api(`/channels/${c.id}`, { method: "PATCH", body: JSON.stringify(patch) }));
}
// Sujet du salon important (sans tiret quadratin)
const importantSalon = salonParNom(SALONS.important);
if (importantSalon) {
  await act(`${SALONS.important} : sujet mis à jour`, () =>
    api(`/channels/${importantSalon.id}`, { method: "PATCH", body: JSON.stringify({ topic: "Les infos essentielles, lecture obligatoire. Seul le fondateur écrit ici." }) }));
}

// ---------- 8. Messages épinglés ----------
console.log("\n— 8. Messages épinglés —");
async function epingler(nomSalon, embed) {
  const c = salonParNom(nomSalon);
  if (!c) return console.log(`  ⚠️ salon introuvable : ${nomSalon}`);
  await act(`Épingle « ${embed.title} » dans ${nomSalon}`, async () => {
    const messages = await api(`/channels/${c.id}/messages?limit=30`);
    // Match souple sur le début du titre : un titre reformulé met à jour le message existant
    const existant = messages.find((m) => m.author.id === me.id && m.embeds[0]?.title?.slice(0, 8) === embed.title.slice(0, 8));
    let msg = existant;
    if (existant) await api(`/channels/${c.id}/messages/${existant.id}`, { method: "PATCH", body: JSON.stringify({ embeds: [embed] }) });
    else msg = await api(`/channels/${c.id}/messages`, { method: "POST", body: JSON.stringify({ embeds: [embed] }) });
    if (!msg.pinned) await api(`/channels/${c.id}/pins/${msg.id}`, { method: "PUT" }).catch(() => {});
  });
}

const nomsPaliers = PALIERS_XP.map((p) => p.nom);
const levelingCorps = [
  "Notre serveur récompense ton implication : plus tu participes, plus tu gagnes d'XP et débloques des avantages ! ⭐",
  "",
  "**Comment gagner de l'XP :**",
  "💬 **15 à 40 XP** par message (cooldown 60 s)",
  "❤️ **25 XP** par réaction (cooldown 5 min)",
  "🎙 **10 XP** toutes les 10 min en vocal",
  "🙌 **50 XP** par shift bénévole validé",
  "",
  "**Les paliers** (chacun donne un rôle coloré + ses avantages) :",
  ...PALIERS_XP.filter((p) => p.seuil > 0).map((p) =>
    `**${p.seuil} XP · ${p.nom}**\n→ ${p.avantages.join(" • ")}`),
  "",
  "📊 Tape `/mon-profil` pour voir ton XP et `/classement` pour le top 20.",
  "Continue d'échanger, de partager et de faire vivre le serveur pour monter ! 🎪",
].join("\n");

await epingler(SALONS.bienvenue, { title: TEXTES.bienvenueTitre, description: TEXTES.bienvenueCorps, color: COULEURS.primaire });
await epingler(SALONS.general, { title: "⭐ Le leveling de La Java : comment ça marche ?", description: levelingCorps, color: 0xffd32a });
await epingler(SALONS.billetterie, {
  title: "🎟 Billetterie : mode d'emploi",
  description: "Les liens officiels de billetterie sont postés ici par l'équipe.\n\n**Une question, un souci de commande ?** Ouvre un ticket avec le bouton ci-dessous ou tape `/ticket` : un fil privé s'ouvre avec le Staff, personne d'autre ne voit vos échanges.\n\n⚠️ **Aucune revente hors canaux officiels** : les annonces de revente sauvage sont supprimées.",
  color: COULEURS.primaire,
});
await epingler(SALONS.benevoles, {
  title: "🙌 Bienvenue dans l'équipe bénévoles !",
  description: "Ce salon, c'est le QG des bénévoles : toutes les annonces internes passent ici.\n\n📅 **Ton planning et tes shifts** → salon planning-shifts (messages épinglés)\n🚐 **Covoiturage entre bénévoles** → salon covoit-benevoles\n🧭 **Une question ?** Pose-la ici, un référent ou le Staff te répond.\n\n**+50 XP à chaque shift validé** : de quoi grimper vite dans le classement 😉",
  color: 0x2ecc71,
});
await epingler(SALONS.planning, {
  title: "📅 Plannings & shifts : mode d'emploi",
  description: "Les plannings sont **épinglés dans ce salon** par l'équipe : tu y trouveras tes créneaux, ton poste et ton·ta référent·e.\n\n✅ Shift terminé ? Ton référent le valide et tu gagnes **+50 XP**.\n🔄 Besoin d'échanger un créneau ? Vois directement avec un·e autre bénévole puis préviens ton référent.",
  color: 0x2ecc71,
});
await epingler(SALONS.important, {
  title: "📌 Salon important : lecture obligatoire",
  description: "Ici, **seul le fondateur écrit** : uniquement l'essentiel, zéro bruit.\nChaque message posté dans ce salon doit être lu par tous les référents. Réagis avec ✅ quand c'est lu !",
  color: 0xe74c3c,
});

// Post d'accueil dans le forum coordination
const coordForum = channels.find((c) => c.name === SALONS.coordination && c.type === 15);
if (coordForum) {
  await act("Crée le post d'accueil du forum coordination", async () => {
    const threads = await api(`/guilds/${GUILD}/threads/active`).catch(() => ({ threads: [] }));
    const existant = (threads.threads ?? []).find((t) => t.parent_id === coordForum.id && t.name.startsWith("🧭 Comment utiliser"));
    if (existant) return;
    await api(`/channels/${coordForum.id}/threads`, {
      method: "POST",
      body: JSON.stringify({
        name: "🧭 Comment utiliser ce forum",
        message: { content: "**Un sujet = un poste ou un chantier** (bar, entrée, camping, technique…).\nUtilise les tags pour t'y retrouver et marque **Résolu** quand c'est réglé.\nLes discussions générales entre référents restent dans remontees-terrain." },
      }),
    });
  });
}

// ---------- 9. Onboarding natif ----------
console.log("\n— 9. Onboarding natif Discord —");
const PROFILS = [
  { titre: "Bénévole", emoji: "🙌", valider: true },
  { titre: "Référent", emoji: "🧭", valider: true },
  { titre: "Artiste programmé", emoji: "🎤", valider: true },
  { titre: "Artiste (communauté)", emoji: "🎧", valider: true },
  { titre: "Partenaire", emoji: "🤝", valider: true },
  { titre: "Curieux - Public", emoji: "👀", valider: false },
];
const SOURCES = [
  { titre: "Instagram", emoji: "📷" },
  { titre: "TikTok", emoji: "🎵" },
  { titre: "Bouche à oreille", emoji: "🗣️" },
  { titre: "Le site de La Java", emoji: "🌐" },
  { titre: "Sur place, à une édition", emoji: "🎪" },
  { titre: "Un artiste", emoji: "🎧" },
  { titre: "La newsletter", emoji: "📬" },
  { titre: "Autre", emoji: "✨" },
];
const membre = roleParNom("Membre"), attente = roleParNom(ATTENTE);
const publics = [...LECTURE_SEULE, ...OUVERTS].map((n) => salonParNom(n)).filter(Boolean);
const generalPublic = salonParNom(SALONS.general);
console.log(`Salons par défaut : ${publics.length} (minimum 7) — profils validés à la main : ${PROFILS.filter((p) => p.valider).map((p) => p.titre).join(", ")}`);
await act("Active le questionnaire d'arrivée (2 questions : profil + source)", () =>
  api(`/guilds/${GUILD}/onboarding`, {
    method: "PUT",
    body: JSON.stringify({
      prompts: [
        {
          id: "0", // id fictif exigé par l'API (remplacé par Discord à la création)
          type: 0, single_select: true, required: true, in_onboarding: true,
          title: "Quel est ton profil à La Java ? 🎪",
          options: PROFILS.map((p, i) => ({
            id: String(i + 1),
            title: p.titre,
            emoji: { name: p.emoji },
            // Profils sensibles → rôle "En attente", le Staff attribue le vrai rôle ensuite
            role_ids: [p.valider ? attente.id : membre.id],
            channel_ids: [],
          })),
        },
        {
          id: "100",
          type: 0, single_select: true, required: true, in_onboarding: true,
          title: "Où as-tu connu La Java ? 👀",
          // Chaque option doit donner accès à au moins un salon ou rôle :
          // on pointe vers le général, déjà public, donc aucun effet de bord
          options: SOURCES.map((so, i) => ({
            id: String(101 + i),
            title: so.titre,
            emoji: { name: so.emoji },
            role_ids: [],
            channel_ids: [generalPublic.id],
          })),
        },
      ],
      default_channel_ids: publics.map((c) => c.id),
      enabled: true,
      mode: 0,
    }),
  }));

console.log(APPLY ? "\n✅ Serveur mis à jour !" : "\n(dry-run terminé — relance avec --apply pour appliquer)");
