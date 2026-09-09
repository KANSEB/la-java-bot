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
    nom: "Orga",
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
  benevoleEdition: { nom: "Bénévole", couleur: 0x2ecc71, hoist: true, mentionnable: true, permissions: [] },
  benevole: { nom: "Ancien bénévole", couleur: 0x27ae60, hoist: false, mentionnable: true, permissions: [] },
  membre: { nom: "Membre", couleur: 0x99aab5, hoist: false, mentionnable: false, permissions: [] },
};

// ---------- Rôles cosmétiques ----------
// Badges d'édition, cumulables. `nomBadge(annee)` sert aussi pour les années passées/futures.
export const nomBadge = (annee: number): string => `Java ${annee}`;
// Seule l'édition en cours est pré-créée : `/attribuer-badge` fabrique le rôle
// d'une année passée au moment où on en a besoin, inutile de les empiler d'avance.
export const BADGES: Record<number, { couleur: number }> = {
  2026: { couleur: 0xff6b9d },
};

// Paliers XP (seuil croissant). Le rôle du palier atteint remplace le précédent.
// Les seuils tiennent compte du rythme réel de gain : à 15-40 XP par message,
// des paliers trop bas se franchissaient en une soirée et « Légende » se
// décrochait en deux semaines. Un badge d'édition (500) ouvre désormais
// « Habitué » sans téléporter au palier suivant.
// Chaque palier donne un rôle coloré et ses avantages. Les accès aux salons
// sont posés par le provisioning via `palierMin` ; les avantages humains
// (giveaways, tarif préférentiel) sont tenus à la main par l'orga.
// Le palier de départ n'a pas de rôle Discord : être Membre sans palier
// supérieur, c'est être Festivalier. Un rôle de moins sur chaque profil.
export const PALIERS_XP: { seuil: number; nom: string; couleur: number; avantages: string[]; sansRole?: boolean }[] = [
  { seuil: 0, nom: "Festivalier", couleur: 0xbdc3c7, avantages: [], sansRole: true },
  {
    seuil: 500, nom: "Habitué", couleur: 0x74b9ff,
    avantages: ["Droit de vote sur les décisions de la communauté", "Accès au vocal Afters"],
  },
  {
    seuil: 2000, nom: "Fêtard", couleur: 0xa29bfe,
    avantages: ["Création de fils de discussion"],
  },
  {
    seuil: 6000, nom: "Pilier de la Java", couleur: 0xe67e22,
    avantages: ["Giveaways merch", "Priorité sur les candidatures bénévoles"],
  },
  {
    seuil: 20000, nom: "Légende de la Java", couleur: 0xffd32a,
    avantages: ["Tarif préférentiel sur la billetterie", "Ton nom au panthéon"],
  },
];


// Rôle-barrière posé sur chaque arrivant : il masque tout le serveur sauf le
// salon des règles. Il est retiré dès que la charte de l'écran d'entrée est acceptée.
// Sans permission propre : il ne fait qu'interdire.
export const ROLE_PORTE = { nom: "👋 Nouvel arrivant", couleur: 0x4f545c };

// Rôle posé par l'onboarding natif Discord sur TOUTE nouvelle candidature.
// Le bot le surveille : dès qu'un membre le reçoit, une demande part dans #validation-demandes.
export const ROLE_ATTENTE = { nom: "⏳ En attente de validation" };

// Marqueurs de profil : le questionnaire natif pose "En attente" + un marqueur,
// pour que l'orga voie le profil demandé et l'approuve en un clic.
// Le profil "Festivalier" n'est PAS ici : il reçoit directement le rôle Membre.
export const CANDIDATURES: { marqueur: string; profil: string; emoji: string; roleKey: keyof typeof ROLES | null }[] = [
  { marqueur: "Candidat Bénévole", profil: "Bénévole", emoji: "🙌", roleKey: "benevoleEdition" },
  { marqueur: "Candidat Référent", profil: "Référent", emoji: "🧭", roleKey: "referent" },
  { marqueur: "Candidat Artiste", profil: "Artiste programmé", emoji: "🎤", roleKey: "artiste" },
  { marqueur: "Candidat Artiste Communauté", profil: "Artiste (communauté)", emoji: "🎧", roleKey: "artisteCommunaute" },
];

// Profil grand public : accès direct sans validation
export const PROFIL_DIRECT = { titre: "Festivalier", emoji: "🎉" };

// ---------- XP ----------
export const XP = {
  parMessageMin: 15,
  parMessageMax: 40,
  cooldownMessageMs: 60_000,
  parReaction: 10,
  cooldownReactionMs: 300_000,
  vocalPointsParTranche: 10,
  vocalTrancheMinutes: 10,
  shiftBenevole: 500,
  badgeEdition: 500,   // avoir fait l'édition vaut autant qu'un shift
  tailleClassement: 20,
};

// ---------- Délais (heures/jours) ----------
export const DELAIS = {
  dmSequenceHeures: 24,
  archivageCovoitJoursApresEvent: 7,
};

