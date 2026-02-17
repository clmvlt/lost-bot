const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadArgent, saveArgent } = require('./data');
const { getWeekBounds, parseDateFR, formatDateFR, formatMoney, hasLostRole } = require('./utils');

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

function formatEntryLine(entry, includeYear = true) {
    const options = includeYear
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : { day: '2-digit', month: '2-digit' };
    return `${formatDateFR(entry.date, options)} | ${formatMoney(entry.montant)} | ${entry.activite}`;
}

function buildWeekResults(argentData, start, end) {
    const results = [];
    for (const [userId, entries] of Object.entries(argentData)) {
        const weekEntries = entries.filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end;
        });
        if (weekEntries.length > 0) {
            const total = weekEntries.reduce((sum, e) => sum + e.montant, 0);
            results.push({ userId, total, count: weekEntries.length });
        }
    }
    return results.sort((a, b) => b.total - a.total);
}

function buildRankingLines(results) {
    return results.map((r, i) =>
        `${i + 1}. <@${r.userId}> - **${formatMoney(r.total)}** (${r.count} entrée(s))`
    );
}

async function handleArgent(interaction) {
    if (!checkLostRole(interaction)) return;

    const montant = interaction.options.getNumber('montant');
    const activite = interaction.options.getString('activite');
    const userId = interaction.user.id;

    const argentData = loadArgent();
    if (!argentData[userId]) argentData[userId] = [];
    argentData[userId].push({ montant, activite, date: new Date().toISOString() });
    saveArgent(argentData);

    const embed = new EmbedBuilder()
        .addFields(
            { name: 'Montant', value: formatMoney(montant), inline: true },
            { name: 'Activité', value: activite, inline: true },
        )
        .setColor(montant >= 0 ? 0x57F287 : 0xED4245);

    await interaction.reply({ embeds: [embed] });
}

async function handleArgentTotal(interaction) {
    if (!checkLostRole(interaction)) return;

    const targetUser = interaction.options.getUser('membre') || interaction.user;
    const argentData = loadArgent();
    const entries = argentData[targetUser.id] || [];
    const total = entries.reduce((sum, e) => sum + e.montant, 0);

    const lines = entries.slice(-15).reverse().map(e => formatEntryLine(e));

    const embed = new EmbedBuilder()
        .setTitle(`💰 Total de ${targetUser.username}`)
        .addFields(
            { name: 'Total cumulé', value: `**${formatMoney(total)}**`, inline: false },
            { name: `Dernières entrées (${entries.length} au total)`, value: lines.length > 0 ? lines.join('\n') : 'Aucune entrée', inline: false },
        )
        .setColor(total >= 0 ? 0x57F287 : 0xED4245)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleArgentSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const refDate = parseWeekDate(interaction);
    if (!refDate) return;

    const targetUser = interaction.options.getUser('membre');
    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);
    const argentData = loadArgent();

    if (targetUser) {
        const entries = (argentData[targetUser.id] || []).filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end;
        });
        const total = entries.reduce((sum, e) => sum + e.montant, 0);
        const lines = entries.map(e => formatEntryLine(e, false));

        const embed = new EmbedBuilder()
            .setTitle(`💰 Semaine de ${targetUser.username}`)
            .setDescription(`Du ${startStr} au ${endStr}`)
            .addFields(
                { name: 'Total semaine', value: `**${formatMoney(total)}**`, inline: false },
                { name: `Détail (${entries.length} entrée(s))`, value: lines.length > 0 ? lines.join('\n') : 'Aucune entrée cette semaine', inline: false },
            )
            .setColor(total >= 0 ? 0x57F287 : 0xED4245)
            .setThumbnail(targetUser.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    const results = buildWeekResults(argentData, start, end);
    const lines = buildRankingLines(results);

    const embed = new EmbedBuilder()
        .setTitle('💰 Classement de la semaine')
        .setDescription(`Du ${startStr} au ${endStr}\n\n${lines.length > 0 ? lines.join('\n') : 'Aucune entrée cette semaine'}`)
        .setColor(0x5865F2)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleArgentTop(interaction) {
    if (!checkLostRole(interaction)) return;

    const argentData = loadArgent();
    const results = Object.entries(argentData).map(([userId, entries]) => ({
        userId,
        total: entries.reduce((sum, e) => sum + e.montant, 0),
        count: entries.length,
    })).sort((a, b) => b.total - a.total);

    const lines = buildRankingLines(results);

    const embed = new EmbedBuilder()
        .setTitle('💰 Classement global')
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Aucune entrée enregistrée')
        .setColor(0x5865F2)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleArgentTopSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const refDate = parseWeekDate(interaction);
    if (!refDate) return;

    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    const argentData = loadArgent();
    const results = buildWeekResults(argentData, start, end);
    const lines = buildRankingLines(results);

    const embed = new EmbedBuilder()
        .setTitle('💰 Classement de la semaine')
        .setDescription(`Du ${startStr} au ${endStr}\n\n${lines.length > 0 ? lines.join('\n') : 'Aucune entrée cette semaine'}`)
        .setColor(0x5865F2)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleArgentHistorique(interaction) {
    if (!checkLostRole(interaction)) return;

    const targetUser = interaction.options.getUser('membre') || interaction.user;
    const argentData = loadArgent();
    const entries = argentData[targetUser.id] || [];

    if (entries.length === 0) {
        await interaction.reply({ content: `❌ Aucune entrée pour ${targetUser.username}.`, flags: MessageFlags.Ephemeral });
        return;
    }

    const total = entries.reduce((sum, e) => sum + e.montant, 0);
    const lines = entries.slice().reverse().slice(0, 25).map(e => formatEntryLine(e));
    if (entries.length > 25) lines.push(`... et ${entries.length - 25} autres entrées`);

    const embed = new EmbedBuilder()
        .setTitle(`💰 Historique de ${targetUser.username}`)
        .setDescription(lines.join('\n'))
        .addFields(
            { name: 'Total cumulé', value: `**${formatMoney(total)}**`, inline: true },
            { name: 'Nombre d\'entrées', value: `${entries.length}`, inline: true },
        )
        .setColor(total >= 0 ? 0x57F287 : 0xED4245)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    handleArgent,
    handleArgentTotal,
    handleArgentSemaine,
    handleArgentTop,
    handleArgentTopSemaine,
    handleArgentHistorique,
};
