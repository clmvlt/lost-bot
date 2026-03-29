const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadCambriolage, saveCambriolage } = require('./data');
const { getWeekBounds, formatDateFR, hasLostRole } = require('./utils');
const { addCambriolageRow } = require('./sheets');

const OBJETS = [
    { key: 'ordinateur', label: 'Ordinateur' },
    { key: 'tableau', label: 'Tableau' },
    { key: 'sculpture', label: 'Sculpture' },
    { key: 'television', label: 'Télévision' },
    { key: 'tablette', label: 'Tablette' },
    { key: 'console', label: 'Console' },
    { key: 'micro-ondes', label: 'Micro-Ondes' },
    { key: 'appareil-photo', label: 'Appareil Photo' },
    { key: 'enceinte', label: 'Enceinte' },
];

function checkLostRole(interaction) {
    if (!hasLostRole(interaction, config.roles.lost)) {
        interaction.reply({ content: '❌ Vous devez avoir le rôle Lost pour utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

function parseMentions(str) {
    const matches = str.match(/<@!?(\d+)>/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/<@!?/, '').replace(/>/, '')))];
}

async function handleCambriolage(interaction) {
    if (!checkLostRole(interaction)) return;

    const withStr = interaction.options.getString('with');
    const userIds = [interaction.user.id];
    if (withStr) {
        const mentioned = parseMentions(withStr);
        for (const id of mentioned) {
            if (!userIds.includes(id)) userIds.push(id);
        }
    }

    const quantities = {};
    let hasAtLeastOne = false;
    for (const { key } of OBJETS) {
        const val = interaction.options.getInteger(key) || 0;
        quantities[key] = val;
        if (val > 0) hasAtLeastOne = true;
    }

    if (!hasAtLeastOne) {
        await interaction.reply({ content: '❌ Vous devez indiquer au moins un objet.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    // Sauvegarde locale par participant
    const cambrioData = loadCambriolage();
    for (const userId of userIds) {
        if (!cambrioData[userId]) cambrioData[userId] = [];
        cambrioData[userId].push({ quantities, date: new Date().toISOString() });
    }
    saveCambriolage(cambrioData);

    // Noms pour Google Sheets
    const displayNames = await Promise.all(userIds.map(async (id) => {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        return member?.displayName || id;
    }));

    let sheetsSaved = true;
    try {
        await addCambriolageRow(displayNames, quantities);
    } catch (error) {
        sheetsSaved = false;
        console.error('Erreur ajout Google Sheets Cambriolage:', error.message);
    }

    const mentionsList = userIds.map(id => `<@${id}>`).join(', ');

    // Construire la liste des objets volés
    const objetFields = OBJETS
        .filter(({ key }) => quantities[key] > 0)
        .map(({ key, label }) => ({ name: label, value: `x${quantities[key]}`, inline: true }));

    const embed = new EmbedBuilder()
        .setTitle('🏠 Cambriolage')
        .addFields(
            { name: 'Date', value: formatDateFR(new Date(), { hour: '2-digit', minute: '2-digit' }), inline: true },
            { name: 'Participants', value: `${mentionsList} (${userIds.length})`, inline: false },
            ...objetFields,
        )
        .setColor(0x2C3E50)
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

async function handleCambriolageSemaine(interaction) {
    if (!checkLostRole(interaction)) return;

    const targetUser = interaction.options.getUser('membre') || interaction.user;
    const { start, end } = getWeekBounds(new Date());

    const cambrioData = loadCambriolage();
    const entries = cambrioData[targetUser.id] || [];

    const weekEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
    });

    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    if (weekEntries.length === 0) {
        await interaction.reply({
            content: `Aucun cambriolage pour ${targetUser} cette semaine (${startStr} - ${endStr}).`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Totaliser chaque objet sur la semaine
    const totals = {};
    for (const { key } of OBJETS) totals[key] = 0;
    for (const entry of weekEntries) {
        for (const { key } of OBJETS) {
            totals[key] += (entry.quantities[key] || 0);
        }
    }

    const objetLines = OBJETS
        .filter(({ key }) => totals[key] > 0)
        .map(({ key, label }) => ({ name: label, value: `x${totals[key]}`, inline: true }));

    const totalObjets = Object.values(totals).reduce((a, b) => a + b, 0);

    const embed = new EmbedBuilder()
        .setTitle(`🏠 Cambriolages de ${targetUser.username}`)
        .setDescription(`Semaine du ${startStr} au ${endStr}`)
        .addFields(
            { name: 'Cambriolages', value: `${weekEntries.length}`, inline: true },
            { name: 'Objets totaux', value: `${totalObjets}`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            ...objetLines,
        )
        .setColor(0x2C3E50)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

module.exports = { handleCambriolage, handleCambriolageSemaine };
