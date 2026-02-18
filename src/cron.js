const cron = require('node-cron');
const config = require('./config');
const { sendPresenceMessage, stripPresenceRoles } = require('./presence');
const { sendCoupDePression } = require('./coupdepression');
const { resetBraquagesMessage } = require('./braquages');
const { refreshCache } = require('./member-cache');

const TIMEZONE = 'Europe/Paris';

function setupCronJobs(client) {
    cron.schedule('0 15 * * *', async () => {
        console.log('Envoi automatique du message de présence (15h)');
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) await sendPresenceMessage(channel);
        } catch (error) {
            console.error('Erreur lors de l\'envoi automatique:', error);
        }
    }, { timezone: TIMEZONE });

    cron.schedule('0 19 * * *', async () => {
        console.log('Envoi automatique des coups de pression (19h)');
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) {
                const result = await sendCoupDePression(channel.guild, true);
                console.log(`Coups de pression envoyés: ${result.sent} réussis, ${result.failed} échecs`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi des coups de pression:', error);
        }
    }, { timezone: TIMEZONE });

    cron.schedule('0 0 * * *', async () => {
        console.log('Reset des rôles de présence (minuit)');
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) {
                const guild = channel.guild;
                await guild.members.fetch();
                const lostRole = guild.roles.cache.get(config.roles.lost);
                if (lostRole) {
                    await stripPresenceRoles(guild, lostRole.members);
                    console.log(`Rôles de présence retirés pour ${lostRole.members.size} membres`);
                }
            }
        } catch (error) {
            console.error('Erreur lors du reset de minuit:', error);
        }
    }, { timezone: TIMEZONE });

    cron.schedule('0 7 * * *', async () => {
        console.log('Reset du message braquages (7h)');
        try {
            const channel = await client.channels.fetch(config.braquagesChannelId);
            if (channel) {
                await resetBraquagesMessage(channel);
                console.log('Message braquages réinitialisé');
            }
        } catch (error) {
            console.error('Erreur lors du reset braquages:', error);
        }
    }, { timezone: TIMEZONE });

    // Refresh member cache every hour
    cron.schedule('0 * * * *', async () => {
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) await refreshCache(channel.guild);
        } catch (error) {
            console.error('Erreur refresh cache membres:', error);
        }
    }, { timezone: TIMEZONE });

    // Initial cache load
    (async () => {
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) await refreshCache(channel.guild);
        } catch (error) {
            console.error('Erreur chargement initial cache membres:', error);
        }
    })();

    console.log('Tâches planifiées: reset à 00h00, braquages à 07h00, présence à 15h00, coups de pression à 19h00, cache membres toutes les heures');
}

module.exports = { setupCronJobs };