// ---------- Réclamation du badge d'édition ----------
// Impossible de savoir qui était sur place : chacun se déclare. Un badge sans
// permission ni valeur marchande ne se triche pas, et la fenêtre se ferme
// toute seule un mois après l'événement.
export const RECLAMATION_BADGE = {
  ouvertureJoursApresEvent: 1,
  dureeJours: 30,
};

// ---------- Anniversaires ----------
// Réservés à l'équipe : dans le général ce serait du bruit, entre bénévoles
// c'est un petit rituel sympa. `salonAnnonce` et `rolesAutorises` suffisent
// à tout déplacer (par ex. vers "general" pour ouvrir à tout le monde).
export const ANNIVERSAIRES = {
  salonAnnonce: "benevoles" as const,
  rolesAutorises: ["benevoleEdition", "benevole", "referent", "staff"] as (keyof typeof ROLES)[],
};

// Fuseau horaire des tâches planifiées : les serveurs d'hébergement tournent
// en UTC, sans ça les anniversaires tomberaient à midi au lieu de 10h.
export const FUSEAU = "Europe/Paris";

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
  infosPratiques: "📍・infos-pratiques",
  covoiturage: "🚗・covoiturage",
  photos: "📸・vos-photos-videos",
  niveaux: "⭐・niveaux",
  votes: "🗳・votes-communaute",
  benevoles: "🙌・blabla-benevoles",
  fichesMissions: "📋・fiches-missions",
  planning: "📅・planning-shifts",
  covoitBenevoles: "🚐・covoit-benevoles",
  hebergementBenevoles: "⛺・hebergement-benevoles",
  vocalBrief: "Brief Bénévoles",
  vocalPause: "Pause",
  coordination: "🧭・coordination-referents",
  important: "📌・important",
  remontees: "💬・blabla-referents",
  backstageOff: "👀・backstage-off",
  vocalRegie: "Régie Référents",
  infosArtistes: "🎹・infos-artistes",
  backstage: "🎤・backstage",
  demos: "🎧・demos-et-promos",
  staffGeneral: "🛠・general",
  validation: "📋・validation-demandes",
  logs: "🤖・logs-bot",
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
  postsReserves?: boolean;  // forum : Staff/Référent ouvrent les sujets, les autres répondent dedans
  cache?: boolean;          // créé masqué, révélable via /ouvrir-salon
  visiblePublic?: boolean;
  palierMin?: string;       // réservé à ce palier XP et aux suivants
  sujet?: string;
  tags?: string[];          // forums uniquement
  /** Rôles supplémentaires autorisés sur ce salon, en plus de l'accès de la catégorie. */
  accesSupplement?: (keyof typeof ROLES)[];
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
      { cle: "niveaux", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Comment gagner de l'XP et ce que ça débloque" },
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
      { cle: "billetterie", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Questions billetterie : ouvre un ticket avec le bouton" },
      {
        cle: "infosPratiques", type: "forum",
        sujet: "Tout ce qu'il faut savoir pour venir : un sujet par question. Cherche avant de poster, la réponse y est peut-être déjà !",
        tags: ["Accès & lieu", "Billetterie", "Camping & hébergement", "Horaires", "Accessibilité", "Sur place", "Répondu"],
      },
      { cle: "covoiturage", type: "texte", sujet: "Propose ou cherche un covoit' pour La Java : précise ta ville de départ !" },
      { cle: "photos", type: "texte", sujet: "Vos plus beaux souvenirs en photo et vidéo, balancez tout !" },
      { cle: "votes", type: "texte", palierMin: "Habitué", sujet: "Les décisions qu'on prend ensemble : line-up, merch, afters..." },
    ],
  },
  {
    nom: "🙌 BÉNÉVOLES",
    acces: ["benevoleEdition", "referent", "staff"],
    salons: [
      { cle: "benevoles", type: "texte", sujet: "Le QG de l'équipe : annonces internes, questions, blabla" },
      { cle: "presentations", type: "texte", sujet: "Présente-toi à l'équipe : qui tu es, ton poste, ce que tu écoutes" },
      {
        cle: "fichesMissions", type: "forum", postsReserves: true,
        sujet: "Un sujet par pôle, avec sa fiche mission en tête : ce qu'on y fait, les horaires, le matériel, à qui s'adresser. Les fiches sont écrites par les référents, les questions se posent en réponse dans le sujet du pôle.",
        tags: [
          "Bar", "Billetterie / Accueil", "Cashless", "Déconsigne", "Gestion du site",
          "Loges", "Merch", "Prévention", "Runs", "Volant",
        ],
      },
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
        cle: "coordination", type: "forum", sujet: "Un sujet par pôle : sa fiche bénévole et sa fiche référent en haut, les échanges du pôle en dessous.",
        tags: ["Bar", "Billetterie / Accueil", "Cashless", "Déconsigne", "Gestion du site", "Loges", "Merch", "Prévention", "Runs", "Volant", "Résolu"],
      },
      // Écriture réservée au fondateur (overwrite posé par scripts/serveur-maj.mjs)
      { cle: "important", type: "texte", lectureSeule: true, sujet: "Les infos essentielles : lecture obligatoire" },
      { cle: "remontees", type: "texte", sujet: "Le bar des référents : tout et surtout n'importe quoi" },
      { cle: "backstageOff", type: "texte", sujet: "Les photos et moments backstage qu'on ne montrera à personne d'autre 👀" },
      { cle: "vocalRegie", type: "vocal" },
    ],
  },
  {
    nom: "🎤 ARTISTES",
    acces: ["artiste", "staff"],
    salons: [
      { cle: "infosArtistes", type: "texte", lectureSeule: true, sujet: "Technique, accès, timings, contacts" },
      { cle: "backstage", type: "texte", sujet: "Le backstage virtuel : entre artistes programmés" },
      { cle: "demos", type: "forum", sujet: "Balance tes prods, demande des retours",
        accesSupplement: ["artisteCommunaute"],
        tags: ["Techno", "House", "Bass", "Live", "DJ Set", "Feedback demandé"] },
    ],
  },
  {
    nom: "🛠️ ORGA",
    acces: ["staff"],
    salons: [
      { cle: "staffGeneral", type: "texte", sujet: "Le QG : sujets transverses de l'orga" },
      { cle: "validation", type: "texte", sujet: "Candidatures à valider : boutons sur chaque demande" },
      { cle: "logs", type: "texte", lectureSeule: true, sujet: "Logs automatiques du bot" },
    ],
  },
  {
    nom: "🔊 VOCAUX",
    acces: "public",
    salons: [
      { cle: "vocalBar", type: "vocal" },
      { cle: "vocalTerrasse", type: "vocal" },
      { cle: "vocalAfters", type: "vocal", palierMin: "Habitué" },
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
    { label: "Curieux - Public", value: "curieux", emoji: "👀", roleKey: null },
  ] as { label: string; value: string; emoji: string; roleKey: keyof typeof ROLES | null }[],
  maxSoumissions: 2, // 1 soumission + 1 seule nouvelle tentative après refus
};

