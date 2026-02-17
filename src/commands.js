const { SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

const commands = [
    new SlashCommandBuilder()
        .setName('sendpresence')
        .setDescription('Force l\'envoi du message de présence')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
        .setDescription('Met fin à la présence et retire les rôles de tout le monde')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
            option.setName('activite')
                .setDescription('Raison / activité du transfert')
                .setRequired(true)),
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
        .setDescription('Réinitialiser le message des braquages')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('braquages-clear')
        .setDescription('Effacer un slot de braquage')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
