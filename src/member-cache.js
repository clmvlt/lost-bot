const { loadImage } = require('@napi-rs/canvas');
const config = require('./config');

// userId -> { name: string, avatar: Image|null }
const cache = new Map();
let cachedGuild = null;

async function loadAvatar(url) {
    try {
        return await loadImage(url);
    } catch {
        return null;
    }
}

async function refreshCache(guild) {
    if (!guild) return;
    cachedGuild = guild;
    try {
        await guild.members.fetch();
        const lostRole = guild.roles.cache.get(config.roles.lost);
        if (!lostRole) return;

        const newCache = new Map();
        const promises = [];

        for (const [id, member] of lostRole.members) {
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 64 });
            promises.push(
                loadAvatar(avatarUrl).then(avatar => {
                    newCache.set(id, { name: member.displayName, avatar });
                })
            );
        }

        await Promise.all(promises);
        cache.clear();
        for (const [id, data] of newCache) cache.set(id, data);

        console.log(`Cache membres rafraîchi: ${cache.size} membre(s)`);
    } catch (error) {
        console.error('Erreur refresh cache membres:', error);
    }
}

function getName(userId) {
    return cache.get(userId)?.name || null;
}

function getAvatar(userId) {
    return cache.get(userId)?.avatar || null;
}

function getGuild() {
    return cachedGuild;
}

module.exports = { refreshCache, getName, getAvatar, getGuild };
