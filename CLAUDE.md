# La Java Bot

Bot Discord communautaire du festival **La Java** (Dans La Zone, Quimper). Édition en cours : **2026, festival le 28 août 2026**. Serveur Discord : guild `1528714544568860762`, bot « La Java Admin ».

Ce fichier est le contexte partagé entre toutes les sessions Claude (PC, Mac, cloud). Le tenir à jour quand une décision de fond change.

## Stack et démarrage

- Node 20+, TypeScript strict, ESM (NodeNext). discord.js v14, better-sqlite3 (WAL), node-cron (timezone Europe/Paris).
- `npm install` compile via `postinstall: tsc`. Entrée : `index.js` (racine) qui importe `dist/index.js`.
- `.env` (jamais commité) : `DISCORD_TOKEN`, `GUILD_ID=1528714544568860762`.
- Base SQLite dans `data/` (jamais commitée) : XP, onboarding, anniversaires, sondages, kv. La seule base qui compte est **celle de l'hébergeur**, pas la locale.

## Hébergement et déploiement

- Hébergé sur **Northost** (panel Pterodactyl). Le conteneur fait `git pull` puis `npm install; node index.js` à chaque démarrage.
- **Déployer = `git push` sur `main`, puis Seb clique REDÉMARRER sur le panel.** Aucun push ne prend effet sans ce redémarrage manuel. C'est LE point d'oubli récurrent : après tout push, rappeler explicitement le redémarrage.
- Une seule session Claude à la fois sur ce repo (des sessions cloud et locale en parallèle ont déjà produit des commits divergents).

## Modèle d'accès (décision du 23/08/2026, ne pas revenir en arrière)

