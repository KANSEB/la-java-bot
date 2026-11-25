// ============================================================
// CONFIGURATION CENTRALE : La Java (Dans La Zone, Quimper)
// Tout se règle ici : rôles, salons, textes, délais.
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
  benevoleEdition: { nom: "Bénévole", couleur: 0x2ecc71, hoist: true, mentionnable: true, permissions: [] },
  membre: { nom: "Membre", couleur: 0x99aab5, hoist: false, mentionnable: false, permissions: [] },
};


// Rôle-barrière posé sur chaque arrivant : il masque tout le serveur sauf le
// salon des règles. Il est retiré dès que la charte de l'écran d'entrée est acceptée.
// Sans permission propre : il ne fait qu'interdire.
export const ROLE_PORTE = { nom: "👋 Nouvel arrivant", couleur: 0x4f545c };

// Marqueurs de profil : le questionnaire natif pose un rôle « Candidat X » quand
// le profil demande une validation. Le bot le repère et l'orga approuve en un clic.
// Le profil "Festivalier" n'est PAS ici : il entre sans validation.
export const CANDIDATURES: { marqueur: string; profil: string; emoji: string; roleKey: keyof typeof ROLES | null }[] = [
  { marqueur: "Candidat Bénévole", profil: "Bénévole", emoji: "🙌", roleKey: "benevoleEdition" },
  { marqueur: "Candidat Référent", profil: "Référent", emoji: "🧭", roleKey: "referent" },
  { marqueur: "Candidat Artiste", profil: "Artiste", emoji: "🎤", roleKey: "artiste" },
];

// Profil grand public : accès direct sans validation
export const PROFIL_DIRECT = { titre: "Festivalier", emoji: "🎉" };

// ---------- Délais (heures/jours) ----------
export const DELAIS = {
  dmSequenceHeures: 24,
  archivageCovoitJoursApresEvent: 7,
};

// ---------- Anniversaires ----------
// Réservés à l'équipe : dans le général ce serait du bruit, entre bénévoles
// c'est un petit rituel sympa. `salonAnnonce` et `rolesAutorises` suffisent
// à tout déplacer (par ex. vers "general" pour ouvrir à tout le monde).
export const ANNIVERSAIRES = {
  salonAnnonce: "benevoles" as const,
  rolesAutorises: ["benevoleEdition", "referent", "staff"] as (keyof typeof ROLES)[],
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
  general: "💬・general",
  presentations: "🙋・presentations",
  billetterie: "🎫・billetterie",
  covoiturage: "🚗・covoiturage",
  photos: "📸・vos-photos-videos",
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
  staffGeneral: "🎛️・general",
  validation: "📋・validation-demandes",
  logs: "🤖・logs-bot",
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
    ],
  },
  {
    nom: "📢 ACTU",
    acces: "public",
    salons: [
      { cle: "annonces", type: "annonce", lectureSeule: true, visiblePublic: true, sujet: "Les annonces officielles de La Java : infos, line-up, billetterie" },
      { cle: "actuServeur", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Changelog du Discord : nouveautés, salons ouverts" },
    ],
  },
  {
    nom: "🎪 LA JAVA",  // intemporelle : la communauté vit toute l'année, l'édition n'est qu'un moment
    acces: "public",
    salons: [
      { cle: "general", type: "texte", visiblePublic: true, sujet: "Le bar principal de la communauté : parle de tout ici" },
      { cle: "billetterie", type: "texte", lectureSeule: true, visiblePublic: true, sujet: "Questions billetterie : ouvre un ticket avec le bouton" },
      { cle: "covoiturage", type: "texte", sujet: "Propose ou cherche un covoit' pour La Java : précise ta ville de départ !" },
      { cle: "photos", type: "texte", sujet: "Vos plus beaux souvenirs en photo et vidéo, balancez tout !" },
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
      { cle: "backstage", type: "texte", sujet: "Le backstage virtuel : entre artistes" },
      { cle: "demos", type: "forum", sujet: "Balance tes prods, demande des retours",
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
];

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
    "😄 **Réagir.** Survole un message → l'icône émoji permet d'ajouter une réaction. C'est comme un like.",
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
    "**🎫 La billetterie.** Le lien officiel et le support sont dans le salon billetterie. Une question sur ta commande ? Le bouton *Ouvrir un ticket* crée une conversation privée avec l'orga.",
    "",
    "**🎂 Les anniversaires.** C'est un rituel réservé à l'équipe : si tu es bénévole, référent ou de l'orga, un bouton dans le salon bénévoles te permet de renseigner le tien.",
    "",
    "**🙌 Bénévoles et artistes.** Une fois validé·e, tu as tes salons dédiés (planning, entraide, backstage, démos…). Tout ce qui te concerne y passe.",
    "",
    "**🆘 Besoin d'aide ?** Ticket dans la billetterie, ou DM direct à un membre de l'**Orga** (en rouge dans la liste des membres). On ne mord pas.",
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
