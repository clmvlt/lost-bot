const fs = require('fs');
const path = require('path');

const PRESENCE_FILE = path.join(__dirname, '..', 'presence.json');
const HISTORY_FILE = path.join(__dirname, '..', 'history.json');
const ARGENT_FILE = path.join(__dirname, '..', 'argent.json');
const BRAQUAGES_FILE = path.join(__dirname, '..', 'braquages.json');
const FABRICATION_FILE = path.join(__dirname, '..', 'fabrication.json');

const DEFAULT_PRESENCE = { presents: [], absents: [], lates: [], noResponses: [], messageId: null };
const DEFAULT_USER_HISTORY = { present: 0, absent: 0, late: 0, noResponse: 0 };
const DEFAULT_SLOT = { date: null, heure: null, membre: null };
const DEFAULT_BRAQUAGES = {
    sup1: { ...DEFAULT_SLOT },
    sup2: { ...DEFAULT_SLOT },
    ammu1: { ...DEFAULT_SLOT },
    ammu2: { ...DEFAULT_SLOT },
    messageId: null,
};

function loadJSON(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Erreur lecture ${path.basename(filePath)}:`, error);
    }
    return typeof defaultValue === 'function' ? defaultValue() : structuredClone(defaultValue);
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function initData() {
    const files = [
        { path: PRESENCE_FILE, defaultValue: DEFAULT_PRESENCE },
        { path: HISTORY_FILE, defaultValue: {} },
        { path: ARGENT_FILE, defaultValue: {} },
        { path: BRAQUAGES_FILE, defaultValue: DEFAULT_BRAQUAGES },
        { path: FABRICATION_FILE, defaultValue: [] },
    ];
    for (const { path: filePath, defaultValue } of files) {
        if (!fs.existsSync(filePath)) {
            saveJSON(filePath, structuredClone(defaultValue));
            console.log(`${path.basename(filePath)} initialisé.`);
        }
    }
}

module.exports = {
    initData,
    loadPresence: () => loadJSON(PRESENCE_FILE, DEFAULT_PRESENCE),
    savePresence: (data) => saveJSON(PRESENCE_FILE, data),
    loadHistory: () => loadJSON(HISTORY_FILE, {}),
    saveHistory: (data) => saveJSON(HISTORY_FILE, data),
    loadArgent: () => loadJSON(ARGENT_FILE, {}),
    saveArgent: (data) => saveJSON(ARGENT_FILE, data),
    loadBraquages: () => loadJSON(BRAQUAGES_FILE, DEFAULT_BRAQUAGES),
    saveBraquages: (data) => saveJSON(BRAQUAGES_FILE, data),
    loadFabrication: () => loadJSON(FABRICATION_FILE, []),
    saveFabrication: (data) => saveJSON(FABRICATION_FILE, data),
    DEFAULT_USER_HISTORY,
    DEFAULT_BRAQUAGES,
};
