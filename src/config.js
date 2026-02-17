module.exports = {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.CHANNEL_ID,
    fallbackChannelId: process.env.FALLBACK_CHANNEL_ID,
    ownerId: process.env.OWNER_ID,
    roles: {
        lost: process.env.ROLE_LOST,
        present: process.env.ROLE_PRESENT,
        absent: process.env.ROLE_ABSENT,
        noResponse: process.env.ROLE_NO_RESPONSE,
        late: process.env.ROLE_LATE,
    },
};
