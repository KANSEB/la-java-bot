// ============================================================
// CONFIGURATION CENTRALE : La Java (Dans La Zone, Quimper)
// Tout se règle ici : rôles, salons, textes, XP, délais.
// Aucune chaîne visible par l'utilisateur ne doit être en dur ailleurs.
// ============================================================

import { PermissionFlagsBits as P } from "discord.js";

// ---------- Édition en cours ----------
export const EDITION = {
  annee: 2026,
  nom: "La Java 2026",
  // Date de l'événement (ISO) : pilote le compte à rebours et l'auto-archivage covoiturage
  dateEvenement: "2026-08-28",
  villesDepart: ["Paris", "Quimper", "Rennes", "Nantes"],
  lienBilletterie: "https://www.billetweb.fr/la-java-ete-festival",
};

// ---------- Rôles fonctionnels (ordre hiérarchique, du plus haut au plus bas) ----------
export interface RoleConfig {
  nom: string;
  couleur: number;
  hoist: boolean;
  mentionnable: boolean;
  permissions: bigint[];
}

export const ROLES: Record<string, RoleConfig> = {
  staff: {
    nom: "Staff",
    couleur: 0xe74c3c,
    hoist: true,
    mentionnable: true,
    // Admin partiel : PAS de ManageGuild ni ManageRoles (gestion serveur/rôles réservée aux fondateurs)
    permissions: [
      P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages,
      P.ManageThreads, P.ManageNicknames, P.MuteMembers, P.DeafenMembers,
      P.MoveMembers, P.MentionEveryone, P.ViewAuditLog,
    ],
  },
  referent: {
    nom: "Référent",
    couleur: 0xe67e22,
    hoist: true,
    mentionnable: true,
    permissions: [P.ManageMessages, P.ModerateMembers],
  },
  artiste: { nom: "Artiste", couleur: 0x9b59b6, hoist: true, mentionnable: true, permissions: [] },
  artisteCommunaute: { nom: "Artiste Communauté", couleur: 0xb388eb, hoist: false, mentionnable: true, permissions: [] },
  partenaire: { nom: "Partenaire", couleur: 0x1abc9c, hoist: false, mentionnable: true, permissions: [] },
  benevoleEdition: { nom: `Bénévole ${EDITION.annee}`, couleur: 0x2ecc71, hoist: true, mentionnable: true, permissions: [] },
  benevole: { nom: "Bénévole", couleur: 0x27ae60, hoist: false, mentionnable: true, permissions: [] },
  benevoleVeteran: { nom: "Bénévole Vétéran", couleur: 0xf1c40f, hoist: false, mentionnable: true, permissions: [] },
  membre: { nom: "Membre", couleur: 0x3498db, hoist: false, mentionnable: false, permissions: [] },
};

// ---------- Rôles cosmétiques ----------
// Badges d'édition, cumulables. `nomBadge(annee)` sert aussi pour les années passées/futures.
export const nomBadge = (annee: number): string => `Java ${annee}`;
export const BADGES: Record<number, { couleur: number }> = {
  2026: { couleur: 0xff6b9d },
  2025: { couleur: 0x54c6eb },
  2024: { couleur: 0xffc75f },
};

// Paliers XP (seuil croissant). Le rôle du palier atteint remplace le précédent.
// Paliers de leveling (inspirés du système Château Perché) : chaque palier
// donne un rôle coloré + des avantages. Les avantages "salons" (Afters,
// photos…) sont posés en overwrites par scripts/serveur-maj.mjs ; les
// avantages "humains" (billetterie en avance, giveaways) sont gérés par le Staff.
export const PALIERS_XP: { seuil: number; nom: string; couleur: number; avantages: string[] }[] = [
  { seuil: 0, nom: "Nouveau", couleur: 0xbdc3c7, avantages: [] },
  {
    seuil: 150, nom: "Habitué", couleur: 0x74b9ff,
    avantages: ["Participation aux sondages communautaires", "Annonces et line-up en avant-première (48h avant les réseaux)"],
  },
  {
    seuil: 500, nom: "Fêtard", couleur: 0xa29bfe,
    avantages: ["Accès au vocal Afters", "Accès au salon vos-photos-videos"],
  },
  {
    seuil: 1500, nom: "Pilier de la Java", couleur: 0xe67e22,
    avantages: ["Billetterie en avance (48h)", "Giveaways merch", "Création de fils de discussion"],
  },
  {
    seuil: 4000, nom: "Légende de la Java", couleur: 0xffd32a,
    avantages: ["Tarif préférentiel sur nos autres événements", "Ton nom au panthéon du serveur"],
  },
];

