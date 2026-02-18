const { MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('./config');
const { loadBraquages, saveBraquages, DEFAULT_BRAQUAGES } = require('./data');
const { formatDateFR, isAdminOrOwner } = require('./utils');

function formatSlot(slot) {
    const pad = '\u2800'.repeat(20);
    if (!slot.membre) {
        return `\`\`\`\nDisponible\n\`\`\`${pad}`;
    }
    const membres = slot.membre.map(id => `<@${id}>`).join(' ');
    return `\`\`\`\nDate:  ${slot.date}\nHeure: ${slot.heure}\n\`\`\`${membres}${pad}`;
}

function parseHeureToMinutes(heure) {
    if (!heure) return null;
    const match = heure.match(/(\d{1,2})[h:](\d{2})/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function minutesToHeure(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
}

function slotTitle(name, slot1) {
    if (!slot1.membre) return name;
    const m1 = parseHeureToMinutes(slot1.heure);
    if (m1 === null) return name;
    const nextTime = minutesToHeure(m1 + 120);
    return `${name} (${nextTime})`;
}

function buildBraquagesEmbed(data) {
    const embed = new EmbedBuilder()
        .setTitle('𝗕𝗥𝗔𝗤𝗨𝗔𝗚𝗘𝗦 𝗗𝗨 𝗝𝗢𝗨𝗥')
        .setDescription('```\nPour éviter les soucis avec les Sup et Ammu, réservez ici!\n```\n\u200B')
        .setColor(0xFFFFFF)
        .addFields(
            { name: 'Superette 1', value: formatSlot(data.sup1), inline: true },
            { name: '\u2800', value: '\u2800', inline: true },
            { name: slotTitle('Superette 2', data.sup1), value: formatSlot(data.sup2), inline: true },
            { name: 'Ammu 1', value: formatSlot(data.ammu1), inline: true },
            { name: '\u2800', value: '\u2800', inline: true },
            { name: slotTitle('Ammu 2', data.ammu1), value: formatSlot(data.ammu2), inline: true },
        )
        .setFooter({ text: 'Rappel: 2 par jour max | Reset automatique à 7h' })
        .setTimestamp();

    return embed;
}

async function sendOrUpdateBraquagesMessage(channel) {
    const data = loadBraquages();
    const embed = buildBraquagesEmbed(data);

    if (data.messageId) {
        try {
            const message = await channel.messages.fetch(data.messageId);
            await message.edit({ embeds: [embed] });
            return message;
        } catch (error) {
            console.log('Message braquages introuvable, création d\'un nouveau');
        }
    }

    const message = await channel.send({ embeds: [embed] });
    data.messageId = message.id;
    saveBraquages(data);
    return message;
}

async function initBraquagesChannel(client) {
    try {
        const channel = await client.channels.fetch(config.braquagesChannelId);
        if (!channel) {
            console.log('Channel braquages introuvable, skip init');
            return;
        }

        // Clear tous les messages du channel
        let deleted;
        do {
            deleted = await channel.bulkDelete(100, true);
        } while (deleted.size > 0);

        // Charger les données existantes (pas de reset)
        const data = loadBraquages();

        const message = await channel.send({ embeds: [buildBraquagesEmbed(data)] });
        data.messageId = message.id;
        saveBraquages(data);

        console.log('Channel braquages initialisé');
    } catch (error) {
        console.error('Erreur init braquages:', error);
    }
}

async function resetBraquagesMessage(channel) {
    const data = { ...DEFAULT_BRAQUAGES };
    const oldData = loadBraquages();
    data.messageId = oldData.messageId;
    saveBraquages(data);

    return sendOrUpdateBraquagesMessage(channel);
}

function findAvailableSlot(data, type) {
    const slot1 = `${type}1`;
    const slot2 = `${type}2`;

    if (!data[slot1].membre) return slot1;
    if (!data[slot2].membre) return slot2;
    return null;
}

async function handleBraquage(interaction, type, client) {
    const withUsers = interaction.options.getString('with');
    const heure = interaction.options.getString('heure');

    const data = loadBraquages();
    const slotKey = findAvailableSlot(data, type);

    if (!slotKey) {
        const typeName = type === 'sup' ? 'Superette' : 'Ammu';
        await interaction.reply({
            content: `❌ Les 2 ${typeName}s sont déjà réservées pour aujourd'hui!`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const membres = [interaction.user.id];
    if (withUsers) {
        const mentions = withUsers.match(/<@!?(\d+)>/g) || [];
        for (const mention of mentions) {
            const userId = mention.replace(/<@!?(\d+)>/, '$1');
            if (!membres.includes(userId)) {
                membres.push(userId);
            }
        }
    }

    const now = new Date();
    const heureValue = heure || now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

    data[slotKey] = {
        date: formatDateFR(now),
        heure: heureValue,
        membre: membres,
    };
    saveBraquages(data);

    try {
        const channel = await client.channels.fetch(config.braquagesChannelId);
        if (channel) {
            await sendOrUpdateBraquagesMessage(channel);
        }
    } catch (error) {
        console.error('Erreur mise à jour message braquages:', error);
    }

    const typeName = type === 'sup' ? 'Superette' : 'Ammu';
    const slotNum = slotKey.slice(-1);
    await interaction.reply({
        content: `✅ ${typeName} ${slotNum} réservée!`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleSup(interaction, client) {
    await handleBraquage(interaction, 'sup', client);
}

async function handleAmmu(interaction, client) {
    await handleBraquage(interaction, 'ammu', client);
}

async function handleBraquagesReset(interaction, client) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const channel = await client.channels.fetch(config.braquagesChannelId);
        if (channel) {
            await resetBraquagesMessage(channel);
            await interaction.editReply({ content: '✅ Message des braquages réinitialisé!' });
        } else {
            await interaction.editReply({ content: '❌ Salon braquages introuvable!' });
        }
    } catch (error) {
        console.error('Erreur /braquages-reset:', error);
        await interaction.editReply({ content: '❌ Erreur lors du reset.' });
    }
}

const SLOT_NAMES = {
    sup1: 'Superette 1',
    sup2: 'Superette 2',
    ammu1: 'Ammu 1',
    ammu2: 'Ammu 2',
};

async function handleBraquagesClear(interaction, client) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    const slot = interaction.options.getString('slot');

    const data = loadBraquages();
    data[slot] = { date: null, heure: null, membre: null };
    saveBraquages(data);

    try {
        const channel = await client.channels.fetch(config.braquagesChannelId);
        if (channel) {
            await sendOrUpdateBraquagesMessage(channel);
        }
    } catch (error) {
        console.error('Erreur mise à jour message braquages:', error);
    }

    await interaction.reply({
        content: `✅ ${SLOT_NAMES[slot]} a été libéré!`,
        flags: MessageFlags.Ephemeral,
    });
}

module.exports = {
    sendOrUpdateBraquagesMessage,
    resetBraquagesMessage,
    initBraquagesChannel,
    handleSup,
    handleAmmu,
    handleBraquagesReset,
    handleBraquagesClear,
};
