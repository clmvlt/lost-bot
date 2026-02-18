# CLAUDE.md — lost-bot

## Projet

Bot Discord pour la gestion de présence et d'activités du groupe Lost (Storylife V7).
Stack : Node.js + discord.js v14 + @napi-rs/canvas + node-cron.
Déploiement via `deploy.py` (paramiko/SSH) vers un service systemd.

## Architecture

```
src/
  index.js          — Point d'entrée, client Discord, routage des interactions
  commands.js       — Définition et enregistrement des slash commands
  config.js         — Variables d'environnement (.env → module.exports)
  data.js           — Lecture/écriture JSON (presence, history, argent, braquages)
  utils.js          — Fonctions utilitaires partagées (dates FR, images, formatage)
  presence.js       — Logique présence (envoi, boutons, historique)
  argent.js         — Système de suivi d'argent
  braquages.js      — Système de réservation de braquages
  coupdepression.js — Envoi de MP de relance
  cron.js           — Tâches planifiées (node-cron)
  admin.js          — Commandes owner (setmeadmin/unsetmeadmin)
  canvas-history.js — Rendu canvas pour l'historique
  member-cache.js   — Cache des membres du serveur
```

Les données persistantes sont des fichiers JSON à la racine (presence.json, history.json, argent.json, braquages.json).

## Règles strictes

- **Ne jamais commenter le code.** Pas de commentaires inline, pas de JSDoc, pas de blocs explicatifs. Le code doit être lisible par lui-même.
- **Ne jamais ajouter de fichiers de documentation** (README, CHANGELOG, etc.) sauf si demandé explicitement.

## Style et conventions

- CommonJS (`require`/`module.exports`), pas d'ESM.
- Pas de TypeScript, pas de transpilation.
- Indentation : 4 espaces.
- Strings : guillemets simples `'...'`.
- Point-virgule en fin de ligne.
- Nommage : camelCase pour les variables/fonctions, UPPER_SNAKE_CASE pour les constantes.
- Langue du code : noms de variables et fonctions en anglais, messages utilisateur en français.
- Destructuring dès que possible (`const { X } = require('...')`).
- Pas de classes, uniquement des fonctions et des objets simples.
- Un fichier = un domaine fonctionnel.

## Node.js — bonnes pratiques

- Toujours utiliser `const` sauf si une réassignation est nécessaire (`let`). Jamais `var`.
- Toujours `async/await`, jamais de `.then()` chaînés.
- Gestion d'erreur : `try/catch` autour des appels Discord et I/O. Logger avec `console.error`.
- Chemins de fichiers : toujours via `path.join(__dirname, ...)`, jamais de chemins relatifs en string.
- Pas de dépendances inutiles. Utiliser l'API standard Node.js quand c'est suffisant (`fs`, `path`, `crypto`).
- Pas de code synchrone bloquant dans les handlers d'interaction (pas de boucles longues, pas de `fs.readFileSync` dans un handler async — sauf pour des fichiers JSON légers au démarrage).

## discord.js — bonnes pratiques

- Déclarer uniquement les intents nécessaires dans le Client.
- Utiliser `MessageFlags.Ephemeral` pour les réponses privées, pas l'ancien objet `{ ephemeral: true }`.
- Toujours `defer` les interactions qui prennent du temps (> 3s), puis `editReply`.
- Vérifier `interaction.deferred || interaction.replied` avant de répondre dans un catch.
- Utiliser les builders (`SlashCommandBuilder`, `EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`) pour construire les messages.
- Enregistrer les commandes via `REST.put` sur `Routes.applicationCommands`.
- Routage des interactions via un objet map `commandHandlers` dans index.js, pas de switch/case.
- Accéder aux options via `interaction.options.getUser()`, `.getString()`, `.getNumber()`, etc.
- Toujours vérifier les permissions/rôles côté code, ne pas se reposer uniquement sur `setDefaultMemberPermissions`.

## Données JSON

- Passer par `data.js` pour toute lecture/écriture de fichiers JSON (`loadX`/`saveX`).
- Ne jamais manipuler `fs` directement dans les handlers pour les données métier.
- `saveJSON` écrit avec `JSON.stringify(data, null, 2)` pour la lisibilité.

## Git

- Messages de commit en anglais, format conventionnel : `feat:`, `fix:`, `refactor:`, `chore:`.
- Ne jamais commit les fichiers `.env`, `*.json` de données, `node_modules/`.
- Branches : `feature/xxx`, `fix/xxx`, `history/xxx`.

## Déploiement

- Script `deploy.py` gère tout (SSH, upload, npm install, systemd).
- En production : `NODE_ENV=production`, `.env` est le fichier d'environnement (pas `.env.dev`).
- Les fichiers JSON de données ne sont pas déployés (exclus dans deploy.py).