export const ROLE_BENEVOLE_DU_MOIS = { nom: "Bénévole du Mois", couleur: 0xff3f34 };

// Rôle posé par l'onboarding natif Discord sur TOUTE nouvelle candidature.
// Le bot le surveille : dès qu'un membre le reçoit, une demande part dans #validation-demandes.
export const ROLE_ATTENTE = { nom: "⏳ En attente de validation" };

// Marqueurs de profil : le questionnaire natif pose "En attente" + un marqueur,
// pour que le Staff voie le profil demandé et l'approuve en un clic.
// Le profil "Festivalier" n'est PAS ici : il reçoit directement le rôle Membre.
export const CANDIDATURES: { marqueur: string; profil: string; emoji: string; roleKey: keyof typeof ROLES | null }[] = [
  { marqueur: "Candidat Bénévole", profil: "Bénévole", emoji: "🙌", roleKey: "benevoleEdition" },
  { marqueur: "Candidat Référent", profil: "Référent", emoji: "🧭", roleKey: "referent" },
  { marqueur: "Candidat Artiste", profil: "Artiste programmé", emoji: "🎤", roleKey: "artiste" },
  { marqueur: "Candidat Artiste Communauté", profil: "Artiste (communauté)", emoji: "🎧", roleKey: "artisteCommunaute" },
  { marqueur: "Candidat Partenaire", profil: "Partenaire", emoji: "🤝", roleKey: "partenaire" },
];

// Profil grand public : accès direct sans validation
export const PROFIL_DIRECT = { titre: "Festivalier", emoji: "🎉" };

// ---------- XP ----------
export const XP = {
  parMessageMin: 15,
  parMessageMax: 40,
  cooldownMessageMs: 60_000,
  parReaction: 25,
  cooldownReactionMs: 300_000,
  vocalPointsParTranche: 10,
  vocalTrancheMinutes: 10,
  shiftBenevole: 50,
  tailleClassement: 20,
};

// ---------- Délais (heures/jours) ----------
export const DELAIS = {
  dmSequenceHeures: 24,
  benevoleDuMoisJours: 30,
  archivageCovoitJoursApresEvent: 7,
};

// ---------- Anti-raid ----------
export const ANTIRAID = {
  seuilArrivees: 10,
  fenetreSecondes: 60,
};

// ---------- Noms des salons (clé interne -> nom Discord) ----------
export const SALONS = {
  bienvenue: "👋・bienvenue",
  guide: "📖・guide-discord",
  annonces: "📣・annonces",
  actuServeur: "🔔・actu-serveur",
  presse: "📰・presse-et-retombees",
  general: "💬・general",
  presentations: "🙋・presentations",
  billetterie: "🎫・billetterie",
  covoiturage: "🚗・covoiturage",
  photos: "📸・vos-photos-videos",
  benevoles: `🙌・benevoles-${EDITION.annee}`,
  planning: "📅・planning-shifts",
  covoitBenevoles: "🚐・covoit-benevoles",
  hebergementBenevoles: "⛺・hebergement-benevoles",
  vocalBrief: "Brief Bénévoles",
  vocalPause: "Pause",
  coordination: "🧭・coordination-referents",
  important: "📌・important",
  remontees: "📡・remontees-terrain",
  vocalRegie: "Régie Référents",
  infosArtistes: "🎹・infos-artistes",
  backstage: "🎤・backstage",
  demos: "🎧・demos-et-promos",
  staffGeneral: "🔒・staff-general",
  validation: "📋・validation-demandes",
  logs: "🤖・logs-bot",
  alertes: "🚨・alertes-moderation",
  vocalBar: "Bar",
  vocalTerrasse: "Terrasse",
  vocalAfters: "Afters",
  stageLive: "Live & Talks",
} as const;

