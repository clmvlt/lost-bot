const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const { loadMunitions, saveMunitions } = require('./data');
const { formatDateFR, hasLostRole, isAdminOrOwner } = require('./utils');
const { getCoffres, getAmmunitions, getGroupes, addMunitionsRow } = require('./sheets');

function checkLostRole(interaction) {
    if (!hasLostRole(interaction, config.roles.lost)) {
        interaction.reply({ content: '❌ Vous devez avoir le rôle Lost pour utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

function formatCoffreSlot(entry) {
    const pad = '\u2800'.repeat(15);
    if (!entry) {
        return `\`\`\`\nDisponible\n\`\`\`${pad}`;
    }
    return `\`\`\`\nDate: ${entry.date}\nType: ${entry.ammunition}\n\`\`\`<@${entry.membre}>${pad}`;
}

function buildMunitionsEmbed(data, coffresList) {
    const embed = new EmbedBuilder()
        .setTitle('\u{1D5E0}\u{1D5E8}\u{1D5E1}\u{1D5DC}\u{1D5E7}\u{1D5DC}\u{1D5E2}\u{1D5E1}\u{1D5E6} \u{1D5D7}\u{1D5E8} \u{1D5DD}\u{1D5E2}\u{1D5E8}\u{1D5E5}')
        .setDescription('```\nRécapitulatif des coffres de munitions\n```\n\u200B')
        .setColor(0xFFFFFF)
        .setFooter({ text: 'Reset automatique à 7h' })
        .setTimestamp();

    for (const coffre of coffresList) {
        const entry = data.coffres[coffre];
        embed.addFields({ name: `Coffre ${coffre}`, value: formatCoffreSlot(entry), inline: true });
    }

    return embed;
}

async function sendOrUpdateMunitionsMessage(channel, coffresList) {
    const data = loadMunitions();
    if (!coffresList) coffresList = Object.keys(data.coffres);
    const embed = buildMunitionsEmbed(data, coffresList);

    if (data.messageId) {
        try {
            const message = await channel.messages.fetch(data.messageId);
            await message.edit({ embeds: [embed] });
            return message;
        } catch (error) {
            console.log('Message munitions introuvable, création d\'un nouveau');
        }
    }

    const message = await channel.send({ embeds: [embed] });
    data.messageId = message.id;
    saveMunitions(data);
    return message;
}

async function initMunitionsChannel(client) {
    try {
        const channel = await client.channels.fetch(config.munitionsChannelId);
        if (!channel) {
            console.log('Channel munitions introuvable, skip init');
            return;
        }

        let coffresList;
        try {
            coffresList = await getCoffres();
        } catch (error) {
            console.error('Erreur récupération coffres:', error.message);
            coffresList = [];
        }

        const data = loadMunitions();

        // Synchroniser les coffres avec la liste du registre
        for (const coffre of coffresList) {
            if (!(coffre in data.coffres)) {
                data.coffres[coffre] = null;
            }
        }
        saveMunitions(data);

        // Clear le channel et envoyer un nouveau message
        let deleted;
        do {
            deleted = await channel.bulkDelete(100, true);
        } while (deleted.size > 0);

        const message = await channel.send({ embeds: [buildMunitionsEmbed(data, coffresList)] });
        data.messageId = message.id;
        saveMunitions(data);

        console.log('Channel munitions initialisé');
    } catch (error) {
        console.error('Erreur init munitions:', error);
    }
}

async function resetMunitionsMessage(channel) {
    let coffresList;
    try {
        coffresList = await getCoffres();
    } catch (error) {
        console.error('Erreur récupération coffres pour reset:', error.message);
        coffresList = [];
    }

    const oldData = loadMunitions();
    const data = { coffres: {}, messageId: oldData.messageId };

    for (const coffre of coffresList) {
        data.coffres[coffre] = null;
    }
    saveMunitions(data);

    return sendOrUpdateMunitionsMessage(channel, coffresList);
}

async function handleMunitionsAutocomplete(interaction) {
    try {
        const focused = interaction.options.getFocused(true);

        let choices = [];
        if (focused.name === 'coffre') {
            const montant = interaction.options.getNumber('montant');
            if (montant !== null && montant < 0) {
                choices = ['Aucun'];
            } else {
                const allCoffres = await getCoffres();
                const data = loadMunitions();
                choices = allCoffres.filter(c => !data.coffres[c]);
            }
        } else if (focused.name === 'ammunition') {
            choices = await getAmmunitions();
        } else if (focused.name === 'groupe') {
            choices = await getGroupes();
        }

        const filtered = choices
            .filter(c => c.toLowerCase().includes(focused.value.toLowerCase()))
            .slice(0, 25)
            .map(c => ({ name: c, value: c }));
        await interaction.respond(filtered);
    } catch (error) {
        console.error('Erreur autocomplete munitions:', error.message);
        await interaction.respond([]);
    }
}

async function handleMunitions(interaction, client) {
    if (!checkLostRole(interaction)) return;

    const montant = interaction.options.getNumber('montant');
    const rawCoffre = interaction.options.getString('coffre');
    const ammunition = interaction.options.getString('ammunition');
    const groupe = interaction.options.getString('groupe') || 'Lost';
    const info = interaction.options.getString('info') || '';
    const isAjout = montant > 0;
    const coffre = (!isAjout || rawCoffre === 'Aucun') ? null : rawCoffre;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Valider le type de munition
    if (ammunition) {
        const validAmmunitions = await getAmmunitions();
        if (!validAmmunitions.includes(ammunition)) {
            await interaction.editReply({ content: `❌ **${ammunition}** n'est pas un type de munition valide. Veuillez sélectionner une option depuis la liste.` });
            return;
        }
    }

    // Mettre à jour le recap (ajout uniquement)
    let updateEmbed = false;

    if (isAjout && coffre) {
        const data = loadMunitions();
        data.coffres[coffre] = {
            date: formatDateFR(new Date()),
            membre: interaction.user.id,
            ammunition: ammunition || 'N/A',
        };
        saveMunitions(data);
        updateEmbed = true;
    }

    if (updateEmbed) {
        try {
            const channel = await client.channels.fetch(config.munitionsChannelId);
            if (channel) {
                await sendOrUpdateMunitionsMessage(channel);
            }
        } catch (error) {
            console.error('Erreur mise à jour message munitions:', error);
        }
    }

    // Écrire dans Google Sheets
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const displayName = member?.displayName || interaction.user.username;

    try {
        await addMunitionsRow(displayName, coffre, ammunition, montant, groupe, info);
    } catch (error) {
        console.error('Erreur ajout Google Sheets Munitions:', error.message);
    }

    // Réponse
    const embed = new EmbedBuilder()
        .setTitle(isAjout ? '📦 Ajout de munitions' : '📦 Retrait de munitions')
        .addFields(
            { name: 'Date', value: formatDateFR(new Date(), { hour: '2-digit', minute: '2-digit' }), inline: true },
        );

    if (coffre) embed.addFields({ name: 'Coffre', value: coffre, inline: true });
    embed.addFields(
        { name: 'Type', value: ammunition || 'N/A', inline: true },
        { name: 'Quantité', value: `${isAjout ? '+' : '-'}${Math.abs(montant)}`, inline: true },
        { name: 'Groupe', value: groupe, inline: true },
    );

    if (info) embed.addFields({ name: 'Info', value: info, inline: false });

    embed.setColor(isAjout ? 0x2ECC71 : 0xED4245).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleMunitionsReset(interaction, client) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    const coffreOption = interaction.options.getString('coffre');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Valider que le coffre existe si spécifié
        if (coffreOption) {
            const coffresList = await getCoffres();
            if (!coffresList.includes(coffreOption)) {
                await interaction.editReply({ content: `❌ Le coffre **${coffreOption}** n'existe pas. Veuillez sélectionner un coffre depuis la liste.` });
                return;
            }

            // Reset d'un seul coffre
            const data = loadMunitions();
            data.coffres[coffreOption] = null;
            saveMunitions(data);

            const channel = await client.channels.fetch(config.munitionsChannelId);
            if (channel) {
                await sendOrUpdateMunitionsMessage(channel);
                await interaction.editReply({ content: `✅ Coffre **${coffreOption}** réinitialisé !` });
            } else {
                await interaction.editReply({ content: '❌ Salon munitions introuvable!' });
            }
            return;
        }

        // Reset de tous les coffres
        const channel = await client.channels.fetch(config.munitionsChannelId);
        if (channel) {
            await resetMunitionsMessage(channel);
            await interaction.editReply({ content: '✅ Tous les coffres de munitions réinitialisés !' });
        } else {
            await interaction.editReply({ content: '❌ Salon munitions introuvable!' });
        }
    } catch (error) {
        console.error('Erreur /munitions-reset:', error);
        await interaction.editReply({ content: '❌ Erreur lors du reset.' });
    }
}

module.exports = {
    handleMunitions,
    handleMunitionsAutocomplete,
    handleMunitionsReset,
    sendOrUpdateMunitionsMessage,
    resetMunitionsMessage,
    initMunitionsChannel,
};
