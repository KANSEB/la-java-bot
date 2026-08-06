# 🚀 Héberger le bot chez Northost (ou tout panel Pterodactyl)

Guide complet pour faire tourner le bot 24h/24 sur un hébergeur de bots Discord.
Compte environ 20 minutes la première fois.

---

## ⚠️ Règle n°1 : un seul bot à la fois

Ne laisse **jamais** tourner le bot sur ton PC **et** chez l'hébergeur en même temps :
tout serait fait en double (messages de bienvenue, XP, notifications de candidature).

Avant de démarrer le bot chez l'hébergeur, **arrête celui de ton PC** (ferme la fenêtre
du terminal, ou Gestionnaire des tâches → termine les processus `node.exe`).

---

## 1. Repérer les infos dans le panneau

Connecte-toi au panneau Northost et note :

| Ce qu'il te faut | Où le trouver |
|---|---|
| Version de **Node.js** | Onglet *Startup* / *Démarrage* — choisis **20, 22 ou 24** |
| **Fichier principal** (MAIN_FILE) | Onglet *Startup* — à régler sur `dist/index.js` |
| Accès **SFTP** | Onglet *Settings* / *Paramètres* (hôte, port, identifiant) |
| Support **Git** | Certains panels ont un champ *Git Repo Address* dans *Startup* |

---

## 2. Envoyer le code — deux méthodes

### Méthode A — Git (la plus simple si le panel le propose)

Dans l'onglet *Startup*, renseigne :

- **Git Repo Address** : `https://github.com/KANSEB/la-java-bot`
- **Install Branch** : `main`
- **Auto Update** : activé (le bot récupérera les mises à jour à chaque redémarrage)

Le panel clonera le dépôt et lancera `npm install` tout seul.

### Méthode B — SFTP (fonctionne partout)

Télécharge [FileZilla](https://filezilla-project.org/) (gratuit), connecte-toi avec les
identifiants SFTP du panneau, puis **envoie ces éléments** dans `/home/container` :

```
src/            (tout le dossier)
scripts/        (tout le dossier)
package.json
package-lock.json
tsconfig.json
```

❌ **N'envoie PAS** : `node_modules/` (compilé pour Windows, il ferait planter le bot),
`dist/` (reconstruit automatiquement), ni `.env` (on le crée juste après).

---

## 3. Les variables secrètes (token)

Deux possibilités selon ce que propose le panneau :

**Si le panel a des « Variables » / « Environment »** (le plus propre) :
crée-les directement dans l'interface :

| Nom | Valeur |
|---|---|
| `DISCORD_TOKEN` | ton token de bot |
| `GUILD_ID` | `1528714544568860762` |

**Sinon**, crée un fichier `.env` à la racine (gestionnaire de fichiers du panneau →
*New File* → nom : `.env`) avec dedans :

```
DISCORD_TOKEN=ton_token_ici
GUILD_ID=1528714544568860762
```

---

## 4. La commande de démarrage

Le panneau doit lancer : **`npm start`** (ou `node dist/index.js`).

Si le panel demande seulement un « fichier principal », mets `dist/index.js`.

ℹ️ Le projet se compile tout seul : `npm install` déclenche automatiquement la
construction (`postinstall` → `tsc`), donc aucune étape de build à configurer.

---

## 5. Transférer la base de données (facultatif mais conseillé)

La base contient l'XP, les anniversaires et l'historique des candidatures.
Sur ton PC, dans le dossier du projet :

```bash
node scripts/export-db.mjs
```

Ça crée `export/lajava.db`. Envoie ce fichier par SFTP dans le dossier `data/`
de l'hébergeur (crée le dossier s'il n'existe pas), **bot arrêté des deux côtés**.

Si tu sautes cette étape, le bot repart d'une base vide : les XP repartent de zéro
et les messages de bienvenue déjà envoyés pourraient être repostés une fois.

---

## 6. Démarrer et vérifier

Clique sur **Start** dans le panneau. La console doit afficher :

```
[db] migration v1 appliquée
[db] migration v2 appliquée
✅ Connecté en tant que La Java Admin#5267
[commandes] 17 slash commands enregistrées sur La Java Communauté
[crons] tâches planifiées démarrées
[onboarding] rattrapage : 0 candidature(s) en attente vérifiée(s)
```

Puis dans Discord : le bot doit apparaître **en ligne** (pastille verte), et
`/mon-profil` doit répondre.

---

## 7. Si ça coince

| Symptôme dans la console | Cause et solution |
|---|---|
| `Cannot find module 'discord.js'` | `npm install` n'a pas tourné → lance-le depuis la console du panneau |
| `better-sqlite3 ... was compiled against a different Node.js version` | Reste de `node_modules` Windows → supprime le dossier `node_modules` sur le serveur et relance |
| `Used disallowed intents` | Les intents privilégiés sont désactivés → portail développeur Discord → onglet Bot → active **SERVER MEMBERS** et **MESSAGE CONTENT** |
| `Variable d'environnement manquante : DISCORD_TOKEN` | Le `.env` n'est pas à la racine, ou la variable n'est pas définie dans le panneau |
| `TokenInvalid` | Token périmé (régénéré depuis) → copie le nouveau depuis le portail développeur |
| Tout marche mais **en double** | Le bot tourne encore sur ton PC → arrête-le |

---

## 8. Mettre à jour le bot plus tard

**Avec Git** : je pousse les changements sur GitHub, tu redémarres le serveur dans le
panneau — l'auto-update récupère la nouvelle version.

**Avec SFTP** : je te dis quels fichiers ont changé, tu les remplaces, tu redémarres.

Dans les deux cas, **sauvegarde `data/lajava.db` de temps en temps** (téléchargement
par SFTP) : c'est toute la mémoire du bot.
