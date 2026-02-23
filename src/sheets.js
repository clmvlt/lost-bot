const { google } = require('googleapis');
const config = require('./config');

let sheetsClient = null;

const cache = {
    raisons: { data: null, timestamp: 0 },
    names: { data: null, timestamp: 0 },
    groupes: { data: null, timestamp: 0 },
    sheetId: null,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(entry) {
    return entry.data !== null && (Date.now() - entry.timestamp) < CACHE_TTL;
}

function getSheets() {
    if (sheetsClient) return sheetsClient;

    const auth = new google.auth.GoogleAuth({
        keyFile: config.googleServiceAccountKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

async function getRaisons() {
    if (isCacheValid(cache.raisons)) return cache.raisons.data;

    try {
        const sheets = getSheets();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.googleSheetsId,
            range: 'Registre!G:G',
        });

        const rows = res.data.values || [];
        const raisons = rows
            .flat()
            .filter((v, i) => i > 0 && v && v.trim())
            .map(v => v.trim());

        cache.raisons = { data: [...new Set(raisons)], timestamp: Date.now() };
        return cache.raisons.data;
    } catch (error) {
        console.error('Erreur lors de la récupération des raisons:', error.message);
        return cache.raisons.data || [];
    }
}

async function getNames() {
    if (isCacheValid(cache.names)) return cache.names.data;

    try {
        const sheets = getSheets();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.googleSheetsId,
            range: 'Registre!K:K',
        });

        const names = (res.data.values || []).flat().filter(v => v && v.trim());
        cache.names = { data: names, timestamp: Date.now() };
        return cache.names.data;
    } catch (error) {
        console.error('Erreur récupération noms Registre:', error.message);
        return cache.names.data || [];
    }
}

async function getGroupes() {
    if (isCacheValid(cache.groupes)) return cache.groupes.data;

    try {
        const sheets = getSheets();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.googleSheetsId,
            range: 'Registre!I:I',
        });

        const rows = res.data.values || [];
        const groupes = rows
            .flat()
            .filter((v, i) => i > 0 && v && v.trim())
            .map(v => v.trim());

        cache.groupes = { data: [...new Set(groupes)], timestamp: Date.now() };
        return cache.groupes.data;
    } catch (error) {
        console.error('Erreur lors de la récupération des groupes:', error.message);
        return cache.groupes.data || [];
    }
}

async function getMemberName(displayName) {
    const names = await getNames();
    const lower = displayName.toLowerCase();
    const match = names.find(name => lower.includes(name.toLowerCase()));
    return match || displayName;
}

async function getRevenuSheetId() {
    if (cache.sheetId !== null) return cache.sheetId;

    const sheets = getSheets();
    const meta = await sheets.spreadsheets.get({
        spreadsheetId: config.googleSheetsId,
        fields: 'sheets(properties(sheetId,title))',
    });
    const revenuSheet = meta.data.sheets.find(s => s.properties.title === 'Revenu');
    cache.sheetId = revenuSheet.properties.sheetId;
    return cache.sheetId;
}

async function addArgentRow(displayName, raison, montant, groupe = 'Lost', info = '') {
    const sheets = getSheets();
    const memberName = await getMemberName(displayName);
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const revenu = montant > 0 ? montant : '';
    const depense = montant < 0 ? Math.abs(montant) : '';

    const row = [date, memberName, raison, groupe, revenu, depense, info];
    console.log('[Sheets] Ajout ligne:', row);

    const sheetId = await getRevenuSheetId();

    // Ajouter une ligne vide à la fin
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.googleSheetsId,
        requestBody: {
            requests: [{
                appendDimension: {
                    sheetId,
                    dimension: 'ROWS',
                    length: 1,
                },
            }],
        },
    });

    // Trouver la prochaine ligne vide en lisant B
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheetsId,
        range: 'Revenu!B:B',
    });
    const nextRow = (res.data.values ? res.data.values.length : 0) + 1;
    console.log(`[Sheets] Écriture ligne ${nextRow}`);

    await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetsId,
        range: `Revenu!A${nextRow}:G${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [row],
        },
    });
    console.log('[Sheets] Écriture réussie');
}

async function preloadCache() {
    console.log('[Sheets] Préchargement du cache...');
    await Promise.all([getRaisons(), getNames(), getGroupes(), getRevenuSheetId()]);
    console.log('[Sheets] Cache prêt');
}

module.exports = { getRaisons, getGroupes, addArgentRow, preloadCache };