- L'accès s'ouvre quand le membre **accepte la charte dans l'écran d'entrée natif de Discord** (il cesse d'être `pending`). Fonction centrale : `ouvrirAcces()` dans `src/services/onboarding.ts`. Balayages de rattrapage au démarrage et toutes les minutes (`debloquerCharteAcceptee`).
- L'ancienne barrière par **réaction 🎪** sur le post de bienvenue a été supprimée : elle perdait un arrivant sur trois. La réaction reste comme simple geste, sans effet sur l'accès.
- Rôle-barrière `👋 Nouvel arrivant` : posé à l'arrivée, retiré à l'acceptation de la charte. Durée de vie normale : quelques secondes. S'il reste sur quelqu'un, c'est que la personne a fermé l'écran de charte sans accepter.
- Le questionnaire d'entrée natif (onboarding Discord) pose `⏳ En attente de validation` + un rôle `Candidat X` quand le profil coché demande validation (Bénévole, Référent, Artiste, Artiste communauté). L'orga valide dans `#📋・validation-demandes`. Un profil validé avant la fin de l'arrivée est mis en réserve (kv `profil_attente:`) et posé automatiquement.
- Les fiches de validation closes gardent un bouton **« Modifier les rôles »** pour corriger une décision. Le menu propose « Festivalier (accès simple) » en tête pour valider sans rôle d'équipe.

## Modèle de rôles

Trois familles, à ne pas mélanger :

1. **Attribués par un humain** : Direction (10/09, gestion serveur sans Administrateur : rôles, salons, modération ; hors config, ne pas recréer via provision), Orga (renommé depuis « Staff » le 09/09, config `ROLES.staff`), Référent, Bénévole (sans année : l'année vient du badge), Artiste, Artiste Communauté, Ancien bénévole (posé par `/archiver-edition`).
2. **Automatiques** : `Membre` (clé d'accès, posé à la charte, gardé à vie) ; paliers XP `Habitué` (500) → `Fêtard` (2000) → `Pilier de la Java` (6000) → `Légende de la Java` (20000) ; badges d'édition `Java <année>` (réclamés par réaction sur l'annonce ouverte le lendemain du festival, 1 mois, +500 XP une seule fois, kv `badge_xp:`).
3. **Techniques éphémères** : `👋 Nouvel arrivant`, `⏳ En attente de validation`, `Candidat ×4`.

Le palier de départ **« Festivalier » n'a pas de rôle Discord** (`sansRole: true` dans `PALIERS_XP`) : être Membre sans palier supérieur = Festivalier. Ne pas recréer ce rôle.

## XP

`src/services/xp.ts`. Messages 15-40 XP (cooldown 1 min), réaction 10, vocal 10/10 min (hors AFK/sourdine), shift bénévole validé 500, badge d'édition 500. Pas d'XP derrière la barrière. Les rôles de palier se synchronisent à chaque gain et au démarrage (`resynchroniserPaliers`, qui couvre tous les Membres, y compris sans ligne XP).

## Salons, points notables

- Tout est résolu **par nom** depuis `SALONS`/`ROLES` dans `src/config/config.ts`. Renommer un salon dans Discord sans mettre à jour la config casse la résolution.
- `🎫・billetterie` : @everyone garde VIEW+SEND au niveau Discord car **l'onboarding natif exige au moins un salon lisible et inscriptible par @everyone** (erreur 350005 sinon). L'écriture y est bloquée par un deny explicite sur Membre, et la barrière le cache aux arrivants.
- `🗳️・votes-communaute` (emoji avec sélecteur de variante U+FE0F, comme la catégorie 🛠️ ORGA) et le vocal Afters : palier Habitué minimum (`palierMin`).
- `Live & Talks` (stage) : fermé, le Staff l'ouvre pour les événements.
- La catégorie `🎪 LA JAVA` est **intemporelle** (plus d'année dans le nom, plus d'archivage annuel de la catégorie dans `/archiver-edition`) ; `🎶・partage-sons` y accueille sons, mix et découvertes, ouvert à tous les Membres.
- Fiches missions bénévoles/référents : un topic par pôle dans le forum `🧭・coordination-referents` (script `scripts/fiches-missions.mjs`).
- Anniversaires : équipe seulement, saisis par bouton dans `#🙌・blabla-benevoles`, annonce à 10h dans ce même salon.

## Catégorie 🛠️ ORGA (09/09/2026) : l'unique espace de travail

L'ancienne catégorie STAFF a fusionné dedans : la visibilité se règle salon par salon, pas par catégorie.

- `🎛️・general` (ex staff-general ; l'emoji le distingue du général communautaire) et `validation-demandes` : rôle Orga. Déclarés dans `STRUCTURE` (catégorie « 🛠️ ORGA » côté config).
- Salons de pôle `benevolat`, `programmation`, `bar`, `merch`, `securite-prevention`, `communication` : Staff + les référents du pôle ajoutés **nominativement** (pas de rôle par pôle). **Hors `STRUCTURE`** : un `/setup-serveur` ne doit jamais les toucher, sous peine d'effacer les accès individuels. Ne pas confondre le pôle `benevolat` (orga) avec les salons communautaires bénévoles.
- `logs-bot` : Seb uniquement (attention, un `/setup-serveur` le rouvrirait au Staff, à reverrouiller après). Reçoit aussi les alertes anti-raid et liens supprimés (`guide-staff` et `alertes-moderation` ont été supprimés).
- `🛡・maj-discord` : ancien alertes-moderation, insupprimable par bot (réceptacle « mises à jour communauté » Discord), verrouillé sur Seb en attendant le déplacement du réglage à la main.

Par ailleurs : LABEL & DÉMOS a fusionné dans ARTISTES ; le forum `demos-et-promos` garde l'accès Artiste Communauté via `accesSupplement` (champ par salon dans config). Migration depuis le serveur Dans La Zone en cours : sa catégorie LA JAVA passera en lecture seule.

## Conventions d'écriture (exigences de Seb)

- Tous les textes utilisateur en **français, sans tirets quadratins** (ni « — » ni « – » dans les messages Discord).
- Messages épinglés : régénérés depuis la config par `scripts/maj-epingles.mjs`, jamais édités à la main.
- Dans `config.ts`, les sauts de ligne des textes multi-lignes passent par la constante `SAUT` ou des template literals.
- Commits en français, descriptifs, avec le pourquoi.

## Pièges connus de l'outillage

- Les heredocs Bash mangent parfois les antislashs (`\n` écrit dans un fichier devient un vrai saut de ligne) : pour patcher `config.ts`, préférer des remplacements ligne à ligne en Python avec `chr(92)` pour l'antislash, et attention aux fins de ligne CRLF.
- L'API Discord limite les PATCH sur les messages de plus d'une heure (429 code 30046) : boucler avec attente sur `retry_after`.
- Scripts one-shot dans `scripts/*.mjs` : REST brut avec le token du `.env`, importent la config compilée depuis `dist/config/config.js` (compiler avant).

## Où en est le projet (09/09/2026)

- Festival passé (28/08), ~58 membres, porte à zéro, bascule charte en production.
- Réclamation du badge Java 2026 : jamais ouverte (id de message mort en kv), correctif d'auto-republication poussé le 09/09, s'active au redémarrage.
- Migration depuis Dans La Zone en cours : catégorie ORGA créée ici, reste à peupler les accès par pôle, poster l'annonce là-bas, passer l'ancienne catégorie en lecture seule.
- Ensuite : `/archiver-edition` quand Seb le décide, puis `EDITION.annee = 2027` et `/setup-serveur`.
