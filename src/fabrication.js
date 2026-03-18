const { EmbedBuilder, MessageFlags, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');
const { loadFabrication, saveFabrication } = require('./data');
const { getWeekBounds, parseDateFR, formatDateFR, formatMoney, hasLostRole } = require('./utils');
const { renderRanking } = require('./canvas-ranking');
const { getEmplacements, getGroupes, addFabriqueRow } = require('./sheets');

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

async function handleFabriqueAutocomplete(interaction) {
    try {
        const focused = interaction.options.getFocused(true);

        let choices = [];
        if (focused.name === 'emplacement') {
            choices = await getEmplacements();
        } else if (focused.name === 'groupe') {
            choices = await getGroupes();
        }

        const filtered = choices
            .filter(c => c.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(c => ({ name: c, value: c }));
        await interaction.respond(filtered);
    } catch (error) {
        console.error('Erreur autocomplete fabrique:', error.message);
        await interaction.respond([]);
    }
}

async function handleFabrique(interaction) {
    if (!checkLostRole(interaction)) return;

    const participantsStr = interaction.options.getString('participants');
    const montant = interaction.options.getNumber('montant');
    const emplacement = interaction.options.getString('emplacement');
    const groupe = interaction.options.getString('groupe') || 'Lost';
    const userIds = parseMentions(participantsStr);

    if (userIds.length === 0) {
        await interaction.reply({ content: '❌ Vous devez mentionner au moins un participant.', flags: MessageFlags.Ephemeral });
        return;
    }

    // Validation des champs autocomplete
    const validEmplacements = await getEmplacements();
    if (!validEmplacements.some(e => e.toLowerCase() === emplacement.toLowerCase())) {
        await interaction.reply({ content: '❌ Emplacement invalide. Veuillez choisir parmi les suggestions.', flags: MessageFlags.Ephemeral });
        return;
    }
    const groupeInput = interaction.options.getString('groupe');
    if (groupeInput) {
        const validGroupes = await getGroupes();
        if (!validGroupes.some(g => g.toLowerCase() === groupeInput.toLowerCase())) {
            await interaction.reply({ content: '❌ Groupe invalide. Veuillez choisir parmi les suggestions.', flags: MessageFlags.Ephemeral });
            return;
        }
    }

    await interaction.deferReply();

    // Sauvegarde locale par participant
    const fabData = loadFabrication();
    for (const userId of userIds) {
        if (!fabData[userId]) fabData[userId] = [];
        fabData[userId].push({ montant, emplacement, date: new Date().toISOString() });
    }
    saveFabrication(fabData);

    // Une seule ligne Google Sheets avec tous les participants
    const displayNames = await Promise.all(userIds.map(async (id) => {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        return member?.displayName || id;
    }));

    let sheetsSaved = true;
    try {
        await addFabriqueRow(displayNames, emplacement, montant, groupe);
    } catch (error) {
        sheetsSaved = false;
        console.error('Erreur ajout Google Sheets Fabrication:', error.message);
    }

    const mentionsList = userIds.map(id => `<@${id}>`).join(', ');

    const embed = new EmbedBuilder()
        .setTitle('🧪 Session de pochon')
        .addFields(
            { name: 'Date', value: formatDateFR(new Date(), { hour: '2-digit', minute: '2-digit' }), inline: true },
            { name: 'Pochon', value: formatMoney(montant), inline: true },
            { name: 'Emplacement', value: emplacement, inline: true },
            { name: 'Groupe', value: groupe, inline: true },
            { name: 'Participants', value: `${mentionsList} (${userIds.length})`, inline: false },
        )
        .setColor(0x9B59B6)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    if (sheetsSaved) {
        try {
            const reply = await interaction.fetchReply();
            await reply.react('✅');
        } catch (error) {
            console.error('Erreur ajout réaction:', error.message);
        }
    }
}

function buildWeekResults(fabData, start, end) {
    const results = [];
    for (const [userId, entries] of Object.entries(fabData)) {
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

function buildFabTopSorted(fabData) {
    return Object.entries(fabData).map(([userId, entries]) => ({
        userId,
        value: formatMoney(entries.reduce((sum, e) => sum + e.montant, 0)),
        subtitle: `${entries.length} entrée(s)`,
        total: entries.reduce((sum, e) => sum + e.montant, 0),
    })).sort((a, b) => b.total - a.total);
}

function buildFabWeekSorted(fabData, start, end) {
    const results = buildWeekResults(fabData, start, end);
    return results.map(r => ({
        userId: r.userId,
        value: formatMoney(r.total),
        subtitle: `${r.count} entrée(s)`,
    }));
}

async function handleFabriqueSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const refDate = parseWeekDate(interaction);
    if (!refDate) return;

    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    const fabData = loadFabrication();
    const results = buildWeekResults(fabData, start, end);

    if (results.length === 0) {
        await interaction.reply({ content: 'Aucune entrée cette semaine.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const sorted = results.map(r => ({
        userId: r.userId,
        value: formatMoney(r.total),
        subtitle: `${r.count} entrée(s)`,
    }));

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, 0, interaction.guild, interaction.user.id, {
        title: 'P O C H O N',
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

    const fabData = loadFabrication();
    const sorted = buildFabTopSorted(fabData);

    if (sorted.length === 0) {
        await interaction.reply({ content: 'Aucune entrée enregistrée.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, 0, interaction.guild, interaction.user.id, {
        title: 'P O C H O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: 'Classement global',
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-top.png' });
    const row = buildFabPageButtons('fab_top', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

async function handleFabriqueTopPage(interaction) {
    const page = parseInt(interaction.customId.split('_').pop());
    await interaction.deferUpdate();

    const fabData = loadFabrication();
    const sorted = buildFabTopSorted(fabData);
    if (sorted.length === 0) return;

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, page, interaction.guild, interaction.user.id, {
        title: 'P O C H O N',
        titleColor: '#9B59B6',
        accentColor: '#9B59B6',
        footerLabel: 'Classement global',
    });

    const file = new AttachmentBuilder(buffer, { name: 'fabrique-top.png' });
    const row = buildFabPageButtons('fab_top', currentPage, totalPages);
    await interaction.editReply({ files: [file], components: row ? [row] : [], embeds: [], content: null });
}

async function handleFabriqueSemainePage(interaction) {
    const page = parseInt(interaction.customId.split('_').pop());
    await interaction.deferUpdate();

    const fabData = loadFabrication();
    const refDate = new Date();
    const { start, end } = getWeekBounds(refDate);
    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);
    const sorted = buildFabWeekSorted(fabData, start, end);
    if (sorted.length === 0) return;

    const { buffer, currentPage, totalPages } = await renderRanking(sorted, page, interaction.guild, interaction.user.id, {
        title: 'P O C H O N',
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

    const userId = interaction.user.id;
    const fabData = loadFabrication();
    const entries = fabData[userId];

    if (!entries || entries.length === 0) {
        await interaction.reply({ content: '❌ Aucune entrée de fabrication à supprimer.', flags: MessageFlags.Ephemeral });
        return;
    }

    const removed = entries.pop();
    saveFabrication(fabData);

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Entrée supprimée')
        .addFields(
            { name: 'Date', value: formatDateFR(removed.date, { hour: '2-digit', minute: '2-digit' }), inline: true },
            { name: 'Montant', value: formatMoney(removed.montant), inline: true },
            { name: 'Emplacement', value: removed.emplacement, inline: true },
        )
        .setColor(0xED4245)
        .setFooter({ text: `Supprimée par ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    handleFabrique,
    handleFabriqueAutocomplete,
    handleFabriqueSemaine,
    handleFabriqueTop,
    handleFabriqueDelete,
    handleFabriqueTopPage,
    handleFabriqueSemainePage,
};
