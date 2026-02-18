const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadFabrication, saveFabrication } = require('./data');
const { getWeekBounds, parseDateFR, formatDateFR, hasLostRole } = require('./utils');

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

async function handleFabriqueSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const refDate = parseWeekDate(interaction);
    if (!refDate) return;

    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    const data = loadFabrication();
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

    const ranking = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([userId, count], i) => `${i + 1}. <@${userId}> — **${count}** session(s)`);

    const description = [
        `Du ${startStr} au ${endStr}`,
        '',
        `**${weekSessions.length}** session(s) cette semaine`,
        '',
        ranking.length > 0 ? ranking.join('\n') : 'Aucun participant cette semaine',
    ].join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🧪 Fabrication — Résumé de la semaine')
        .setDescription(description)
        .setColor(0x9B59B6)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleFabriqueTop(interaction) {
    if (!checkLostRole(interaction)) return;

    const data = loadFabrication();

    const counts = {};
    for (const session of data) {
        for (const userId of session.participants) {
            counts[userId] = (counts[userId] || 0) + 1;
        }
    }

    const ranking = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([userId, count], i) => `${i + 1}. <@${userId}> — **${count}** session(s)`);

    const embed = new EmbedBuilder()
        .setTitle('🧪 Fabrication — Classement global')
        .setDescription(ranking.length > 0
            ? `**${data.length}** session(s) au total\n\n${ranking.join('\n')}`
            : 'Aucune session enregistrée')
        .setColor(0x9B59B6)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
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
};
