const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'images');

function getRandomImage() {
    const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    return path.join(IMAGES_DIR, files[Math.floor(Math.random() * files.length)]);
}

function getWeekBounds(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

function parseDateFR(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [jour, mois, annee] = parts.map(Number);
    const date = new Date(annee, mois - 1, jour, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
}

function formatDateFR(date, options = {}) {
    const defaults = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' };
    return new Date(date).toLocaleDateString('fr-FR', { ...defaults, ...options });
}

function formatMoney(amount) {
    const signe = amount >= 0 ? '+' : '';
    return `${signe}${amount.toLocaleString('fr-FR')}$`;
}

function hasLostRole(interaction, lostRoleId) {
    const lostRole = interaction.guild.roles.cache.get(lostRoleId);
    return lostRole && interaction.member.roles.cache.has(lostRole.id);
}

module.exports = {
    getRandomImage,
    getWeekBounds,
    parseDateFR,
    formatDateFR,
    formatMoney,
    hasLostRole,
};
