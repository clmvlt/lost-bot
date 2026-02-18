require('dotenv').config();

const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const config = require('./config');
const { registerCommands } = require('./commands');
const { setupCronJobs } = require('./cron');
const { handleSendPresence, handlePresence, handleHistory, handleHistoryPage, handleReset, handleButton } = require('./presence');
const { handleCoupDePression, handleExempleCoupDePression } = require('./coupdepression');
const { handleArgent, handleArgentTotal, handleArgentSemaine, handleArgentTop, handleArgentTopSemaine, handleArgentHistorique, handleArgentTopPage, handleArgentSemainePage, handleArgentTopSemainePage } = require('./argent');
const { handleSetMeAdmin, handleUnsetMeAdmin, handleSay } = require('./admin');
const { handleSup, handleAmmu, handleBraquagesReset, handleBraquagesClear, initBraquagesChannel } = require('./braquages');
const { handleFabrique, handleFabriqueSemaine, handleFabriqueTop, handleFabriqueDelete, handleFabriqueTopPage, handleFabriqueSemainePage } = require('./fabrication');
const { handleMention } = require('./mentions');
const { initData } = require('./data');

initData();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const commandHandlers = {
    sendpresence: (i) => handleSendPresence(i, client),
    presence: handlePresence,
    history: handleHistory,
    coupdepression: (i) => handleCoupDePression(i, client),
    exemplecoupdepression: handleExempleCoupDePression,
    reset: handleReset,
    argent: handleArgent,
    'argent-total': handleArgentTotal,
    'argent-semaine': handleArgentSemaine,
    'argent-top': handleArgentTop,
    'argent-top-semaine': handleArgentTopSemaine,
    'argent-historique': handleArgentHistorique,
    setmeadmin: handleSetMeAdmin,
    unsetmeadmin: handleUnsetMeAdmin,
    sup: (i) => handleSup(i, client),
    ammu: (i) => handleAmmu(i, client),
    'braquages-reset': (i) => handleBraquagesReset(i, client),
    'braquages-clear': (i) => handleBraquagesClear(i, client),
    fabrique: handleFabrique,
    'fabrique-semaine': handleFabriqueSemaine,
    'fabrique-top': handleFabriqueTop,
    'fabrique-delete': handleFabriqueDelete,
    say: handleSay,
};

client.once('ready', async () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
    const isDev = process.env.NODE_ENV !== 'production';
    client.user.setActivity(isDev ? 'MAINTENANCE POUR DEV' : 'Storylife V7', { type: 0 });
    await registerCommands(client.user.id);
    setupCronJobs(client);
    await initBraquagesChannel(client);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const handler = commandHandlers[interaction.commandName];
            if (handler) await handler(interaction);
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('history_page_')) {
                await handleHistoryPage(interaction);
            } else if (interaction.customId.startsWith('argent_top_page_')) {
                await handleArgentTopPage(interaction);
            } else if (interaction.customId.startsWith('argent_semaine_page_')) {
                await handleArgentSemainePage(interaction);
            } else if (interaction.customId.startsWith('argent_topsemaine_page_')) {
                await handleArgentTopSemainePage(interaction);
            } else if (interaction.customId.startsWith('fab_top_page_')) {
                await handleFabriqueTopPage(interaction);
            } else if (interaction.customId.startsWith('fab_semaine_page_')) {
                await handleFabriqueSemainePage(interaction);
            } else {
                await handleButton(interaction);
            }
        }
    } catch (error) {
        console.error(`Erreur interaction non gérée (${interaction.isButton() ? interaction.customId : interaction.commandName}):`, error);
        try {
            const content = '❌ Une erreur est survenue lors du traitement.';
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content });
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            console.error('Impossible de répondre à l\'interaction en erreur:', e);
        }
    }
});

client.on('messageCreate', handleMention);

client.login(config.token);
