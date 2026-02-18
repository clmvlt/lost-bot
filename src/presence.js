const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadPresence, savePresence, loadHistory, saveHistory, DEFAULT_USER_HISTORY } = require('./data');
const { getRandomImage, isAdminOrOwner } = require('./utils');
const { refreshCache } = require('./member-cache');

function updateUserHistory(userId, status) {
    const history = loadHistory();
    if (!history[userId]) {
        history[userId] = { ...DEFAULT_USER_HISTORY };
    }
    if (history[userId][status] !== undefined) {
        history[userId][status]++;
    }
    saveHistory(history);
}

function decrementUserHistory(userId, status) {
    const history = loadHistory();
    if (!history[userId]) return;
    if (history[userId][status] !== undefined && history[userId][status] > 0) {
        history[userId][status]--;
    }
    saveHistory(history);
}

function getUserCurrentStatus(userId) {
    const data = loadPresence();
    if (data.presents.includes(userId)) return 'present';
    if (data.absents.includes(userId)) return 'absent';
    if ((data.lates || []).includes(userId)) return 'late';
    if (data.noResponses.includes(userId)) return 'noResponse';
    return null;
}

function finalizePresenceHistory() {
    const presence = loadPresence();
    for (const userId of presence.noResponses) {
        updateUserHistory(userId, 'noResponse');
    }
}

function resetPresenceData(lostMemberIds) {
    const data = {
        presents: [],
        absents: [],
        lates: [],
        noResponses: lostMemberIds,
        messageId: null,
    };
    savePresence(data);
    return data;
}

function updateUserPresence(userId, status) {
    const data = loadPresence();
    data.presents = data.presents.filter(id => id !== userId);
    data.absents = data.absents.filter(id => id !== userId);
    data.lates = (data.lates || []).filter(id => id !== userId);
    data.noResponses = data.noResponses.filter(id => id !== userId);

    if (status === 'present') data.presents.push(userId);
    else if (status === 'absent') data.absents.push(userId);
    else if (status === 'late') data.lates.push(userId);

    savePresence(data);
    return data;
}

function getPresenceCounts() {
    const data = loadPresence();
    return {
        presentCount: data.presents.length,
        lateCount: (data.lates || []).length,
        absentCount: data.absents.length,
        noResponseCount: data.noResponses.length,
    };
}

function buildPresenceText(counts) {
    return [
        `<@&${config.roles.lost}>`,
        '',
        '**Êtes-vous présent ce soir ?**',
        '',
        `✅ **${counts.presentCount}** présent(s)`,
        `⏰ **${counts.lateCount}** en retard`,
        `❌ **${counts.absentCount}** absent(s)`,
        `❓ **${counts.noResponseCount}** non répondu`,
    ].join('\n');
}

async function stripPresenceRoles(guild, members) {
    const rolesToRemove = [
        guild.roles.cache.get(config.roles.present),
        guild.roles.cache.get(config.roles.absent),
        guild.roles.cache.get(config.roles.late),
        guild.roles.cache.get(config.roles.noResponse),
    ].filter(Boolean);

    for (const [, member] of members) {
        for (const role of rolesToRemove) {
            try {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                }
            } catch (error) {
                console.error(`Erreur rôles pour ${member.user.tag}:`, error);
            }
        }
    }
}

async function sendPresenceMessage(channel) {
    const guild = channel.guild;
    const lostRole = guild.roles.cache.get(config.roles.lost);
    if (!lostRole) {
        console.error('Rôle Lost introuvable!');
        return null;
    }

    await refreshCache(guild);
    const lostMembers = lostRole.members;
    const lostMemberIds = [...lostMembers.keys()];

    finalizePresenceHistory();
    const presenceData = resetPresenceData(lostMemberIds);

    await stripPresenceRoles(guild, lostMembers);

    const noResponseRole = guild.roles.cache.get(config.roles.noResponse);
    if (noResponseRole) {
        for (const [, member] of lostMembers) {
            try {
                await member.roles.add(noResponseRole);
            } catch (error) {
                console.error(`Erreur ajout rôle noResponse pour ${member.user.tag}:`, error);
            }
        }
    }

    const counts = {
        presentCount: presenceData.presents.length,
        lateCount: presenceData.lates.length,
        absentCount: presenceData.absents.length,
        noResponseCount: presenceData.noResponses.length,
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('presence_present').setLabel('Présent').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('presence_late').setLabel('En retard').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('presence_absent').setLabel('Absent').setStyle(ButtonStyle.Danger),
    );

    const message = await channel.send({
        content: buildPresenceText(counts),
        files: [new AttachmentBuilder(getRandomImage(), { name: 'image.png' })],
        components: [row],
    });

    presenceData.messageId = message.id;
    savePresence(presenceData);
    return message;
}

