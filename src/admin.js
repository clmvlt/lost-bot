const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const config = require('./config');
const { isAdminOrOwner } = require('./utils');

async function handleSetMeAdmin(interaction) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guild = interaction.guild;
        const botHighestRole = guild.members.me.roles.highest;

        const adminRole = await guild.roles.create({
            name: 'Admin',
            permissions: [PermissionFlagsBits.Administrator],
            position: botHighestRole.position - 1,
            reason: 'Rôle admin créé via /setmeadmin',
        });

        const member = await guild.members.fetch(config.ownerId);
        await member.roles.add(adminRole);

        await interaction.editReply({ content: `✅ Rôle **${adminRole.name}** créé et attribué!` });
    } catch (error) {
        console.error('Erreur /setmeadmin:', error);
        await interaction.editReply({ content: '❌ Erreur lors de la création du rôle.' });
    }
}

async function handleUnsetMeAdmin(interaction) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guild = interaction.guild;
        const adminRole = guild.roles.cache.find(
            role => role.name === 'Admin' && role.permissions.has(PermissionFlagsBits.Administrator)
        );

        if (!adminRole) {
            await interaction.editReply({ content: '❌ Aucun rôle Admin trouvé.' });
            return;
        }

        await adminRole.delete('Rôle admin supprimé via /unsetmeadmin');
        await interaction.editReply({ content: '✅ Rôle **Admin** supprimé!' });
    } catch (error) {
        console.error('Erreur /unsetmeadmin:', error);
        await interaction.editReply({ content: '❌ Erreur lors de la suppression du rôle.' });
    }
}

async function handleSay(interaction) {
    if (!isAdminOrOwner(interaction)) {
        await interaction.reply({ content: '❌ Vous n\'êtes pas autorisé à utiliser cette commande.', flags: MessageFlags.Ephemeral });
        return;
    }

    const message = interaction.options.getString('message');
    const targetUser = interaction.options.getUser('membre');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        if (targetUser) {
            const member = await interaction.guild.members.fetch(targetUser.id);
            await member.send(message);
            await interaction.editReply({ content: `✅ Message envoyé en MP à **${targetUser.displayName}**.` });
        } else {
            await interaction.channel.send(message);
            await interaction.editReply({ content: '✅ Message envoyé dans le salon.' });
        }
    } catch (error) {
        console.error('Erreur /say:', error);
        await interaction.editReply({ content: '❌ Impossible d\'envoyer le message.' });
    }
}

module.exports = { handleSetMeAdmin, handleUnsetMeAdmin, handleSay };
