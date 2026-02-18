# Lost Bot

Bot Discord de gestion de presence et d'activites pour la communaute **Lost** (Storylife V7).

## Fonctionnalites

### Presence quotidienne
- Envoi automatique d'un sondage de presence chaque jour a 15h (heure de Paris)
- Trois boutons interactifs : **Present**, **En retard**, **Absent**
- Attribution automatique de roles Discord selon la reponse
- Suivi en temps reel du nombre de reponses sur le message
- Nettoyage automatique des roles a minuit

### Historique et classement
- Suivi cumule des presences par membre (present, retard, absent, sans reponse)
- Classement global avec rendu canvas : podium top 3 avec avatars, liste paginee pour les suivants
- Score calcule : present (+2), retard (+1), absent (-1), sans reponse (-2)
- Taux de presence affiche en pourcentage
- Statistiques individuelles detaillees par membre

### Coup de pression
- Envoi automatique de DM de rappel a 19h aux membres n'ayant pas repondu
- Trois templates de messages aleatoires avec lien direct vers le sondage
- Possibilite d'envoyer manuellement via commande admin avec message personnalise
- Fallback sur un channel si les DM sont fermes

### Gestion d'argent
- Enregistrement des transferts d'argent in-game (gains/pertes)
- Bilans par semaine avec classements
- Classement global et hebdomadaire
- Historique complet des transactions

### Reservations de braquages
- Deux types d'activites : **Superette** et **Ammu** (2 creneaux chacun par jour)
- Reservation avec horaire et coequipiers optionnels
- Embed mis a jour en temps reel dans un channel dedie
- Reset automatique chaque jour a 7h

### Administration
- Creation/suppression d'un role Admin temporaire (owner uniquement)
- Reset manuel de la session de presence
- Gestion des creneaux de braquages

## Commandes

| Commande | Permission | Description |
|---|---|---|
| `/sendpresence` | Administrateur | Envoyer manuellement le message de presence |
| `/presence` | Tous | Afficher la liste de presence actuelle |
| `/history [membre]` | Tous | Statistiques d'un membre ou classement global (image canvas) |
| `/coupdepression [membre] [message]` | Administrateur | Envoyer un rappel DM aux non-repondants |
| `/exemplecoupdepression` | Tous | Apercu des messages de rappel |
| `/reset` | Administrateur | Terminer la session et retirer les roles |
| `/setmeadmin` | Owner | Creer et s'attribuer un role Admin |
| `/unsetmeadmin` | Owner | Supprimer le role Admin |
| `/argent <montant> <activite>` | Role Lost | Enregistrer un transfert d'argent |
| `/argent-total [membre]` | Role Lost | Solde cumule et 15 derniers mouvements |
| `/argent-semaine [membre] [date]` | Role Lost | Bilan hebdomadaire |
| `/argent-top` | Role Lost | Classement global des gains |
| `/argent-top-semaine [date]` | Role Lost | Classement hebdomadaire |
| `/argent-historique [membre]` | Role Lost | Historique complet des transactions |
| `/sup [with] [heure]` | Role Lost | Reserver un creneau Superette |
| `/ammu [with] [heure]` | Role Lost | Reserver un creneau Ammu |
| `/braquages-reset` | Administrateur | Reinitialiser tous les creneaux |
| `/braquages-clear <slot>` | Administrateur | Vider un creneau specifique |

## Taches planifiees (cron)

Toutes les heures sont en fuseau `Europe/Paris`.

| Heure | Action |
|---|---|
| 00:00 | Retrait des roles de presence |
| 07:00 | Reset des creneaux de braquages |
| 15:00 | Envoi du message de presence |
| 19:00 | Envoi des coups de pression aux non-repondants |
| Chaque heure | Rafraichissement du cache des membres |

## Prerequis

- [Node.js](https://nodejs.org/) v20+
- Un bot Discord avec les intents `Guilds`, `GuildMembers`, `GuildMessages`

## Installation

```bash
git clone https://github.com/clmvlt/lost-bot.git
cd lost-bot
npm install
```

Copier le fichier d'environnement et le remplir :

```bash
cp .env.example .env.dev
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Token du bot Discord |
| `CHANNEL_ID` | ID du channel de presence |
| `FALLBACK_CHANNEL_ID` | ID du channel de fallback pour les DM echoues |
| `BRAQUAGES_CHANNEL_ID` | ID du channel dedie aux reservations de braquages |
| `OWNER_ID` | ID Discord du proprietaire du bot |
| `ROLE_LOST` | ID du role "Lost" (membres) |
| `ROLE_PRESENT` | ID du role "Present" |
| `ROLE_ABSENT` | ID du role "Absent" |
| `ROLE_NO_RESPONSE` | ID du role "Sans reponse" |
| `ROLE_LATE` | ID du role "En retard" |

## Lancement

```bash
npm start
```

## Deploiement

Le script `deploy.py` permet un deploiement automatise via SSH :

```bash
python deploy.py
```

Il se charge de l'upload des fichiers, de l'installation des dependances et de la configuration du service systemd sur le serveur distant. Les variables `DEPLOY_*` du `.env` configurent la connexion SSH.

| Variable | Description |
|---|---|
| `DEPLOY_SSH_HOST` | Adresse du serveur |
| `DEPLOY_SSH_PORT` | Port SSH (defaut : 22) |
| `DEPLOY_SSH_USER` | Utilisateur SSH |
| `DEPLOY_SSH_PASSWORD` | Mot de passe SSH |
| `DEPLOY_REMOTE_DIR` | Repertoire distant du projet |
| `DEPLOY_SERVICE_NAME` | Nom du service systemd |

## Structure du projet

```
lost-bot/
├── src/
│   ├── index.js           # Point d'entree, client Discord et routage
│   ├── config.js          # Chargement des variables d'environnement
│   ├── commands.js        # Definition et enregistrement des slash commands
│   ├── data.js            # Lecture/ecriture des fichiers JSON
│   ├── utils.js           # Fonctions utilitaires
│   ├── presence.js        # Logique de presence et boutons
│   ├── argent.js          # Gestion des transferts d'argent
│   ├── braquages.js       # Reservations de braquages
│   ├── coupdepression.js  # Rappels DM automatiques
│   ├── cron.js            # Taches planifiees (cron)
│   ├── admin.js           # Commandes d'administration
│   ├── canvas-history.js  # Rendu canvas du classement (podium + liste)
│   └── member-cache.js    # Cache des membres et avatars
├── images/                # Images aleatoires jointes aux messages
├── deploy.py              # Script de deploiement SSH
├── .env.example           # Template des variables d'environnement
└── package.json
```

## Technologies

- [discord.js](https://discord.js.org/) v14 — Client Discord
- [@napi-rs/canvas](https://github.com/nicolo-ribaudo/napi-rs-canvas) — Rendu d'images serveur (classement)
- [dotenv](https://github.com/motdotla/dotenv) — Variables d'environnement
- [node-cron](https://github.com/node-cron/node-cron) — Taches planifiees

## Licence

ISC

## Auteur

dimzou
