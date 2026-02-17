require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { registerCommands } = require('./commands');
const { setupCronJobs } = require('./cron');
const { handleSendPresence, handlePresence, handleHistory, handleReset, handleButton } = require('./presence');
const { handleCoupDePression, handleExempleCoupDePression } = require('./coupdepression');
const { handleArgent, handleArgentTotal, handleArgentSemaine, handleArgentTop, handleArgentTopSemaine, handleArgentHistorique } = require('./argent');
const { handleSetMeAdmin, handleUnsetMeAdmin } = require('./admin');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
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
};

client.once('ready', async () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
    const isDev = process.env.NODE_ENV !== 'production';
    client.user.setActivity(isDev ? 'MAINTENANCE POUR DEV' : 'Storylife V7', { type: 0 });
    await registerCommands(client.user.id);
    setupCronJobs(client);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const handler = commandHandlers[interaction.commandName];
        if (handler) await handler(interaction);
    }

    if (interaction.isButton()) {
        await handleButton(interaction);
    }
});

client.login(config.token);
