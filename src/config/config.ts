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
  { seuil: 0, nom: "Nouveau dans la Zone", couleur: 0xbdc3c7, avantages: [] },
  {
    seuil: 150, nom: "Premier Kick", couleur: 0x74b9ff,
    avantages: ["Participation aux sondages communautaires", "Annonces et line-up en avant-première (48h avant les réseaux)"],
  },
  {
    seuil: 500, nom: "Enfant de la Fosse", couleur: 0xa29bfe,
    avantages: ["Accès au vocal Afters", "Accès au salon vos-photos-videos"],
  },
  {
    seuil: 1500, nom: "Pilier de Zone", couleur: 0xe67e22,
    avantages: ["Billetterie en avance (48h)", "Giveaways merch", "Création de fils de discussion"],
  },
  {
    seuil: 4000, nom: "Légende de La Java", couleur: 0xffd32a,
    avantages: ["Tarif préférentiel sur les événements Dans La Zone", "Ton nom au panthéon du serveur"],
  },
];

export const ROLE_BENEVOLE_DU_MOIS = { nom: "Bénévole du Mois", couleur: 0xff3f34 };

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
  annonces: "📣・annonces",
  lineUp: "🎵・line-up",
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
  lectureSeule?: boolean; // écriture Staff/Référent uniquement
  cache?: boolean;        // créé masqué, révélable via /ouvrir-salon
  sujet?: string;
  tags?: string[];        // forums uniquement
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
    ],
  },
  {
    nom: "📢 ACTU",
    acces: "public",
    salons: [
      { cle: "annonces", type: "annonce", lectureSeule: true, sujet: "Les annonces officielles de La Java" },
      { cle: "lineUp", type: "annonce", lectureSeule: true, sujet: "La programmation, artiste par artiste" },
      { cle: "actuServeur", type: "texte", lectureSeule: true, sujet: "Changelog du Discord : nouveautés, salons ouverts" },
      { cle: "presse", type: "texte", lectureSeule: true, cache: true, sujet: "Articles, interviews et retombées presse" },
    ],
  },
  {
    nom: `🎪 LA JAVA ${EDITION.annee}`,
    acces: "public",
    salons: [
      { cle: "general", type: "texte", sujet: "Le bar principal de la communauté : parle de tout ici" },
      { cle: "presentations", type: "texte", sujet: "Présente-toi : qui tu es, d'où tu viens, ce que tu écoutes" },
      { cle: "billetterie", type: "texte", lectureSeule: true, sujet: "Questions billetterie : ouvre un ticket avec le bouton" },
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
  bienvenueTitre: "🎪 Bienvenue sur La Java !",
  bienvenueCorps: [
    "Salut et bienvenue sur le Discord de **La Java**, le festival de **DANS LA ZONE** ! 🎶",
    "",
    "**Ici, on est là pour :** vivre le festival avant, pendant et après • organiser les bénévoles • accueillir les artistes • partager des sons, des covoits et des souvenirs.",
    "",
    "━━━━━ 🧭 **COMMENT MARCHE CE SERVEUR** ━━━━━",
    "",
    "🚪 **À ton arrivée**, un petit questionnaire te demande ton profil (curieux·se, bénévole, artiste, partenaire…) : il débloque tes accès. Les profils bénévole/artiste/partenaire sont confirmés par le Staff.",
    "📣 **Les infos officielles** tombent dans les salons annonces et line-up. Le reste, c'est à toi de le faire vivre dans le général !",
    "⭐ **Plus tu participes, plus tu montes de niveau** : messages, réactions et vocaux te font gagner de l'XP qui débloque de vrais avantages (billetterie en avance, giveaways, salons secrets…). Détails épinglés dans le général.",
    "🎫 **Un souci billetterie ?** Ouvre un ticket dans le salon billetterie.",
    "",
    "━━━━━ 🌈 **LA CHARTE DE LA JAVA** ━━━━━",
    "",
    "**1. Bienveillance d'abord.** Tout le monde est le/la bienvenu·e. Zéro tolérance pour le harcèlement, les discriminations (racisme, sexisme, LGBTQIA+phobies, validisme…) et les comportements toxiques : ici comme sur le site du festival.",
    "",
    "**2. Le consentement, tout le temps.** Pour une photo, un contact, une danse : on demande, et un non est un non. Pas de partage d'images où quelqu'un est reconnaissable sans son accord.",
    "",
    "**3. Prends soin de toi et des autres.** La fête est réussie quand tout le monde rentre entier. Quelqu'un va mal, ici ou sur site ? On ne juge pas, on aide : préviens le Staff ou ouvre un ticket.",
    "",
    "**4. Respect du lieu et de la planète.** Le site, le matos, la nature : on en prend soin et on ne laisse aucune trace derrière nous.",
    "",
    "**5. Sur ce Discord.** Pas de spam ni de pub sauvage, pas de revente de billets hors canaux officiels, pas de contenu choquant ou illégal. Une décision de modération se discute en DM avec le Staff, pas en public.",
    "",
    "**6. Backstage.** Ce qui se passe backstage reste backstage 😉",
    "",
    "🆘 **Un souci, un doute, un signalement ?** Ouvre un ticket dans la billetterie ou écris directement à un membre du Staff : c'est confidentiel.",
    "",
    "**RGPD :** en répondant au questionnaire, tu acceptes que tes réponses soient conservées par l'équipe pour gérer la communauté. Tu peux demander leur suppression à tout moment auprès du Staff (commande `/oublier-membre`).",
    "",
    "➡️ Le questionnaire d'arrivée de Discord te demande ton profil : il débloque tes accès. Bonne Java !",
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
  billetterieTitre: "🎟 Billetterie & Support",
  billetterieCorps: "Un souci avec ta commande, une question sur les tarifs, un remboursement ?\nOuvre un ticket privé : seul le Staff verra ta demande.",
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
