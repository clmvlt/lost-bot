module.exports = {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.CHANNEL_ID,
    fallbackChannelId: process.env.FALLBACK_CHANNEL_ID,
    braquagesChannelId: process.env.BRAQUAGES_CHANNEL_ID,
    munitionsChannelId: process.env.MUNITIONS_CHANNEL_ID,
    ownerId: process.env.OWNER_ID,
    googleSheetsId: process.env.GOOGLE_SHEETS_ID,
    googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    roles: {
        lost: process.env.ROLE_LOST,
        present: process.env.ROLE_PRESENT,
        absent: process.env.ROLE_ABSENT,
        noResponse: process.env.ROLE_NO_RESPONSE,
        late: process.env.ROLE_LATE,
    },
};
