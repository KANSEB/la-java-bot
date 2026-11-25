# La Java Bot

Bot Discord du festival **La Java** (Dans La Zone, Quimper). Dernière édition : **28 août 2026**. Depuis le 26/11/2026, le serveur est un **outil d'équipe** (orga, référents, bénévoles, artistes), plus une communauté à animer : XP, paliers, badges, sondages et salons communautaires ont été retirés. Serveur Discord : guild `1528714544568860762`, bot « La Java Admin ».

Ce fichier est le contexte partagé entre toutes les sessions Claude (PC, Mac, cloud). Le tenir à jour quand une décision de fond change.

## Stack et démarrage

- Node 20+, TypeScript strict, ESM (NodeNext). discord.js v14, better-sqlite3 (WAL), node-cron (timezone Europe/Paris).
- `npm install` compile via `postinstall: tsc`. Entrée : `index.js` (racine) qui importe `dist/index.js`.
- `.env` (jamais commité) : `DISCORD_TOKEN`, `GUILD_ID=1528714544568860762`.
- Base SQLite dans `data/` (jamais commitée) : onboarding, anniversaires, kv. Les tables `xp` et `sondages` restent en base, inutilisées (le code XP est récupérable dans l'historique git, avant le commit du 26/11/2026). La seule base qui compte est **celle de l'hébergeur**, pas la locale.

## Hébergement et déploiement

- Hébergé sur **Northost** (panel Pterodactyl). Le conteneur fait `git pull` puis `npm install; node index.js` à chaque démarrage.
- **Déployer = `git push` sur `main`, puis Seb clique REDÉMARRER sur le panel.** Aucun push ne prend effet sans ce redémarrage manuel. C'est LE point d'oubli récurrent : après tout push, rappeler explicitement le redémarrage.
- Une seule session Claude à la fois sur ce repo (des sessions cloud et locale en parallèle ont déjà produit des commits divergents).

## Modèle d'accès (décision du 23/08/2026, ne pas revenir en arrière)

- L'accès s'ouvre quand le membre **accepte la charte dans l'écran d'entrée natif de Discord** (il cesse d'être `pending`). Fonction centrale : `ouvrirAcces()` dans `src/services/onboarding.ts`. Balayages de rattrapage au démarrage et toutes les minutes (`debloquerCharteAcceptee`).
- L'ancienne barrière par **réaction 🎪** sur le post de bienvenue a été supprimée : elle perdait un arrivant sur trois. La réaction reste comme simple geste, sans effet sur l'accès.
- Rôle-barrière `👋 Nouvel arrivant` : posé à l'arrivée, retiré à l'acceptation de la charte. Durée de vie normale : quelques secondes. S'il reste sur quelqu'un, c'est que la personne a fermé l'écran de charte sans accepter.
- Le questionnaire d'entrée natif (onboarding Discord, une seule question : le profil) pose un rôle `Candidat X` quand le profil coché demande validation (Bénévole, Référent, Artiste). Le bot repère ces marqueurs (`candidatureDe`, `estMarqueurCandidature`) et poste une fiche dans `#📋・validation-demandes`. Le rôle `⏳ En attente de validation` a été supprimé le 26/11/2026 : les marqueurs suffisent. Un profil validé avant la fin de l'arrivée est mis en réserve (kv `profil_attente:`) et posé automatiquement.
- Les fiches de validation closes gardent un bouton **« Modifier les rôles »** pour corriger une décision. Le menu propose « Festivalier (accès simple) » en tête pour valider sans rôle d'équipe.

## Modèle de rôles (simplifié le 26/11/2026)

Trois familles, à ne pas mélanger :

1. **Attribués par un humain** : Direction (10/09, gestion serveur sans Administrateur : rôles, salons, modération ; hors config, ne pas recréer via provision), Orga (renommé depuis « Staff » le 09/09, config `ROLES.staff`), Référent, Bénévole (global et permanent, sans année), Artiste (Artiste Communauté y a fusionné le 26/11).
2. **Automatique** : `Membre` (clé d'accès, posé à la charte, gardé à vie). Être Membre sans rôle d'équipe = Festivalier (aucun rôle Discord pour ça, ne pas en recréer).
3. **Techniques éphémères** : `👋 Nouvel arrivant`, `Candidat Bénévole`, `Candidat Référent`, `Candidat Artiste`.

Supprimés le 26/11/2026, ne pas recréer : paliers XP (Habitué, Fêtard, Pilier, Légende), badges `Java <année>`, `⏳ En attente de validation`, `Artiste Communauté` et son marqueur.

## Salons, points notables

- Tout est résolu **par nom** depuis `SALONS`/`ROLES` dans `src/config/config.ts`. Renommer un salon dans Discord sans mettre à jour la config casse la résolution.
- `🎫・billetterie` : @everyone garde VIEW+SEND au niveau Discord car **l'onboarding natif exige au moins un salon lisible et inscriptible par @everyone** (erreur 350005 sinon). L'écriture y est bloquée par un deny explicite sur Membre, et la barrière le cache aux arrivants.
- La catégorie `🎪 LA JAVA` est **intemporelle** : général, billetterie, covoiturage, photos, gardés pour la prochaine édition. Supprimés le 26/11 : `⭐・niveaux`, `🗳️・votes-communaute`, `🎶・partage-sons`, la catégorie VOCAUX (Bar, Terrasse, Afters, Live & Talks). Les équipes gardent leurs vocaux dans leurs catégories.
- Emojis à sélecteur de variante U+FE0F (🛠️, 🎛️, 🎟️) : à écrire avec le sélecteur sinon la résolution par nom échoue.
- Fiches missions bénévoles/référents : un topic par pôle dans le forum `🧭・coordination-referents` (script `scripts/fiches-missions.mjs`).
- Anniversaires : équipe seulement, saisis par bouton dans `#🙌・blabla-benevoles`, annonce à 10h dans ce même salon.

## Catégorie 🛠️ ORGA (09/09/2026) : l'unique espace de travail

L'ancienne catégorie STAFF a fusionné dedans : la visibilité se règle salon par salon, pas par catégorie.

- `🎛️・general` (ex staff-general ; l'emoji le distingue du général communautaire) et `validation-demandes` : rôle Orga. Déclarés dans `STRUCTURE` (catégorie « 🛠️ ORGA » côté config).
- Salons de pôle `benevolat`, `programmation`, `bar`, `merch`, `securite-prevention`, `communication` : Staff + les référents du pôle ajoutés **nominativement** (pas de rôle par pôle). **Hors `STRUCTURE`** : un `/setup-serveur` ne doit jamais les toucher, sous peine d'effacer les accès individuels. Ne pas confondre le pôle `benevolat` (orga) avec les salons communautaires bénévoles.
- `🎟️・billetterie-orga` : créé à la main dans ORGA, renommé le 26/11 pour ne plus porter le même nom que la billetterie publique (le bot résout par nom).
- `logs-bot` : Seb uniquement (attention, un `/setup-serveur` le rouvrirait au Staff, à reverrouiller après). Reçoit aussi les alertes anti-raid et liens supprimés (`guide-staff` et `alertes-moderation` ont été supprimés).
- `🛡・maj-discord` : ancien alertes-moderation, insupprimable par bot (réceptacle « mises à jour communauté » Discord), verrouillé sur Seb en attendant le déplacement du réglage à la main.

Par ailleurs : LABEL & DÉMOS a fusionné dans ARTISTES (forum `demos-et-promos`, rôle Artiste). Le champ `accesSupplement` (par salon dans la config) reste disponible pour ouvrir un salon à un rôle de plus. Migration depuis le serveur Dans La Zone en cours : sa catégorie LA JAVA passera en lecture seule.

## Conventions d'écriture (exigences de Seb)

- Tous les textes utilisateur en **français, sans tirets quadratins** (ni « — » ni « – » dans les messages Discord).
- Messages épinglés : régénérés depuis la config par `scripts/maj-epingles.mjs`, jamais édités à la main.
- Dans `config.ts`, les sauts de ligne des textes multi-lignes passent par la constante `SAUT` ou des template literals.
- Commits en français, descriptifs, avec le pourquoi.

## Pièges connus de l'outillage

- Les heredocs Bash mangent parfois les antislashs (`\n` écrit dans un fichier devient un vrai saut de ligne) : pour patcher `config.ts`, préférer des remplacements ligne à ligne en Python avec `chr(92)` pour l'antislash, et attention aux fins de ligne CRLF.
- L'API Discord limite les PATCH sur les messages de plus d'une heure (429 code 30046) : boucler avec attente sur `retry_after`.
- Scripts one-shot dans `scripts/*.mjs` : REST brut avec le token du `.env`, importent la config compilée depuis `dist/config/config.js` (compiler avant).

## Où en est le projet (26/11/2026)

- Festival passé (28/08), ~63 membres, porte à zéro. Constat du 25/11 : la partie communauté ne vivait pas (général communautaire muet depuis le 18/08), l'activité est dans les salons de travail. D'où la simplification « outil d'équipe » du 26/11.
- Commandes restantes : `/setup-serveur`, `/ouvrir-salon`, `/suivi`, `/export-onboarding`, `/oublier-membre`, `/anniversaires-liste`, `/stats`, `/lockdown`, `/fermer-ticket`. Plus de `/xp-add`, `/classement`, `/mon-profil`, `/sondage`, `/attribuer-badge`, `/archiver-edition` (pour sonder l'équipe : sondages natifs de Discord).
- Migration depuis Dans La Zone : reste à peupler les accès par pôle au fil de l'eau, poster l'annonce là-bas, passer l'ancienne catégorie en lecture seule.
- Avant la prochaine édition : `EDITION` dans la config (année, date, lien billetterie), puis `/setup-serveur`.
