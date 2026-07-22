# 🎪 Bot Discord La Java

Bot communautaire du festival **La Java** (Dans La Zone, Quimper) : provisioning complet du serveur, onboarding par questionnaire avec validation manuelle du Staff, rôles, XP, badges d'édition, tickets, anti-raid.

**Stack :** Node.js 20+, TypeScript strict, discord.js v14, better-sqlite3, node-cron.

---

## 1. Création de l'application Discord (portail développeur)

1. Va sur <https://discord.com/developers/applications> → **New Application** → nomme-la « La Java ».
2. Onglet **Bot** :
   - **Reset Token** → copie le token (il ne sera plus jamais affiché — garde-le secret).
   - Dans **Privileged Gateway Intents**, active :
     - ✅ **SERVER MEMBERS INTENT** (arrivées, rôles, kicks automatiques)
     - ✅ **MESSAGE CONTENT INTENT** (XP messages, filtre anti-liens)
     - ✅ **PRESENCE INTENT** (facultatif mais recommandé pour les stats)
3. Onglet **OAuth2 → URL Generator** :
   - **Scopes** : `bot` + `applications.commands`
   - **Bot Permissions** : `Manage Roles`, `Manage Channels`, `Kick Members`, `Manage Messages`, `Manage Threads`, `Create Public Threads`, `Create Private Threads`, `Send Messages`, `Send Messages in Threads`, `Embed Links`, `Attach Files`, `Read Message History`, `Add Reactions`, `Mention Everyone`, `View Audit Log`
     *(ou `Administrator` pour faire simple pendant la mise en place)*
   - Ouvre l'URL générée et invite le bot sur ton serveur.

## 2. Installation

```bash
git clone <ton-repo> && cd la-java-bot   # ou copie le dossier
npm install
cp .env.example .env                      # Windows : copy .env.example .env
```

Édite `.env` :

| Variable | Valeur |
|---|---|
| `DISCORD_TOKEN` | Le token du bot (étape 1) |
| `GUILD_ID` | Clic droit sur ton serveur → *Copier l'identifiant* (active le Mode développeur dans Paramètres → Avancés) |
| `DB_PATH` | Optionnel — chemin de la base SQLite (défaut `./data/lajava.db`) |

## 3. Premier lancement — ordre exact des opérations

```bash
npm run build     # compile le TypeScript
npm start         # démarre le bot (ou npm run dev pour le développement)
```

Puis, **dans Discord, dans cet ordre** :