async function updatePresenceMessage(interaction) {
    const counts = getPresenceCounts();
    try {
        await interaction.message.edit({ content: buildPresenceText(counts) });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du message:', error);
    }
}

async function handleSendPresence(interaction, client) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const channel = await client.channels.fetch(config.channelId);
        if (channel) {
            await sendPresenceMessage(channel);
            await interaction.editReply({ content: '✅ Message de présence envoyé!' });
        } else {
            await interaction.editReply({ content: '❌ Salon introuvable!' });
        }
    } catch (error) {
        console.error('Erreur /sendpresence:', error);
        await interaction.editReply({ content: '❌ Erreur lors de l\'envoi du message.' });
    }
}

async function handlePresence(interaction) {
    try {
        const data = loadPresence();
        const presents = data.presents.map(id => `<@${id}>`);
        const lates = (data.lates || []).map(id => `<@${id}>`);
        const absents = data.absents.map(id => `<@${id}>`);
        const noResponses = data.noResponses.map(id => `<@${id}>`);

        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des présences')
            .addFields(
                { name: `✅ Présents (${presents.length})`, value: presents.length > 0 ? presents.join('\n') : 'Aucun', inline: false },
                { name: `⏰ En retard (${lates.length})`, value: lates.length > 0 ? lates.join('\n') : 'Aucun', inline: false },
                { name: `❌ Absents (${absents.length})`, value: absents.length > 0 ? absents.join('\n') : 'Aucun', inline: false },
                { name: `❓ Non répondu (${noResponses.length})`, value: noResponses.length > 0 ? noResponses.join('\n') : 'Aucun', inline: false },
            )
            .setColor(0x5865F2)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur /presence:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de l\'affichage des présences.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}

const { renderHistory, HISTORY_PER_PAGE } = require('./canvas-history');

function getSortedHistory() {
    const history = loadHistory();
    const entries = Object.entries(history);
    return entries.map(([userId, stats]) => {
        const total = stats.present + stats.absent + (stats.late || 0) + stats.noResponse;
        const rate = total > 0 ? (stats.present / total) * 100 : 0;
        const score = (stats.present * 2) + ((stats.late || 0) * 1) + (stats.absent * -1) + (stats.noResponse * -2);
        return { userId, ...stats, late: stats.late || 0, total, rate, score };
    }).sort((a, b) => b.score - a.score || b.rate - a.rate);
}

function buildPageButtons(currentPage, totalPages) {
    if (totalPages <= 1) return null;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`history_page_${currentPage - 1}`)
            .setLabel('Precedent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`history_page_${currentPage + 1}`)
            .setLabel('Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
    );
}

async function handleHistoryPage(interaction) {
    const page = parseInt(interaction.customId.split('_')[2]);
    const sorted = getSortedHistory();
    if (sorted.length === 0) return;

    await interaction.deferUpdate();

    const { buffer, currentPage, totalPages } = await renderHistory(sorted, page, interaction.guild, interaction.user.id);
    const file = new AttachmentBuilder(buffer, { name: 'history.png' });
    const row = buildPageButtons(currentPage, totalPages);

    await interaction.editReply({ files: [file], components: row ? [row] : [], embeds: [], content: null });
}

async function handleHistory(interaction) {
    try {
        const targetUser = interaction.options.getUser('membre');

        if (targetUser) {
            const history = loadHistory();
            const stats = history[targetUser.id] || { ...DEFAULT_USER_HISTORY };
            const total = stats.present + stats.absent + (stats.late || 0) + stats.noResponse;
            const presenceRate = total > 0 ? Math.round((stats.present / total) * 100) : 0;

            const embed = new EmbedBuilder()
                .setTitle(`Historique de ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Present', value: `${stats.present}`, inline: true },
                    { name: 'En retard', value: `${stats.late || 0}`, inline: true },
                    { name: 'Absent', value: `${stats.absent}`, inline: true },
                    { name: 'Non repondu', value: `${stats.noResponse}`, inline: true },
                    { name: 'Taux de presence', value: `${presenceRate}%`, inline: false },
                )
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        const sorted = getSortedHistory();
        if (sorted.length === 0) {
            await interaction.reply({ content: 'Aucun historique disponible.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        const { buffer, currentPage, totalPages } = await renderHistory(sorted, 0, interaction.guild, interaction.user.id);
        const file = new AttachmentBuilder(buffer, { name: 'history.png' });
        const row = buildPageButtons(currentPage, totalPages);

        await interaction.editReply({ files: [file], components: row ? [row] : [] });
    } catch (error) {
        console.error('Erreur /history:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de l\'affichage de l\'historique.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
}

async function handleReset(interaction) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guild = interaction.guild;
        await guild.members.fetch();

        const lostRole = guild.roles.cache.get(config.roles.lost);
        if (!lostRole) {
            await interaction.editReply({ content: '❌ Rôle Lost introuvable!' });
            return;
        }

        finalizePresenceHistory();
        const lostMembers = lostRole.members;
        await stripPresenceRoles(guild, lostMembers);

        savePresence({ presents: [], absents: [], lates: [], noResponses: [], messageId: null });

        await interaction.editReply({
            content: `✅ Présence terminée!\n\n📋 Rôles retirés pour **${lostMembers.size}** membre(s)`,
        });
    } catch (error) {
        console.error('Erreur /reset:', error);
        await interaction.editReply({ content: '❌ Erreur lors du reset.' });
    }
}

const BUTTON_STATUS_MAP = {
    presence_present: { status: 'present', message: '✅ Vous êtes marqué comme **présent** ce soir!' },
    presence_late: { status: 'late', message: '⏰ Vous êtes marqué comme **en retard** ce soir!' },
    presence_absent: { status: 'absent', message: '❌ Vous êtes marqué comme **absent** ce soir.' },
};

async function handleButton(interaction) {
    const action = BUTTON_STATUS_MAP[interaction.customId];
    if (!action) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const lostRole = interaction.guild.roles.cache.get(config.roles.lost);
        if (!lostRole || !interaction.member.roles.cache.has(lostRole.id)) {
            await interaction.editReply({ content: '❌ Vous devez avoir le rôle Lost pour répondre.' });
            return;
        }

        const statusRoles = {
            present: interaction.guild.roles.cache.get(config.roles.present),
            absent: interaction.guild.roles.cache.get(config.roles.absent),
            late: interaction.guild.roles.cache.get(config.roles.late),
            noResponse: interaction.guild.roles.cache.get(config.roles.noResponse),
        };

        const userId = interaction.user.id;

        for (const role of Object.values(statusRoles)) {
            if (role) await interaction.member.roles.remove(role).catch(() => {});
        }

        const roleToAdd = statusRoles[action.status];
        if (roleToAdd) await interaction.member.roles.add(roleToAdd);

        const currentStatus = getUserCurrentStatus(userId);
        updateUserPresence(userId, action.status);
        if (currentStatus !== action.status) {
            if (currentStatus && currentStatus !== 'noResponse') {
                decrementUserHistory(userId, currentStatus);
            }
            updateUserHistory(userId, action.status);
        }

        await interaction.editReply({ content: action.message });
        await updatePresenceMessage(interaction);
    } catch (error) {
        console.error('Erreur lors du traitement du bouton:', error);
        try {
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour de votre présence.' });
        } catch (e) {
            console.error('Impossible de répondre à l\'interaction bouton:', e);
        }
    }
}

module.exports = {
    sendPresenceMessage,
    stripPresenceRoles,
    finalizePresenceHistory,
    handleSendPresence,
    handlePresence,
    handleHistory,
    handleHistoryPage,
    handleReset,
    handleButton,
};