// ---------- Tous les textes visibles par les utilisateurs ----------
const SAUT = String.fromCharCode(10);

export const TEXTES = {
  // Accueil / règles
  emojiDeblocage: "🎪", // réaction sur le post de bienvenue qui débloque les salons Membre
  bienvenueTitre: "🎪 Bienvenue sur le Discord de La Java !",
  bienvenueCorps: [
    "Salut ! Ici, c'est le **QG en ligne de la communauté La Java** 🎶 On y vit toute l'année : discussions, entraide, sons, covoits, orga bénévole… et bien sûr le festival quand la saison arrive.",
    "",
    "━━━━━ 🧭 **COMMENT MARCHE CE SERVEUR** ━━━━━",
    "",
    "🎪 **Tu es entré, le serveur est à toi.** En acceptant la charte à l'arrivée, tu as accepté les règles ci-dessous. Prends une minute pour les lire, puis viens dire bonjour dans le général.",
    "🙌 **Bénévole ou artiste ?** Tu l'as indiqué dans le questionnaire d'arrivée : l'orga valide ta demande et tes salons dédiés s'ajoutent ensuite.",
    "📣 **Les infos officielles** (line-up, billetterie…) tombent dans le salon annonces. Le reste, c'est à toi de le faire vivre dans le général !",
    "⭐ **Plus tu participes** (messages, réactions, vocaux), plus tu gagnes d'XP et montes de niveau : salons secrets, billetterie en avance, giveaways… Détails épinglés dans le général.",
    "🎫 **Une question, un souci ?** Ouvre un ticket dans le salon billetterie : c'est privé, seul l'orga le voit.",
    "",
    "━━━━━ 🌈 **LES RÈGLES DU SERVEUR** ━━━━━",
    "",
    "**1. Bienveillance d'abord.** Tout le monde est le/la bienvenu·e. Zéro tolérance pour le harcèlement, les discriminations (racisme, sexisme, LGBTQIA+phobies, validisme…) et les comportements toxiques, ici comme sur le site du festival.",
    "",
    "**2. Consentement et droit à l'image.** Pas de partage de photos ou vidéos où quelqu'un est reconnaissable sans son accord, ni ici ni ailleurs. Un non est un non.",
    "",
    "**3. Pas de spam ni de pub sauvage.** Pas de revente de billets hors canaux officiels, pas de contenu choquant ou illégal.",
    "",
    "**4. La modération se discute en DM** avec l'orga, jamais en public dans les salons.",
    "",
    "**5. Prends soin des autres.** Quelqu'un va mal, ici ou sur site ? On ne juge pas, on aide : préviens l'orga ou ouvre un ticket.",
    "",
    "**6. Backstage.** Ce qui se passe backstage reste backstage 😉",
    "",
    "🆘 **Un doute, un signalement ?** Ticket dans la billetterie ou DM à un membre de l'orga : c'est confidentiel.",
    "",
    "**RGPD :** en répondant au questionnaire, tu acceptes que tes réponses soient conservées par l'équipe pour gérer la communauté. Tu peux demander leur suppression à tout moment auprès de l'orga.",
    "",
    "👇 **Un 🎪 en dessous pour dire que tu as lu, et bonne Java !**",
  ].join("\n"),

  // Modal
  labelSource: "Comment as-tu connu ce Discord ?",
  labelMotivation: "Pourquoi veux-tu nous rejoindre ?",
  placeholderMotivation: "Dis-nous ce qui t'amène ! (300 caractères max)",
  labelProfil: "Tu es ici en tant que :",
  labelPseudo: "Ton prénom ou pseudo artiste (optionnel)",

  // DM et confirmations onboarding
  dmBienvenue: (serveur: string) =>
    `Salut ! 👋 Bienvenue sur **${serveur}**, le serveur est ouvert pour toi.

Premier réflexe : un tour dans le salon 👋・bienvenue pour lire les règles, puis un bonjour dans le général.

Si tu as coché bénévole, référent ou artiste dans le questionnaire, l'orga confirme ton rôle très vite : pas besoin d'attendre pour venir discuter ! 🎪`,
  soumissionRecue: "🎉 C'est envoyé ! L'orga regarde ta demande très vite : tu recevras un message privé dès que c'est validé.",
  nouvelleCandidature: (userId: string, staffRoleId?: string) =>
    `${staffRoleId ? `<@&${staffRoleId}> ` : ""}📥 **Nouvelle candidature** de <@${userId}>, à valider ci-dessous :`,
  soumissionDejaEnCours: "Tu as déjà une demande en cours d'examen : l'orga s'en occupe, encore un peu de patience ! 🙏",
  soumissionEpuisee: "Tu as déjà utilisé ta seconde chance après un refus. Contacte directement un membre de l'orga si tu penses qu'il y a une erreur.",
  dmApprouve: (roles: string) =>
    `🎉 **C'est bon, tu es de la famille !** Ta demande a été validée.\nTes rôles : ${roles}\nViens te présenter dans le salon présentations et dire bonjour dans le général. À très vite ! 🎪`,
  dmRolesModifies: (roles: string) =>
    `🎭 **Tes rôles sur le Discord de La Java ont été mis à jour.**
Tes rôles : ${roles}
Si ça ne correspond pas à ta situation, écris à un membre de l'orga.`,
  dmRefuse: (motif: string) =>
    `😕 Ta demande pour rejoindre La Java n'a pas été retenue.\n**Motif :** ${motif}\nTu as droit à **une** nouvelle tentative : reprends le questionnaire si tu veux réessayer.`,
  dmPlusInfos: (question: string) =>
    `👋 L'orga a une petite question avant de valider ta demande :\n> ${question}\nRéponds directement à un membre de l'orga ou refais le questionnaire en complétant ta réponse !`,
  bienvenueGeneral: (userId: string, profil: string) =>
    `🎪 Faites du bruit pour <@${userId}> qui rejoint la communauté en tant que **${profil}** ! Bienvenue ! 🥳`,

  // Séquence bénévole (J+0 / J+1 / J+2)
  dmSequenceBenevole: [
    "🙌 **Bienvenue dans l'équipe bénévoles de La Java !**\nTu as maintenant accès à la catégorie BÉNÉVOLES : les annonces internes, le planning et le covoit' bénévoles. Le salon des annonces bénévoles est ton point de repère : tout ce qui est important y passe.\n\n🎂 **Un dernier truc** : dans ce même salon, un message épinglé te propose de renseigner ton anniversaire : deux cases à remplir, jour et mois. C'est notre petit rituel d'équipe, on ne voudrait pas rater le tien !",
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


  // Tickets
  // Accès ouvert (charte acceptée à l'entrée, ou réaction 🎪 sur le post de bienvenue)
  boutonAnniversaire: "Renseigner mon anniversaire",
  anniversaireTitre: "🎂 Ton anniversaire",
  anniversaireLabelJour: "Jour (1 à 31)",
  anniversaireLabelMois: "Mois (1 à 12)",
  anniversaireEnregistre: (jour: number, mois: number) =>
    `🎂 C'est noté : le **${jour}/${String(mois).padStart(2, "0")}** ! On te souhaitera ton anniversaire dans le général le jour J.\nOn ne demande jamais ton année de naissance, et tu peux demander la suppression à l'orga quand tu veux.`,
  anniversaireInvalide: "⚠️ Cette date n'existe pas : vérifie le jour et le mois (chiffres uniquement, par exemple 15 et 3 pour le 15 mars).",
  anniversaireReserve: "🎂 Les anniversaires sont réservés à l'équipe (bénévoles, référents, staff), c'est notre petit rituel interne 😉",
  anniversaireTitreSalon: "🎂 Les anniversaires de l'équipe",
  anniversaireCorpsSalon: [
    "On aime souhaiter les anniversaires entre nous, clique sur le bouton pour renseigner le tien.",
    "",
    "Deux cases à remplir (jour et mois), et c'est tout : **on ne demande jamais ton année de naissance**.",
    "Le jour J, un message part ici pour te souhaiter la fête 🎉",
    "",
    "Tu peux changer ta date quand tu veux en recliquant, ou demander sa suppression à l'orga.",
  ].join("\n"),
  accesDebloque: (userId: string) =>
    `🎪 Bienvenue à La Java, <@${userId}> ! Le serveur est grand ouvert. Les règles sont dans le salon 👋・bienvenue, et le général n'attend que toi.`,
  accesRetire:
    "Ton accès au serveur est suspendu. Écris à un membre de l'orga si tu penses que c'est une erreur.",

  // Infos pratiques épinglées dans le général (grand public)
  infosPratiquesTitre: "📍 La Java 2026 : les infos pratiques",
  infosPratiquesCorps: [
    `🗓 **Quand ?** Le **${new Date(EDITION.dateEvenement + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}**`,
    "📍 **Où ?** À Quimper. L'adresse exacte et le plan d'accès arrivent dans les annonces.",
    `🎫 **Billetterie officielle** → ${EDITION.lienBilletterie}`,
    "",
    "**Sur place**",
    "🚗 Besoin d'un covoit' ? Le salon covoiturage est fait pour ça : précise ta ville de départ.",
    "⛺ Camping, hébergement, accès : les infos tombent dans les annonces au fur et à mesure.",
    "♿ Un besoin d'accessibilité particulier ? Ouvre un ticket dans la billetterie, on s'organise.",
    "",
    "**Une question ?**",
    "Pose-la ici, quelqu'un te répondra. Pour tout ce qui touche à ta commande ou à un sujet perso, ouvre plutôt un ticket dans le salon billetterie : c'est privé.",
    "",
    "*Ce message est mis à jour au fil de la préparation, garde-le sous le coude !*",
  ].join("\n"),

  // Sujets créés d'office dans le forum infos pratiques. Volontairement
  // incomplets là où l'info n'est pas connue : à l'orga de compléter.
  infosPratiquesSujets: [
    {
      titre: "📍 Quand et où ?",
      tag: "Accès & lieu",
      corps: [
        `🗓 **${EDITION.nom}** aura lieu le **${new Date(EDITION.dateEvenement + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}**.`,
        "📍 À **Quimper**.",
        "",
        "*L'adresse exacte, le plan d'accès et les parkings seront précisés ici dès que c'est calé : ce sujet sera mis à jour.*",
      ].join("\n"),
    },
    {
      titre: "🎫 Prendre sa place",
      tag: "Billetterie",
      corps: [
        `La billetterie officielle, et la seule : ${EDITION.lienBilletterie}`,
        "",
        "⚠️ **Aucune revente hors canaux officiels.** Les annonces sauvages sont supprimées : c'est le meilleur moyen de se faire arnaquer.",
        "Un souci avec ta commande ? Ouvre un ticket dans le salon billetterie, c'est privé.",
      ].join("\n"),
    },
    {
      titre: "⛺ Dormir sur place",
      tag: "Camping & hébergement",
      corps: [
        "*Les infos camping et hébergement arrivent ici dès qu'elles sont figées.*",
        "",
        "En attendant, si tu cherches à partager une tente, un logement ou une voiture, le salon covoiturage est là pour ça 🚗",
      ].join("\n"),
    },
    {
      titre: "♿ Accessibilité",
      tag: "Accessibilité",
      corps: [
        "On veut que tout le monde puisse venir dans de bonnes conditions.",
        "",
        "Un besoin particulier (mobilité, sensoriel, accompagnement, régime alimentaire) ? **Ouvre un ticket dans le salon billetterie** : on en discute en privé et on s'organise avec toi.",
        "",
        "Rien n'est trop petit pour être demandé.",
      ].join("\n"),
    },
  ] as { titre: string; tag: string; corps: string }[],

  // Modèle épinglé dans #presentations : sans trame, personne n'ose commencer
  presentationTitre: "🙋 Présente-toi à l'équipe",
  presentationCorps: [
    "On va passer du temps ensemble, autant se connaître un peu ! Copie le modèle ci-dessous et remplis-le à ta sauce : tout est facultatif, réponds à ce qui te parle.",
    "",
    "```",
    "🏷  Prénom (ou comment on t'appelle) :",
    "📍  Tu viens d'où :",
    "🙌  Ce qui t'a donné envie de filer un coup de main :",
    "💬  Deux-trois mots sur toi :",
    "🎧  Ce que tu écoutes en boucle en ce moment :",
    "✨  Un truc que tu sais faire et qui peut servir :",
    "    (conduire un utilitaire, cuisiner pour 30, bricoler,",
    "     rassurer les gens à 4h du mat...)",
    "☕  Café, bière ou tisane pour tenir la nuit :",
    "```",
    "",
    "Et prends trente secondes pour souhaiter la bienvenue à celles et ceux qui se présentent après toi 💬",
  ].join(SAUT),

  // Rappel doux aux membres de l'équipe qui n'ont pas renseigné leur anniversaire
  rappelAnniversaire: (salon: string) =>
    `🎂 Petit rappel de La Java : on souhaite les anniversaires entre nous, et le tien nous manque !\nUn message épinglé dans **${salon}** te propose un bouton — deux cases à remplir, jour et mois, et c'est réglé. On ne demande jamais ton année 😉\n\n*Pas envie ? Ignore ce message, on ne te relancera pas.*`,

  // Salon ⭐・niveaux : généré depuis PALIERS_XP et XP, donc toujours exact
  niveauxTitre: "⭐ Les niveaux de La Java",
  niveauxCorps: [
    "Plus tu fais vivre le serveur, plus tu montes, et plus tu débloques. Rien à faire pour s'inscrire : ça compte tout seul.",
    "",
    "**Comment on gagne de l'XP**",
    `💬 **${XP.parMessageMin} à ${XP.parMessageMax} XP** par message *(une fois par minute maximum, inutile de spammer)*`,
    `❤️ **${XP.parReaction} XP** par réaction *(une fois toutes les ${XP.cooldownReactionMs / 60000} minutes)*`,
    `🎙 **${XP.vocalPointsParTranche} XP** par tranche de ${XP.vocalTrancheMinutes} minutes en vocal`,
    `🙌 **${XP.shiftBenevole} XP** par shift bénévole validé par l'orga`,
    "",
    "**Les paliers**",
    ...PALIERS_XP.filter((p) => p.seuil > 0).map((p) =>
      `**${p.seuil} XP · ${p.nom}**\n→ ${p.avantages.join(" • ")}`),
    "",
    "**Tes commandes**",
    "`/mon-profil` : ton XP, ton rang, ton prochain palier",
    "`/classement` : le top 20 du serveur",
    "",
    "*Les giveaways et le tarif préférentiel sont gérés à la main par l'orga : on vient te chercher, tu n'as rien à demander.*",
  ].join("\n"),

  pantheonTitre: "🏛 Le panthéon de La Java",
  pantheonCorps: (noms: string[]) =>
    noms.length
      ? `Celles et ceux qui ont atteint **Légende de la Java** :\n\n${noms.map((n) => `🏛 ${n}`).join("\n")}`
      : "Personne n'y est encore. La place est libre, et elle porte ton nom si tu la veux 👀",

  // Réclamation du badge d'édition, ouverte un mois après le festival
  badgeReclamationTitre: (annee: number) => `🏅 Tu étais à La Java ${annee} ?`,
  badgeReclamationCorps: (annee: number, emoji: string, xp: number, fin: string) => [
    "Le festival est passé, et on aimerait garder une trace de qui y était.",
    "",
    `**Réagis avec ${emoji} sous ce message** et le badge **Java ${annee}** est à toi, avec **${xp} XP** au passage.`,
    "",
    "On ne vérifie rien : c'est déclaratif, on te fait confiance. Le badge n'ouvre aucun salon, il dit simplement que tu en étais.",
    "",
    `⏳ *À réclamer jusqu'au ${fin}. Après, la page se tourne et on prépare l'édition suivante.*`,
  ].join("\n"),
  badgeReclamationClos: (annee: number) =>
    `🏅 **Les badges Java ${annee} ne sont plus réclamables.** Merci à toutes et tous, rendez-vous à la prochaine 🎪`,
  badgeObtenu: (annee: number, xp: number) =>
    `🏅 Badge **Java ${annee}** débloqué, et **${xp} XP** ajoutés ! Merci d'avoir fait partie de l'aventure 🎪`,

  // Relance des membres restés à la porte : sans elle, ils y restent
  // indéfiniment, personne ne s'en aperçoit.
  rappelPorte: (serveur: string, salon: string, emoji: string) => [
    `👋 Hey ! Tu as rejoint **${serveur}** il y a quelques jours, mais le serveur ne s'est pas encore ouvert pour toi.`,
    "",
    `Il ne manque qu'un geste : termine ton arrivée en acceptant la charte dans l'écran d'entrée de Discord (rouvre le serveur, elle s'affiche). Tout apparaît dans la seconde. Le salon **${salon}** t'attend ensuite ${emoji}`,
    "",
    "*Un souci pour le trouver ? Réponds à ce message, quelqu'un de l'équipe te débloque.*",
  ].join(SAUT),

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
    "**🚪 Ton arrivée.** L'écran d'entrée te fait accepter la charte et te demande ton profil : c'est la charte qui t'ouvre le serveur. Les profils bénévole/référent/artiste sont ensuite validés par l'orga, en général très vite.",
    "",
    "**⭐ Les niveaux.** Participer (messages, réactions, vocaux) fait gagner de l'XP : Nouveau → Habitué → Fêtard → Pilier de la Java → Légende de la Java, avec de vrais avantages à chaque palier (salons secrets, billetterie en avance, giveaways…). Le détail est épinglé dans le général. Tape `/mon-profil` pour voir où tu en es, `/classement` pour le top 20.",
    "",
    "**🎫 La billetterie.** Le lien officiel et le support sont dans le salon billetterie. Une question sur ta commande ? Le bouton *Ouvrir un ticket* crée une conversation privée avec l'orga.",
    "",
    "**🎂 Les anniversaires.** C'est un rituel réservé à l'équipe : si tu es bénévole, référent ou staff, un bouton dans le salon bénévoles te permet de renseigner le tien.",
    "",
    "**🙌 Bénévoles et artistes.** Une fois validé·e, tu as tes salons dédiés (planning, entraide, backstage, démos…). Tout ce qui te concerne y passe.",
    "",
    "**🆘 Besoin d'aide ?** Ticket dans la billetterie, ou DM direct à un membre du **Orga** (en rouge dans la liste des membres). On ne mord pas.",
  ].join("\n"),

  // ---------- Guide interne de l'orga (salon 📕・guide-staff) ----------
  guideStaffTitre: "📕 Mode d'emploi du bot (1/3) : le quotidien",
  guideStaffCorps: [
    "Ce salon est visible de l'orga uniquement. Tout ce qui suit est à jour du fonctionnement réel du bot.",
    "",
    "━━━━━ 🚪 **COMMENT QUELQU'UN ENTRE** ━━━━━",
    "",
    "**1. Il arrive** et reçoit aussitôt le rôle `👋 Nouvel arrivant`. Ce rôle **cache tout le serveur sauf le salon des règles**. C'est volontaire : personne ne circule sans avoir vu les règles.",
    "**2. Il remplit le questionnaire** d'arrivée de Discord. S'il demande un profil (bénévole, référent, artiste), une fiche tombe dans le salon des validations avec un ping `@Orga`.",
    "**3. Tu valides** avec le bouton vert. Si le membre a fini son arrivée, le rôle est posé aussitôt ; sinon il est **mis en réserve** et posé dès qu'il l'aura finie. La fiche te le rappelle.",
    "**4. Il accepte la charte** dans l'écran d'entrée → `👋 Nouvel arrivant` disparaît, le rôle `Membre` arrive, son profil réservé est posé, le serveur s'ouvre. Tout est automatique.",
    "",
    "⚠️ **Les étapes 3 et 4 sont indépendantes.** Il entre avant que tu valides : c'est le cas normal. Il discute dans le général pendant que tu prends ton temps.",
    "",
    "━━━━━ ✅ **LES BOUTONS DE VALIDATION** ━━━━━",
    "",
    "**✅ Approuver « profil »** : accorde le profil demandé, en un clic. C'est celui que tu utiliseras 9 fois sur 10.",
    "**🎭 Autres rôles** : si le profil demandé ne correspond pas : tu choisis toi-même le ou les rôles.",
    "**❌ Refuser** : demande un motif, envoyé au membre en message privé. Il a droit à **une** seconde tentative.",
    "**❓ Plus d'infos** : pose une question au membre en privé sans trancher. La fiche reste ouverte.",
    "",
    "Une fiche traitée perd ses boutons et affiche qui a décidé. Si deux personnes cliquent en même temps, le bot ne traite la demande qu'une fois.",
    "",
    "━━━━━ 📋 **LES FICHES MISSIONS** ━━━━━",
    "",
    "Elles vivent à deux endroits, avec deux publics différents :",
    "`🧭・coordination-referents` (catégorie RÉFÉRENTS) : la fiche bénévole **et** la fiche référent de chaque pôle, plus les échanges de coordination. Invisible des bénévoles.",
    "`📋・fiches-missions` (catégorie BÉNÉVOLES) : un sujet par pôle, la fiche mission en tête, visible de toute l'équipe.",
    "",
    "**Seuls l'orga et les Référents ouvrent les sujets** du second : les bénévoles ne peuvent que répondre dedans, pour éviter que chacun crée sa propre fiche. Les tags se modifient dans les paramètres du salon, sans toucher au bot.",
    "",
    "━━━━━ 🎫 **LES TICKETS** ━━━━━",
    "",
    "Un membre ouvre un ticket depuis le salon billetterie : un salon privé se crée, l'orga est prévenu. Pour le clore, tape `/fermer-ticket` **dedans** : le transcript part dans les logs avant suppression.",
  ].join("\n"),

  guideStaffCommandesTitre: "📕 Mode d'emploi du bot (2/3) : les commandes",
  guideStaffCommandesCorps: [
    "Les commandes marquées **(Orga)** sont refusées aux autres membres, où qu'elles soient tapées.",
    "",
    "━━━━━ 👥 **COMMUNAUTÉ** ━━━━━",
    "",
    "`/suivi` **(Orga)** : **qui** attend quoi, nommément. Trois files : les candidatures à valider, les profils validés dont le membre n'a pas fini son arrivée, et ceux restés à la porte. Seule la première demande une action de ta part.",
    "`/stats` **(Orga)** : tableau de bord chiffré : arrivées, taux de validation, sources, croissance, rétention.",
    "`/sondage` : crée un sondage à réactions (2 à 10 options, séparées par des `;`).",
    "`/sondage-resultats` : affiche le dépouillement du dernier sondage du salon.",
    "`/classement` · `/mon-profil` : accessibles à tous, l'XP et les paliers.",
    "",
    "━━━━━ ⭐ **XP ET BADGES** ━━━━━",
    "",
    "`/xp-add` **(Orga)** : ajoute des points, avec un motif. Sert surtout à récompenser un shift bénévole.",
    "`/attribuer-badge` **(Orga)** : pose un badge d'édition passée (`Java 2024`…) sur quelqu'un qui y était. Les badges sont cumulables.",
    "",
    "L'XP se gagne seul : messages (+15 à 40, une fois par minute), réactions (+25, une fois par 5 min), vocal (+10 par tranche de 10 min). Le salon AFK et le casque coupé ne rapportent rien.",
    "",
    "━━━━━ 🎂 **ANNIVERSAIRES** ━━━━━",
    "",
    "`/anniversaires-liste` **(Orga)** : les anniversaires des 7 prochains jours.",
    "Le rituel est réservé à l'équipe : le bouton d'enregistrement est dans le salon bénévoles, et l'annonce y tombe aussi. Seuls le jour et le mois sont conservés, jamais l'année.",
    "",
    "━━━━━ 🔐 **DONNÉES ET RGPD** ━━━━━",
    "",
    "`/export-onboarding` **(Orga)** : exporte toutes les candidatures en CSV.",
    "`/oublier-membre` **(Orga)** : **irréversible** : efface toutes les données d'un membre (candidature, XP, anniversaire). À utiliser sur demande explicite de la personne.",
  ].join("\n"),

  guideStaffAdminTitre: "📕 Mode d'emploi du bot (3/3) : administration",
  guideStaffAdminCorps: [
    "━━━━━ 🛠 **STRUCTURE DU SERVEUR** ━━━━━",
    "",
    "`/setup-serveur` : crée ou complète rôles, catégories, salons et messages d'accueil. **Sans danger, relançable autant de fois que voulu** : ce qui existe est conservé, seules les permissions sont réappliquées. À relancer après toute modification de la configuration du bot.",
    "`/ouvrir-salon` : révèle un salon masqué (les photos par exemple) en lui appliquant les permissions normales de sa catégorie.",
    "",
    "⚠️ Le bot ne supprime jamais un rôle ni un salon. Retirer quelque chose de la configuration l'empêche d'être recréé, mais le nettoyage se fait à la main.",
    "",
    "━━━━━ 🚨 **URGENCE : RAID** ━━━━━",
    "",
    "`/lockdown on` **(Orga)** : suspend toutes les validations. Le bot le déclenche **tout seul** au-delà de 10 arrivées en 60 secondes, et prévient dans les alertes.",
    "`/lockdown off` : retour à la normale, une fois les comptes suspects vérifiés.",
    "",
    "Le bot supprime déjà seul les invitations Discord tierces et les liens suspects postés par les non-orga, et trace tout dans les alertes.",
    "",
    "━━━━━ 🗄 **FIN D'ÉDITION** ━━━━━",
    "",
    "`/archiver-edition` **(Orga)** : la commande de passage d'une année à l'autre. Elle bascule tous les `Bénévole` en `Ancien bénévole`, passe la catégorie de l'édition en archives lecture seule, et prépare le badge de l'année suivante.",
    "",
    "⚠️ **L'ordre compte.** Lance `/archiver-edition` **d'abord**, change l'année dans la configuration du bot **ensuite**, puis relance `/setup-serveur`. Dans l'autre sens, la commande chercherait un rôle que personne ne porte encore et ne basculerait personne.",
    "",
    "Les badges d'édition ne sont jamais retirés : ils sont la mémoire de qui était là, année après année.",
  ].join("\n"),

  billetterieTitre: "🎫 Billetterie La Java",
  billetterieCorps: [
    `🎟 **Prends ta place ici, et nulle part ailleurs :**\n👉 ${EDITION.lienBilletterie}`,
    "",
    "**Une question, un souci de commande, un remboursement ?**",
    "Ouvre un ticket avec le bouton ci-dessous : un fil privé s'ouvre avec l'orga, personne d'autre ne voit vos échanges.",
    "",
    "⚠️ **Aucune revente hors canaux officiels** : les annonces de revente sauvage sont supprimées et leurs auteurs sanctionnés.",
  ].join("\n"),
  boutonTicket: "Ouvrir un ticket",
  ticketOuvert: (userId: string, staffRoleId: string) =>
    `✉️ Ticket ouvert par <@${userId}> : <@&${staffRoleId}> est prévenu.\nExplique-nous ta demande, on te répond au plus vite !`,
  ticketFerme: "🔒 Ticket fermé. Le transcript a été archivé par l'orga. Merci !",

  // Modération / anti-raid
  lockdownOn: "🚨 **LOCKDOWN ACTIVÉ** : les validations sont suspendues et la vérification est verrouillée.",
  lockdownOff: "✅ Lockdown désactivé : retour à la normale.",
  alerteRaid: (nb: number, staffRoleId: string) =>
    `🚨 <@&${staffRoleId}> **ALERTE RAID** : ${nb} arrivées en moins de 60 secondes. Lockdown automatique activé. Vérifiez les nouveaux comptes avant de désactiver (\`/lockdown off\`).`,
  lienSupprime: (userId: string) =>
    `⚠️ Message de <@${userId}> supprimé : lien d'invitation ou lien suspect (réservé à l'orga).`,
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

// Domaines de raccourcisseurs / grabbers considérés comme suspects pour les non-orga
export const DOMAINES_SUSPECTS = [
  "bit.ly", "tinyurl.com", "grabify.link", "iplogger.org", "cutt.ly", "is.gd", "shorturl.at",
];

export const SEUIL_COMPTE_RECENT_JOURS = 7;
