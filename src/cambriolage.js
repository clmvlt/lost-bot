const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadCambriolage, saveCambriolage } = require('./data');
const { getWeekBounds, parseDateFR, formatDateFR, hasLostRole } = require('./utils');
const { addCambriolageRow, getCambriolageRows, getMemberName } = require('./sheets');

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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Résoudre le nom du membre via le Registre Google Sheets
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const displayName = member?.displayName || targetUser.username;
    const memberName = await getMemberName(displayName);

    // Lire les données depuis Google Sheets
    const OBJET_KEYS = OBJETS.map(o => o.key);
    const rows = await getCambriolageRows();

    const weekEntries = rows.filter(row => {
        if (!row[0] || !row[1]) return false;
        const rowDate = parseDateFR(row[0]);
        if (!rowDate) return false;
        if (rowDate < start || rowDate > end) return false;
        // Vérifier si le membre est dans la liste des participants (colonne B peut contenir plusieurs noms séparés par virgule)
        const participants = row[1].split(',').map(n => n.trim().toLowerCase());
        return participants.includes(memberName.toLowerCase());
    });

    const startStr = formatDateFR(start);
    const endStr = formatDateFR(end);

    if (weekEntries.length === 0) {
        await interaction.editReply({
            content: `Aucun cambriolage pour ${targetUser} cette semaine (${startStr} - ${endStr}).`,
        });
        return;
    }

    // Totaliser chaque objet sur la semaine (colonnes C à K = index 2 à 10)
    const totals = {};
    for (const { key } of OBJETS) totals[key] = 0;
    for (const row of weekEntries) {
        for (let i = 0; i < OBJET_KEYS.length; i++) {
            const val = parseInt(row[i + 2], 10);
            if (!isNaN(val)) totals[OBJET_KEYS[i]] += val;
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

    await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleCambriolage, handleCambriolageSemaine };
