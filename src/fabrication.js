const { EmbedBuilder, MessageFlags, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');
const { loadFabrication, saveFabrication } = require('./data');
const { getWeekBounds, parseDateFR, formatDateFR, hasLostRole } = require('./utils');
const { renderRanking } = require('./canvas-ranking');

function checkLostRole(interaction) {
    if (!hasLostRole(interaction, config.roles.lost)) {
        interaction.reply({ content: '❌ Vous devez avoir le rôle Lost pour utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

function parseWeekDate(interaction) {
    const dateStr = interaction.options.getString('date');
    if (!dateStr) return new Date();
    const parsed = parseDateFR(dateStr);
    if (!parsed) {
        interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA.', flags: MessageFlags.Ephemeral });
        return null;
    }
    return parsed;
}

function parseMentions(str) {
    const matches = str.match(/<@!?(\d+)>/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/<@!?/, '').replace(/>/, '')))];
}

async function handleFabrique(interaction) {
    if (!checkLostRole(interaction)) return;

    const participantsStr = interaction.options.getString('participants');
    const userIds = parseMentions(participantsStr);

    if (userIds.length === 0) {
        await interaction.reply({ content: '❌ Vous devez mentionner au moins un participant.', flags: MessageFlags.Ephemeral });
        return;
    }

    const session = {
        date: new Date().toISOString(),
        participants: userIds,
        createdBy: interaction.user.id,
    };

    const data = loadFabrication();
    data.push(session);
    saveFabrication(data);

    const mentionsList = userIds.map(id => `<@${id}>`).join(', ');

    const embed = new EmbedBuilder()
        .setTitle('🧪 Session de fabrication')
        .addFields(
            { name: 'Date', value: formatDateFR(session.date, { hour: '2-digit', minute: '2-digit' }), inline: true },
            { name: 'Participants', value: `${mentionsList} (${userIds.length})`, inline: false },
        )
        .setColor(0x9B59B6)
        .setFooter({ text: `Créée par ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

function buildWeekCounts(data, start, end) {
    const weekSessions = data.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
    });

    const counts = {};
    for (const session of weekSessions) {
        for (const userId of session.participants) {
            counts[userId] = (counts[userId] || 0) + 1;
        }
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([userId, count]) => ({
            userId,
            value: `${count} session(s)`,
            count,
        }));
}

function buildGlobalCounts(data) {
    const counts = {};
    for (const session of data) {
        for (const userId of session.participants) {
            counts[userId] = (counts[userId] || 0) + 1;
        }
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([userId, count]) => ({
            userId,
            value: `${count} session(s)`,
            subtitle: null,
            count,
        }));
}

function buildFabPageButtons(prefix, currentPage, totalPages) {
    if (totalPages <= 1) return null;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_page_${currentPage - 1}`)
            .setLabel('Precedent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`${prefix}_page_${currentPage + 1}`)
            .setLabel('Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
    );
}

async function handleFabriqueSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const refDate = parseWeekDate(interaction);
    if (!refDate) return;

    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    const data = loadFabrication();
    const sorted = buildWeekCounts(data, start, end);

    if (sorted.length === 0) {
        await interaction.reply({ content: 'Aucun participant cette semaine.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, 0, interaction.guild, interaction.user.id, {
        title: 'F A B R I C A T I O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: `Semaine du ${startStr} au ${endStr}`,
        subtitle: `Du ${startStr} au ${endStr}`,
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-semaine.png' });
    const row = buildFabPageButtons('fab_semaine', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

async function handleFabriqueTop(interaction) {
    if (!checkLostRole(interaction)) return;

    const data = loadFabrication();
    const sorted = buildGlobalCounts(data);

    if (sorted.length === 0) {
        await interaction.reply({ content: 'Aucune session enregistrée.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, 0, interaction.guild, interaction.user.id, {
        title: 'F A B R I C A T I O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: `${data.length} session(s) au total`,
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-top.png' });
    const row = buildFabPageButtons('fab_top', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

async function handleFabriqueTopPage(interaction) {
    const page = parseInt(interaction.customId.split('_').pop());
    await interaction.deferUpdate();

    const data = loadFabrication();
    const sorted = buildGlobalCounts(data);
    if (sorted.length === 0) return;

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, page, interaction.guild, interaction.user.id, {
        title: 'F A B R I C A T I O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: `${data.length} session(s) au total`,
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-top.png' });
    const row = buildFabPageButtons('fab_top', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [], embeds: [], content: null });
}

async function handleFabriqueSemainePage(interaction) {
    const page = parseInt(interaction.customId.split('_').pop());
    await interaction.deferUpdate();

    const data = loadFabrication();
    const refDate = new Date();
    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);
    const sorted = buildWeekCounts(data, start, end);
    if (sorted.length === 0) return;

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, page, interaction.guild, interaction.user.id, {
        title: 'F A B R I C A T I O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: `Semaine du ${startStr} au ${endStr}`,
        subtitle: `Du ${startStr} au ${endStr}`,
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-semaine.png' });
    const row = buildFabPageButtons('fab_semaine', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [], embeds: [], content: null });
}

async function handleFabriqueDelete(interaction) {
    if (!checkLostRole(interaction)) return;

    const data = loadFabrication();

    if (data.length === 0) {
        await interaction.reply({ content: '❌ Aucune session de fabrication à supprimer.', flags: MessageFlags.Ephemeral });
        return;
    }

    const removed = data.pop();
    saveFabrication(data);

    const mentionsList = removed.participants.map(id => `<@${id}>`).join(', ');

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Session supprimée')
        .addFields(
            { name: 'Date', value: formatDateFR(removed.date, { hour: '2-digit', minute: '2-digit' }), inline: true },
            { name: 'Participants', value: mentionsList, inline: false },
        )
        .setColor(0xED4245)
        .setFooter({ text: `Supprimée par ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    handleFabrique,
    handleFabriqueSemaine,
    handleFabriqueTop,
    handleFabriqueDelete,
    handleFabriqueTopPage,
    handleFabriqueSemainePage,
};