// ---------- Structure des catégories ----------
export type TypeSalon = "texte" | "annonce" | "forum" | "media" | "vocal" | "stage";

export interface SalonDef {
  cle: keyof typeof SALONS;
  type: TypeSalon;
  lectureSeule?: boolean;   // écriture Staff/Référent uniquement
  cache?: boolean;          // créé masqué, révélable via /ouvrir-salon
  visiblePublic?: boolean;  // visible par les non-validés (salons par défaut de l'onboarding natif, min 7)
  sujet?: string;
  tags?: string[];          // forums uniquement
}

export interface CategorieDef {
  nom: string;
  // "accueil" = Non vérifié uniquement ; "public" = Membre validé ; sinon liste de clés de rôles
  acces: "accueil" | "public" | (keyof typeof ROLES)[];
  salons: SalonDef[];
}

export const STRUCTURE: CategorieDef[] = [
  {
    nom: "🚪 ACCUEIL",
    acces: "accueil",
    salons: [
      { cle: "bienvenue", type: "texte", lectureSeule: true, sujet: "Règles, présentation et RGPD : commence ici !" },
      { cle: "guide", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Nouveau sur Discord ou sur ce serveur ? Le tuto est ici" },
    ],
  },
  {
    nom: "📢 ACTU",
    acces: "public",
    salons: [
      { cle: "annonces", type: "annonce", lectureSeule: true, visiblePublic: true, sujet: "Les annonces officielles de La Java : infos, line-up, billetterie" },
      { cle: "actuServeur", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Changelog du Discord : nouveautés, salons ouverts" },
      { cle: "presse", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Articles, interviews et retombées presse" },
    ],
  },
  {
    nom: `🎪 LA JAVA ${EDITION.annee}`,
    acces: "public",
    salons: [
      { cle: "general", type: "texte", visiblePublic: true, sujet: "Le bar principal de la communauté : parle de tout ici" },
      { cle: "presentations", type: "texte", visiblePublic: true, sujet: "Présente-toi : qui tu es, d'où tu viens, ce que tu écoutes" },
      { cle: "billetterie", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Questions billetterie : ouvre un ticket avec le bouton" },
      { cle: "covoiturage", type: "texte", sujet: "Propose ou cherche un covoit' pour La Java : précise ta ville de départ !" },
      { cle: "photos", type: "texte", cache: true, sujet: "Vos plus beaux souvenirs en photo et vidéo" },
    ],
  },
  {
    nom: "🙌 BÉNÉVOLES",
    acces: ["benevoleEdition", "referent", "staff"],
    salons: [
      { cle: "benevoles", type: "texte", sujet: "Annonces internes bénévoles" },
      { cle: "planning", type: "texte", lectureSeule: true, sujet: "Plannings et shifts : messages épinglés" },
      { cle: "covoitBenevoles", type: "texte", sujet: "Covoiturage entre bénévoles" },
      { cle: "hebergementBenevoles", type: "texte", sujet: "Logement des bénévoles : camping, canapés, qui dort où" },
      { cle: "vocalBrief", type: "vocal" },
      { cle: "vocalPause", type: "vocal" },
    ],
  },
  {
    nom: "🧭 RÉFÉRENTS",
    acces: ["referent", "staff"],
    salons: [
      {
        cle: "coordination", type: "forum", sujet: "Coordination des référents : un sujet par poste/chantier",
        tags: ["Bar", "Entrée", "Camping", "Technique", "Sécu", "Autre", "Résolu"],
      },
      // Écriture réservée au fondateur (overwrite posé par scripts/serveur-maj.mjs)
      { cle: "important", type: "texte", lectureSeule: true, sujet: "Les infos essentielles : lecture obligatoire" },
      { cle: "remontees", type: "texte", sujet: "Remontées du terrain pendant l'événement" },
      { cle: "vocalRegie", type: "vocal" },
    ],
  },
  {
    nom: "🎤 ARTISTES",
    acces: ["artiste", "staff"],
    salons: [
      { cle: "infosArtistes", type: "texte", lectureSeule: true, sujet: "Technique, accès, timings, contacts" },
      { cle: "backstage", type: "texte", sujet: "Le backstage virtuel : entre artistes programmés" },
    ],
  },
  {
    nom: "🎧 LABEL & DÉMOS",
    acces: ["artiste", "artisteCommunaute", "staff"],
    salons: [
      {
        cle: "demos", type: "forum", sujet: "Balance tes prods, demande des retours",
        tags: ["Techno", "House", "Bass", "Live", "DJ Set", "Feedback demandé"],
      },
    ],
  },
  {
    nom: "🔒 STAFF",
    acces: ["staff"],
    salons: [
      { cle: "staffGeneral", type: "texte", sujet: "QG du staff" },
      { cle: "validation", type: "texte", sujet: "Candidatures à valider : boutons sur chaque demande" },
      { cle: "logs", type: "texte", lectureSeule: true, sujet: "Logs automatiques du bot" },
      { cle: "alertes", type: "texte", sujet: "Alertes modération et anti-raid" },
    ],
  },
  {
    nom: "🔊 VOCAUX",
    acces: "public",
    salons: [
      { cle: "vocalBar", type: "vocal" },
      { cle: "vocalTerrasse", type: "vocal" },
      { cle: "vocalAfters", type: "vocal", cache: true },
      { cle: "stageLive", type: "stage", cache: true },
    ],
  },
];

// ---------- Questionnaire d'onboarding ----------
export const QUESTIONNAIRE = {
  titre: "Rejoindre La Java 🎪",
  sources: [
    { label: "Instagram", value: "instagram", emoji: "📷" },
    { label: "TikTok", value: "tiktok", emoji: "🎵" },
    { label: "Bouche à oreille", value: "bouche_a_oreille", emoji: "🗣" },
    { label: "Site La Java", value: "site", emoji: "🌐" },
    { label: "Sur place l'an dernier", value: "sur_place", emoji: "🎪" },
    { label: "Un artiste", value: "artiste", emoji: "🎧" },
    { label: "Newsletter", value: "newsletter", emoji: "📬" },
    { label: "Autre", value: "autre", emoji: "✨" },
  ],
  profils: [
    { label: "Bénévole", value: "benevole", emoji: "🙌", roleKey: "benevoleEdition" },
    { label: "Référent", value: "referent", emoji: "🧭", roleKey: "referent" },
    { label: "Artiste programmé", value: "artiste_programme", emoji: "🎤", roleKey: "artiste" },
    { label: "Artiste (communauté)", value: "artiste_communaute", emoji: "🎧", roleKey: "artisteCommunaute" },
    { label: "Partenaire", value: "partenaire", emoji: "🤝", roleKey: "partenaire" },
    { label: "Curieux - Public", value: "curieux", emoji: "👀", roleKey: null },
  ] as { label: string; value: string; emoji: string; roleKey: keyof typeof ROLES | null }[],
  maxSoumissions: 2, // 1 soumission + 1 seule nouvelle tentative après refus
};

// ---------- Tous les textes visibles par les utilisateurs ----------
export const TEXTES = {
  // Accueil / règles
  emojiDeblocage: "🎪", // réaction sur le post de bienvenue qui débloque les salons Membre
  bienvenueTitre: "🎪 Bienvenue sur le Discord de La Java !",
  bienvenueCorps: [
    "Salut ! Ici, c'est le **QG en ligne de la communauté La Java** 🎶 On y vit toute l'année : discussions, entraide, sons, covoits, orga bénévole… et bien sûr le festival quand la saison arrive.",
    "",
    "━━━━━ 🧭 **COMMENT MARCHE CE SERVEUR** ━━━━━",
    "",
    "🚪 **À ton arrivée**, le questionnaire Discord te demande ton profil. **Festivalier·e ?** Tu entres directement ! **Bénévole, artiste ou partenaire ?** Ta demande est validée par le Staff — en attendant, tu peux lire les salons publics mais pas encore écrire.",
    "🎪 **Réagis avec 🎪 sous ce message** pour confirmer que tu as lu les règles : le Staff le voit dans ta candidature.",
    "📣 **Les infos officielles** (line-up, billetterie…) tombent dans le salon annonces. Le reste, c'est à toi de le faire vivre dans le général !",
    "⭐ **Plus tu participes** (messages, réactions, vocaux), plus tu gagnes d'XP et montes de niveau : salons secrets, billetterie en avance, giveaways… Détails épinglés dans le général.",
    "🎫 **Une question, un souci ?** Ouvre un ticket dans le salon billetterie : c'est privé, seul le Staff le voit.",
    "",
    "━━━━━ 🌈 **LES RÈGLES DU SERVEUR** ━━━━━",
    "",
    "**1. Bienveillance d'abord.** Tout le monde est le/la bienvenu·e. Zéro tolérance pour le harcèlement, les discriminations (racisme, sexisme, LGBTQIA+phobies, validisme…) et les comportements toxiques — ici comme sur le site du festival.",
    "",
    "**2. Consentement et droit à l'image.** Pas de partage de photos ou vidéos où quelqu'un est reconnaissable sans son accord, ni ici ni ailleurs. Un non est un non.",
    "",
    "**3. Pas de spam ni de pub sauvage.** Pas de revente de billets hors canaux officiels, pas de contenu choquant ou illégal.",
    "",
    "**4. La modération se discute en DM** avec le Staff, jamais en public dans les salons.",
    "",
    "**5. Prends soin des autres.** Quelqu'un va mal, ici ou sur site ? On ne juge pas, on aide : préviens le Staff ou ouvre un ticket.",
    "",
    "**6. Backstage.** Ce qui se passe backstage reste backstage 😉",
    "",
    "🆘 **Un doute, un signalement ?** Ticket dans la billetterie ou DM à un membre du Staff : c'est confidentiel.",
    "",
    "**RGPD :** en répondant au questionnaire, tu acceptes que tes réponses soient conservées par l'équipe pour gérer la communauté. Tu peux demander leur suppression à tout moment auprès du Staff.",
    "",
    "🎪 **Dernière étape : réagis 🎪 juste en dessous pour confirmer ta lecture des règles. Le Staff valide ta demande très vite — bonne Java !**",
  ].join("\n"),

  // Modal
  labelSource: "Comment as-tu connu ce Discord ?",
  labelMotivation: "Pourquoi veux-tu nous rejoindre ?",
  placeholderMotivation: "Dis-nous ce qui t'amène ! (300 caractères max)",
  labelProfil: "Tu es ici en tant que :",
  labelPseudo: "Ton prénom ou pseudo artiste (optionnel)",

  // DM et confirmations onboarding
  dmBienvenue: (serveur: string) =>
    `Salut ! 👋 Bienvenue sur **${serveur}**.\nTon profil choisi à l'arrivée débloque tes accès. Si tu as coché bénévole, artiste ou partenaire, le Staff confirme ton rôle très vite. En attendant, viens dire bonjour dans le général ! 🎪`,
  soumissionRecue: "🎉 C'est envoyé ! Le Staff regarde ta demande très vite : tu recevras un message privé dès que c'est validé.",
  soumissionDejaEnCours: "Tu as déjà une demande en cours d'examen : le Staff s'en occupe, encore un peu de patience ! 🙏",
  soumissionEpuisee: "Tu as déjà utilisé ta seconde chance après un refus. Contacte directement un membre du Staff si tu penses qu'il y a une erreur.",
  dmApprouve: (roles: string) =>
    `🎉 **C'est bon, tu es de la famille !** Ta demande a été validée.\nTes rôles : ${roles}\nViens te présenter dans le salon présentations et dire bonjour dans le général. À très vite ! 🎪`,
  dmRefuse: (motif: string) =>
    `😕 Ta demande pour rejoindre La Java n'a pas été retenue.\n**Motif :** ${motif}\nTu as droit à **une** nouvelle tentative : reprends le questionnaire si tu veux réessayer.`,
  dmPlusInfos: (question: string) =>
    `👋 Le Staff a une petite question avant de valider ta demande :\n> ${question}\nRéponds directement à un membre du Staff ou refais le questionnaire en complétant ta réponse !`,
  bienvenueGeneral: (userId: string, profil: string) =>
    `🎪 Faites du bruit pour <@${userId}> qui rejoint la communauté en tant que **${profil}** ! Bienvenue ! 🥳`,

  // Séquence bénévole (J+0 / J+1 / J+2)
  dmSequenceBenevole: [
    "🙌 **Bienvenue dans l'équipe bénévoles de La Java !**\nTu as maintenant accès à la catégorie BÉNÉVOLES : les annonces internes, le planning et le covoit' bénévoles. Le salon des annonces bénévoles est ton point de repère : tout ce qui est important y passe.",
    "📅 **Les shifts, comment ça marche ?**\nLe planning est publié dans le salon planning-shifts (messages épinglés). Tu y trouveras tes créneaux, ton poste et ton référent. Une question ? Pose-la dans le salon bénévoles : quelqu'un te répond vite.",
    "🙋 **Dernière étape : viens te présenter !**\nPasse dans le salon présentations raconter qui tu es, d'où tu viens et pourquoi tu donnes un coup de main. C'est le meilleur moyen de rencontrer l'équipe avant le jour J. À très vite ! 🎪",
  ],

  // Anniversaires
  messagesAnniversaire: [
    (userId: string) => `🎂 Gros son pour <@${userId}> qui prend un an de plus aujourd'hui ! Joyeux anniversaire ! 🎉`,
    (userId: string) => `🎈 <@${userId}> a level up IRL aujourd'hui ! Joyeux anniversaire de toute la Java ! 🥳`,
    (userId: string) => `🎪 Aujourd'hui c'est la fête de <@${userId}> : joyeux anniversaire, on t'offre le premier café du festival ! ☕🎂`,
  ],

  // Compte à rebours
  countdown: (jours: number) =>
    jours > 0
      ? `⏳ **J-${jours}** avant **${EDITION.nom}** ! 🎪`
      : jours === 0
        ? `🎉 **C'EST AUJOURD'HUI !** ${EDITION.nom}, on y est ! 🎪🔊`
        : `💜 ${EDITION.nom}, c'était il y a ${-jours} jour(s). Merci à toutes et tous : à l'année prochaine !`,

  // Bénévole du mois
  shoutout: (userId: string, texte: string) =>
    `🌟 **Bénévole du Mois** 🌟\nBravo <@${userId}> ! ${texte}\nLe rôle ✨ est à toi pour 30 jours : porte-le fièrement !`,

  // Tickets
  // Guide Discord (salon 📖・guide-discord, deux embeds épinglés)
  guideDiscordTitre: "📖 Discord pour les débutants",
  guideDiscordCorps: [
    "Jamais utilisé Discord ? Pas de panique, 2 minutes de lecture et tu es à l'aise 👇",
    "",
    "🏠 **Un serveur, des salons.** Ce serveur est notre maison commune ; chaque salon (la liste à gauche) est une pièce avec son thème. Le `#💬・general`, c'est le bar : on y parle de tout.",
    "",
    "💬 **Écrire et répondre.** Tape ton message en bas du salon. Pour répondre à quelqu'un : clic droit (ou appui long sur mobile) sur son message → **Répondre**.",
    "",
    "😄 **Réagir.** Survole un message → l'icône émoji permet d'ajouter une réaction. C'est comme un like, et ici ça rapporte même de l'XP !",
    "",
    "🔔 **Les notifications.** Trop de bips ? Clic droit sur le nom du serveur → **Notifications** → *Uniquement @mentions*. Tu peux aussi mettre en sourdine un salon précis.",
    "",
    "🗣 **Les vocaux.** Clique sur un salon vocal (🔊) pour y entrer, re-clique sur *Raccrocher* pour sortir. Les icônes micro/casque en bas à gauche te permettent de te couper le son.",
    "",
    "🧵 **Les fils.** Une discussion qui part loin ? Clic droit sur un message → **Créer un fil** : ça ouvre une mini-conversation sans envahir le salon.",
    "",
    "📱 **Sur mobile.** Balaye vers la droite pour afficher la liste des salons, vers la gauche pour voir qui est en ligne.",
  ].join("\n"),
  guideServeurTitre: "🎪 Ce serveur, mode d'emploi",
  guideServeurCorps: [
    "**🚪 Ton arrivée.** Le questionnaire d'entrée te demande ton profil : les festivalier·e·s entrent directement, les profils bénévole/artiste/partenaire sont validés par le Staff (en général très vite). Pense à réagir 🎪 au message de bienvenue pour montrer que tu as lu les règles !",
    "",
    "**⭐ Les niveaux.** Participer (messages, réactions, vocaux) fait gagner de l'XP : Nouveau → Habitué → Fêtard → Pilier de la Java → Légende de la Java, avec de vrais avantages à chaque palier (salons secrets, billetterie en avance, giveaways…). Le détail est épinglé dans le général. Tape `/mon-profil` pour voir où tu en es, `/classement` pour le top 20.",
    "",
    "**🎫 La billetterie.** Le lien officiel et le support sont dans le salon billetterie. Une question sur ta commande ? Le bouton *Ouvrir un ticket* crée une conversation privée avec le Staff.",
    "",
    "**🎂 Ton anniversaire.** Tape `/anniversaire jour mois` et on te fêtera dans le général le jour J.",
    "",
    "**🙌 Bénévoles, artistes, partenaires.** Une fois validé·e, tu as tes salons dédiés (planning, entraide, backstage, démos…). Tout ce qui te concerne y passe.",
    "",
    "**🆘 Besoin d'aide ?** Ticket dans la billetterie, ou DM direct à un membre du **Staff** (en rouge dans la liste des membres). On ne mord pas.",
  ].join("\n"),

  billetterieTitre: "🎫 Billetterie La Java",
  billetterieCorps: [
    `🎟 **Prends ta place ici, et nulle part ailleurs :**\n👉 ${EDITION.lienBilletterie}`,
    "",
    "**Une question, un souci de commande, un remboursement ?**",
    "Ouvre un ticket avec le bouton ci-dessous : un fil privé s'ouvre avec le Staff, personne d'autre ne voit vos échanges.",
    "",
    "⚠️ **Aucune revente hors canaux officiels** : les annonces de revente sauvage sont supprimées et leurs auteurs sanctionnés.",
  ].join("\n"),
  boutonTicket: "Ouvrir un ticket",
  ticketOuvert: (userId: string, staffRoleId: string) =>
    `✉️ Ticket ouvert par <@${userId}> : <@&${staffRoleId}> est prévenu.\nExplique-nous ta demande, on te répond au plus vite !`,
  ticketFerme: "🔒 Ticket fermé. Le transcript a été archivé par le Staff. Merci !",

  // Modération / anti-raid
  lockdownOn: "🚨 **LOCKDOWN ACTIVÉ** : les validations sont suspendues et la vérification est verrouillée.",
  lockdownOff: "✅ Lockdown désactivé : retour à la normale.",
  alerteRaid: (nb: number, staffRoleId: string) =>
    `🚨 <@&${staffRoleId}> **ALERTE RAID** : ${nb} arrivées en moins de 60 secondes. Lockdown automatique activé. Vérifiez les nouveaux comptes avant de désactiver (\`/lockdown off\`).`,
  lienSupprime: (userId: string) =>
    `⚠️ Message de <@${userId}> supprimé : lien d'invitation ou lien suspect (réservé au Staff).`,
  verrouilleLockdown: "🚨 Les validations sont temporairement suspendues (mesure de sécurité). Réessaie un peu plus tard !",
} as const;

// ---------- Divers ----------
export const COULEURS = {
  primaire: 0xe67e22,
  succes: 0x2ecc71,
  erreur: 0xe74c3c,
  info: 0x3498db,
  neutre: 0x95a5a6,
  alerte: 0xf39c12,
};

// Domaines de raccourcisseurs / grabbers considérés comme suspects pour les non-Staff
export const DOMAINES_SUSPECTS = [
  "bit.ly", "tinyurl.com", "grabify.link", "iplogger.org", "cutt.ly", "is.gd", "shorturl.at",
];

export const SEUIL_COMPTE_RECENT_JOURS = 7;