1. **Monte le rôle du bot tout en haut** : Paramètres du serveur → Rôles → glisse le rôle du bot au-dessus de tout (sinon il ne pourra ni créer ni attribuer les rôles).
2. Lance **`/setup-serveur`** : crée les 10 rôles fonctionnels, les cosmétiques (badges, paliers XP, Bénévole du Mois), les 9 catégories, ~35 salons avec permissions, et poste les messages d'accueil/vérification/billetterie. **Relançable sans risque** : la commande complète uniquement ce qui manque.
3. **Active la Communauté** (Paramètres → Activer la communauté) si ce n'est pas fait — nécessaire pour les salons d'annonces, les forums et le stage.
4. **Active le Membership Screening** : Paramètres → Sécurité (Safety Setup) → règles à accepter. *(Non configurable par l'API : à faire à la main, 2 minutes.)*
5. Ajuste à la marge : ordre des catégories, emojis du serveur, follow de #annonces depuis d'autres serveurs.
6. Teste le parcours complet avec un compte secondaire : arrivée → rôle Non vérifié → questionnaire → validation dans `#validation-demandes` → accès débloqué.

## 4. Ce que fait le bot au quotidien

| Quand | Quoi |
|---|---|
| Arrivée d'un membre | Rôle **Non vérifié**, DM de bienvenue, ping dans #verification, détection anti-raid |
| Questionnaire soumis | Embed complet dans #validation-demandes (avatar, ancienneté du compte, réponses, flag compte < 7 jours) avec boutons **Approuver / Refuser / Plus d'infos** |
| Approbation | Rôles attribués + Membre, retrait Non vérifié, badge d'édition auto (bénévole/artiste), DM de confirmation, bienvenue dans #general, séquence 3 DM bénévole (J0/J+1/J+2) |
| 9h00 | Compte à rebours J-XXX mis à jour (épinglé #general et #benevoles), rappels 48h / avertissement J-1 / kick 7 jours des Non vérifiés, archivage covoiturage post-événement |
| 10h00 | Annonces d'anniversaires dans #general |
| Toutes les heures | Expiration Bénévole du Mois (30 j), envoi des séquences DM |
| Toutes les 10 min | +10 XP à chaque membre en vocal |
| Chaque message | +5 XP (cooldown 60 s), filtre anti-invitations et liens suspects pour les non-Staff |
| En continu | Logs exhaustifs dans #logs-bot, lockdown auto si > 10 arrivées / 60 s |

## 5. Commandes

**Staff** : `/setup-serveur`, `/ouvrir-salon`, `/export-onboarding`, `/verif-rappel`, `/oublier-membre` (RGPD), `/attribuer-badge`, `/archiver-edition`, `/xp-add`, `/anniversaires-liste`, `/shoutout`, `/lockdown on|off`, `/stats`
**Tout le monde** : `/mon-profil`, `/classement`, `/anniversaire`, `/sondage`, `/sondage-resultats`, `/fermer-ticket` (auteur ou Staff)

## 6. Points de vigilance sur les permissions Discord

- **Hiérarchie des rôles** : le bot ne peut attribuer/retirer que des rôles **situés sous son propre rôle**. Après `/setup-serveur`, vérifie qu'il est au-dessus de Staff. Même règle pour les humains : un Staff ne peut pas gérer un rôle au-dessus du sien.
- **Staff sans `Manage Roles` ni `Manage Guild`** : volontaire — la gestion des rôles et du serveur reste aux fondateurs. L'attribution de rôles passe par le bot (boutons de validation), pas par les permissions du Staff.
- **Salons d'annonces / forums / stage** : nécessitent la fonctionnalité **Communauté** activée. Les MEDIA channels ne sont pas disponibles partout — le bot bascule automatiquement en forum si la création échoue.
- **DM fermés** : le bot ne peut pas DM un membre qui a désactivé les messages privés du serveur. Il ne crashe pas : il le signale dans la réponse au Staff et dans #logs-bot.
- **Membership Screening et le follow des annonces** ne sont pas pilotables par l'API : configuration manuelle (une fois).
- **`View Audit Log`** est nécessaire pour distinguer un départ d'un kick dans les logs.
- Si tu retires `Administrator` au bot après la mise en place, garde au minimum la liste de permissions de l'étape 1.3.

## 7. Déploiement

Le bot doit tourner **en continu** (crons, boutons, tickets).

### Railway (simple, ~5 €/mois)
1. Pousse le projet sur GitHub (le `.gitignore` exclut `.env` et `data/`).
2. Sur <https://railway.app> : **New Project → Deploy from GitHub repo**.
3. Variables d'environnement : `DISCORD_TOKEN`, `GUILD_ID`, et `DB_PATH=/data/lajava.db`.
4. Ajoute un **Volume** monté sur `/data` (sinon la base SQLite est effacée à chaque déploiement !).
5. Build : `npm run build` — Start : `npm start` (détectés automatiquement).

### VPS (Hetzner, OVH... ~4 €/mois)
```bash
# Sur le serveur (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
git clone <ton-repo> && cd la-java-bot && npm install && npm run build
cp .env.example .env && nano .env        # remplis token + guild id
sudo npm install -g pm2
pm2 start dist/index.js --name la-java-bot
pm2 save && pm2 startup                  # redémarrage automatique au reboot
```
Sauvegarde régulière de `data/lajava.db` (c'est toute la mémoire du bot) : `crontab -e` → `0 3 * * * cp ~/la-java-bot/data/lajava.db ~/backups/lajava-$(date +\%u).db`

## 8. Personnalisation

Tout est dans **`src/config/config.ts`** : année d'édition et date de l'événement, noms/couleurs des rôles, structure des salons, salons masqués (`cache: true`, révélés via `/ouvrir-salon`), textes français, seuils XP, délais, seuil anti-raid. Modifie, recompile (`npm run build`), redémarre, et relance `/setup-serveur` si tu as touché aux rôles/salons.

## 9. Fin d'édition

`/archiver-edition` (avec confirmation) : bénévoles actifs → alumni, salons de l'édition en lecture seule, création du rôle et du badge de l'année suivante. Ensuite : mets à jour `EDITION.annee` et `EDITION.dateEvenement` dans la config, recompile, relance `/setup-serveur`.
