const { MessageFlags } = require('discord.js');
const config = require('./config');
const { loadPresence } = require('./data');

const PRESSURE_MESSAGES = [
    (time, link) => `🚨 **HEY SALE FDP** 🚨\n\nCommence à répondre à la présence avant que j'enclenche ta pute de mère…\n\n⏰ Il est ${time}, COMMENCE A REPONDRE AVANT DE TE FAIRE KP !${link}`,
    (time, link) => `⚠️ **ALERTE** ⚠️\n\nHey sale fdp ! T'as toujours pas répondu à la présence ?\n\nIl est ${time}, réponds maintenant avant qu'on vienne te chercher… 😈\n\nCOMMENCE A REPONDRE AVANT DE TE FAIRE KP !${link}`,
    (time, link) => `📢 **EH TOI LÀ** 📢\n\nSale fdp, il est ${time} et t'as toujours pas répondu !\n\nCommence à répondre à la présence avant que j'enclenche ta pute de mère… 🔥\nCOMMENCE A REPONDRE AVANT DE TE FAIRE KP !${link}`,
];

function getTimeString(isFromCron) {
    if (isFromCron) return '19h';
    const now = new Date();
    return `${now.getHours()}h${now.getMinutes().toString().padStart(2, '0')}`;
}

function getMessageLink(guild, presence) {
    if (presence.messageId) {
        return `\n\nhttps://discord.com/channels/${guild.id}/${config.channelId}/${presence.messageId}`;
    }
    return `\n\n<#${config.channelId}>`;
}

async function sendCoupDePression(guild, isFromCron = false, targetUserId = null, customMessage = null) {
    const presence = loadPresence();
    const noResponders = targetUserId ? [targetUserId] : presence.noResponses;

    if (noResponders.length === 0) return { sent: 0, failed: 0 };

    const timeString = getTimeString(isFromCron);
    const messageLink = getMessageLink(guild, presence);

    const finalMessage = customMessage
        ? `${customMessage}${messageLink}`
        : PRESSURE_MESSAGES[Math.floor(Math.random() * PRESSURE_MESSAGES.length)](timeString, messageLink);

    let sent = 0;
    let failed = 0;
    const failedUsers = [];

    for (const userId of noResponders) {
        try {
            const member = await guild.members.fetch(userId);
            await member.send(finalMessage);
            sent++;
        } catch (error) {
            console.error(`Impossible d'envoyer un MP à ${userId}:`, error.message);
            failed++;
            failedUsers.push(userId);
        }
    }

    return { sent, failed, failedUsers, finalMessage };
}

async function handleCoupDePression(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const targetMember = interaction.options.getUser('membre');
        const customMessage = interaction.options.getString('message');

        const result = await sendCoupDePression(
            interaction.guild,
            false,
            targetMember?.id || null,
            customMessage
        );

        if (result.sent === 0 && result.failed === 0) {
            await interaction.editReply({ content: '✅ Tout le monde a déjà répondu!' });
            return;
        }

        let replyContent = `📨 Coups de pression envoyés!\n\n✅ ${result.sent} MP envoyé(s)\n❌ ${result.failed} échec(s) (MPs fermés)`;

        if (targetMember) {
            replyContent = result.failed > 0
                ? `❌ Impossible d'envoyer un MP à <@${targetMember.id}> (MPs fermés)`
                : `📨 Coup de pression envoyé à <@${targetMember.id}>!`;
        }

        if (result.failed > 0 && result.failedUsers.length > 0) {
            try {
                const fallbackChannel = await client.channels.fetch(config.fallbackChannelId);
                if (fallbackChannel) {
                    const mentions = result.failedUsers.map(id => `<@${id}>`).join(' ');
                    await fallbackChannel.send(`${mentions}\n\n${result.finalMessage}`);
                    replyContent += `\n\n📢 Message envoyé dans <#${config.fallbackChannelId}> pour les ${result.failed} membre(s) avec MPs fermés.`;
                }
            } catch (fallbackError) {
                console.error('Erreur envoi salon fallback:', fallbackError);
                replyContent += `\n\n⚠️ Impossible d'envoyer dans le salon de fallback.`;
            }
        }

        await interaction.editReply({ content: replyContent });
    } catch (error) {
        console.error('Erreur /coupdepression:', error);
        await interaction.editReply({ content: '❌ Erreur lors de l\'envoi des MPs.' });
    }
}

async function handleExempleCoupDePression(interaction) {
    const timeString = '19h';
    const messageLink = `\n\nhttps://discord.com/channels/${interaction.guild.id}/${config.channelId}/exemple`;

    const content = PRESSURE_MESSAGES.map((msgFn, i) =>
        `**--- Message ${i + 1} ---**\n\n${msgFn(timeString, messageLink)}`
    ).join('\n\n');

    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

module.exports = {
    sendCoupDePression,
    handleCoupDePression,
    handleExempleCoupDePression,
};
