const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const config = require('./config');

const commands = [
    new SlashCommandBuilder()
        .setName('sendpresence')
        .setDescription('Force l\'envoi du message de présence'),
    new SlashCommandBuilder()
        .setName('presence')
        .setDescription('Affiche la liste des présences'),
    new SlashCommandBuilder()
        .setName('history')
        .setDescription('Affiche l\'historique des présences')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à afficher (optionnel, tout le monde si vide)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('coupdepression')
        .setDescription('Envoie un MP aux membres qui n\'ont pas répondu')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre spécifique à qui envoyer le MP')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message personnalisé à envoyer')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Met fin à la présence et retire les rôles de tout le monde'),
    new SlashCommandBuilder()
        .setName('setmeadmin')
        .setDescription('Crée un rôle admin et l\'attribue'),
    new SlashCommandBuilder()
        .setName('unsetmeadmin')
        .setDescription('Supprime le rôle admin créé'),
    new SlashCommandBuilder()
        .setName('exemplecoupdepression')
        .setDescription('Affiche un aperçu de tous les messages de coup de pression'),
    new SlashCommandBuilder()
        .setName('argent')
        .setDescription('Enregistrer un transfert d\'argent pour toi-même')
        .addNumberOption(option =>
            option.setName('montant')
                .setDescription('Montant (positif = gain, négatif = perte)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Tapez pour rechercher une raison')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('groupe')
                .setDescription('Groupe (par défaut: Lost)')
                .setRequired(false)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('info')
                .setDescription('Info supplémentaire')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('with')
                .setDescription('Membres avec qui tu fais le braquage (@mentions)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('heure')
                .setDescription('Heure prévue (ex: 21h30)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('argent-total')
        .setDescription('Affiche le total d\'argent d\'un joueur')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à afficher (optionnel, toi-même si vide)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('argent-semaine')
        .setDescription('Affiche le total d\'argent par semaine (lundi-dimanche)')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre spécifique (optionnel, tous si vide)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date dans la semaine voulue (JJ/MM/AAAA), sinon semaine courante')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('argent-top')
        .setDescription('Affiche le classement global d\'argent de tous les membres'),
    new SlashCommandBuilder()
        .setName('argent-top-semaine')
        .setDescription('Affiche le classement d\'argent de la semaine')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date dans la semaine voulue (JJ/MM/AAAA), sinon semaine courante')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('argent-historique')
        .setDescription('Affiche l\'historique des transferts d\'un membre')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à afficher (optionnel, toi-même si vide)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('sup')
        .setDescription('Réserver une superette pour aujourd\'hui')
        .addStringOption(option =>
            option.setName('with')
                .setDescription('Membres avec qui tu fais le braquage (@mentions)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('heure')
                .setDescription('Heure prévue (ex: 21h30)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('ammu')
        .setDescription('Réserver une ammu pour aujourd\'hui')
        .addStringOption(option =>
            option.setName('with')
                .setDescription('Membres avec qui tu fais le braquage (@mentions)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('heure')
                .setDescription('Heure prévue (ex: 21h30)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('braquages-reset')
        .setDescription('Réinitialiser le message des braquages'),
    new SlashCommandBuilder()
        .setName('braquages-clear')
        .setDescription('Effacer un slot de braquage')
        .addStringOption(option =>
            option.setName('slot')
                .setDescription('Slot à effacer')
                .setRequired(true)
                .addChoices(
                    { name: 'Superette 1', value: 'sup1' },
                    { name: 'Superette 2', value: 'sup2' },
                    { name: 'Ammu 1', value: 'ammu1' },
                    { name: 'Ammu 2', value: 'ammu2' },
                )),
    new SlashCommandBuilder()
        .setName('pochon')
        .setDescription('Enregistrer un ajout/retrait de pochon')
        .addStringOption(option =>
            option.setName('participants')
                .setDescription('Mentionner les participants (@membre1 @membre2 ...)')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('montant')
                .setDescription('Montant (positif = ajout, négatif = retrait)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emplacement')
                .setDescription('Emplacement')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('groupe')
                .setDescription('Groupe')
                .setRequired(false)
                .setAutocomplete(true)),
    new SlashCommandBuilder()
        .setName('pochon-semaine')
        .setDescription('Affiche le résumé des sessions de pochon de la semaine')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date dans la semaine voulue (JJ/MM/AAAA), sinon semaine courante')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('pochon-top')
        .setDescription('Affiche le classement global des sessions de pochon'),
    new SlashCommandBuilder()
        .setName('pochon-delete')
        .setDescription('Supprimer la dernière session de pochon'),
    new SlashCommandBuilder()
        .setName('cambriolage')
        .setDescription('Enregistrer un cambriolage')
        .addStringOption(option =>
            option.setName('with')
                .setDescription('Membres avec toi (@mentions)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('ordinateur')
                .setDescription('Nombre d\'ordinateurs')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('tableau')
                .setDescription('Nombre de tableaux')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('sculpture')
                .setDescription('Nombre de sculptures')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('television')
                .setDescription('Nombre de télévisions')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('tablette')
                .setDescription('Nombre de tablettes')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('console')
                .setDescription('Nombre de consoles')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('micro-ondes')
                .setDescription('Nombre de micro-ondes')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('appareil-photo')
                .setDescription('Nombre d\'appareils photo')
                .setRequired(false)
                .setMinValue(0))
        .addIntegerOption(option =>
            option.setName('enceinte')
                .setDescription('Nombre d\'enceintes')
                .setRequired(false)
                .setMinValue(0)),
    new SlashCommandBuilder()
        .setName('cambriolage-semaine')
        .setDescription('Récap des cambriolages de la semaine')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à afficher (optionnel, toi-même si vide)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envoyer un message via le bot (dans le salon ou en MP)')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message à envoyer')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Membre à qui envoyer en MP (si vide, envoi dans le salon)')
                .setRequired(false)),
];

async function registerCommands(clientUserId) {
    const rest = new REST({ version: '10' }).setToken(config.token);
    try {
        console.log('Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(clientUserId),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        console.log('Commandes enregistrées avec succès!');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes:', error);
    }
}

module.exports = { commands, registerCommands };
