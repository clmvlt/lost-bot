const { google } = require("googleapis");
const config = require("./config");

let sheetsClient = null;

const cache = {
  raisons: { data: null, timestamp: 0 },
  names: { data: null, timestamp: 0 },
  groupes: { data: null, timestamp: 0 },
  emplacements: { data: null, timestamp: 0 },
  coffres: { data: null, timestamp: 0 },
  ammunitions: { data: null, timestamp: 0 },
  sheetId: null,
  fabricationSheetId: null,
  cambriolageSheetId: null,
  munitionsSheetId: null,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(entry) {
  return entry.data !== null && Date.now() - entry.timestamp < CACHE_TTL;
}

function getSheets() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: config.googleServiceAccountKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function getRaisons() {
  if (isCacheValid(cache.raisons)) return cache.raisons.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!G:G",
    });

    const rows = res.data.values || [];
    const raisons = rows
      .flat()
      .filter((v, i) => i > 0 && v && v.trim())
      .map((v) => v.trim());

    cache.raisons = { data: [...new Set(raisons)], timestamp: Date.now() };
    return cache.raisons.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des raisons:", error.message);
    return cache.raisons.data || [];
  }
}

async function getNames() {
  if (isCacheValid(cache.names)) return cache.names.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!K:K",
    });

    const names = (res.data.values || []).flat().filter((v) => v && v.trim());
    cache.names = { data: names, timestamp: Date.now() };
    return cache.names.data;
  } catch (error) {
    console.error("Erreur récupération noms Registre:", error.message);
    return cache.names.data || [];
  }
}

async function getGroupes() {
  if (isCacheValid(cache.groupes)) return cache.groupes.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!I:I",
    });

    const rows = res.data.values || [];
    const groupes = rows
      .flat()
      .filter((v, i) => i > 0 && v && v.trim())
      .map((v) => v.trim());

    cache.groupes = { data: [...new Set(groupes)], timestamp: Date.now() };
    return cache.groupes.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des groupes:", error.message);
    return cache.groupes.data || [];
  }
}

async function getEmplacements() {
  if (isCacheValid(cache.emplacements)) return cache.emplacements.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!E:E",
    });

    const rows = res.data.values || [];
    const emplacements = rows
      .flat()
      .filter((v, i) => i > 0 && v && v.trim())
      .map((v) => v.trim());

    cache.emplacements = {
      data: [...new Set(emplacements)],
      timestamp: Date.now(),
    };
    return cache.emplacements.data;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des emplacements:",
      error.message,
    );
    return cache.emplacements.data || [];
  }
}

async function getMemberName(displayName) {
  const names = await getNames();
  const lower = displayName.toLowerCase();
  const match = names.find((name) => lower.includes(name.toLowerCase()));
  return match || displayName;
}

async function getRevenuSheetId() {
  if (cache.sheetId !== null) return cache.sheetId;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId,
    fields: "sheets(properties(sheetId,title))",
  });
  const revenuSheet = meta.data.sheets.find(
    (s) => s.properties.title === "Revenu",
  );
  cache.sheetId = revenuSheet.properties.sheetId;
  return cache.sheetId;
}

async function addArgentRow(
  displayName,
  raison,
  montant,
  groupe = "Lost",
  info = "",
) {
  const sheets = getSheets();
  const memberName = await getMemberName(displayName);
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const revenu = montant > 0 ? montant : "";
  const depense = montant < 0 ? Math.abs(montant) : "";

  const row = [date, memberName, raison, groupe, revenu, depense, info];
  console.log("[Sheets] Ajout ligne:", row);

  const sheetId = await getRevenuSheetId();

  // Ajouter une ligne vide à la fin
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: "ROWS",
            length: 1,
          },
        },
      ],
    },
  });

  // Trouver la prochaine ligne vide en lisant B
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: "Revenu!B:B",
  });
  const nextRow = (res.data.values ? res.data.values.length : 0) + 1;
  console.log(`[Sheets] Écriture ligne ${nextRow}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Revenu!A${nextRow}:G${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
  console.log("[Sheets] Écriture réussie");
}

async function getCoffres() {
  if (isCacheValid(cache.coffres)) return cache.coffres.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!M:M",
    });

    const rows = res.data.values || [];
    console.log("[Sheets] Coffres brut M:M:", JSON.stringify(rows.slice(0, 5)));
    const coffres = rows
      .flat()
      .filter((v) => v && v.trim())
      .map((v) => v.trim());

    console.log("[Sheets] Coffres filtrés:", coffres);
    cache.coffres = { data: [...new Set(coffres)], timestamp: Date.now() };
    return cache.coffres.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des coffres:", error.message);
    return cache.coffres.data || [];
  }
}

async function getAmmunitions() {
  if (isCacheValid(cache.ammunitions)) return cache.ammunitions.data;

  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetsId,
      range: "Registre!O:O",
    });

    const rows = res.data.values || [];
    console.log("[Sheets] Ammunitions brut O:O:", JSON.stringify(rows.slice(0, 5)));
    const ammunitions = rows
      .flat()
      .filter((v) => v && v.trim())
      .map((v) => v.trim());

    console.log("[Sheets] Ammunitions filtrées:", ammunitions);
    cache.ammunitions = {
      data: [...new Set(ammunitions)],
      timestamp: Date.now(),
    };
    return cache.ammunitions.data;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des ammunitions:",
      error.message,
    );
    return cache.ammunitions.data || [];
  }
}

async function getMunitionsSheetId() {
  if (cache.munitionsSheetId !== null) return cache.munitionsSheetId;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId,
    fields: "sheets(properties(sheetId,title))",
  });
  const munSheet = meta.data.sheets.find(
    (s) => s.properties.title === "Munitions",
  );
  cache.munitionsSheetId = munSheet.properties.sheetId;
  return cache.munitionsSheetId;
}

async function addMunitionsRow(
  displayName,
  coffre,
  ammunition,
  montant,
  groupe = "Lost",
  info = "",
) {
  const sheets = getSheets();
  const memberName = await getMemberName(displayName);
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const ajout = montant > 0 ? montant : "";
  const retrait = montant < 0 ? Math.abs(montant) : "";

  const row = [date, memberName, coffre || "", ammunition || "", groupe, ajout, retrait, info];
  console.log("[Sheets] Ajout ligne Munitions:", row);

  const sheetId = await getMunitionsSheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: "ROWS",
            length: 1,
          },
        },
      ],
    },
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: "Munitions!B:B",
  });
  const nextRow = (res.data.values ? res.data.values.length : 0) + 1;
  console.log(`[Sheets] Écriture ligne Munitions ${nextRow}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Munitions!A${nextRow}:H${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
  console.log("[Sheets] Écriture Munitions réussie");
}

async function getFabricationSheetId() {
  if (cache.fabricationSheetId !== null) return cache.fabricationSheetId;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId,
    fields: "sheets(properties(sheetId,title))",
  });
  const fabSheet = meta.data.sheets.find(
    (s) => s.properties.title === "Pochon",
  );
  cache.fabricationSheetId = fabSheet.properties.sheetId;
  return cache.fabricationSheetId;
}

async function addFabriqueRow(
  displayNames,
  emplacement,
  montant,
  groupe = "Lost",
) {
  const sheets = getSheets();
  const names = Array.isArray(displayNames) ? displayNames : [displayNames];
  const resolvedNames = await Promise.all(names.map((n) => getMemberName(n)));
  const memberName = resolvedNames.join(", ");
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const ajout = montant > 0 ? montant : "";
  const retrait = montant < 0 ? Math.abs(montant) : "";

  const row = [date, memberName, emplacement, groupe, ajout, retrait];
  console.log("[Sheets] Ajout ligne Fabrication:", row);

  const sheetId = await getFabricationSheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: "ROWS",
            length: 1,
          },
        },
      ],
    },
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: "Pochon!B:B",
  });
  const nextRow = (res.data.values ? res.data.values.length : 0) + 1;
  console.log(`[Sheets] Écriture ligne Fabrication ${nextRow}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Pochon!A${nextRow}:F${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
  console.log("[Sheets] Écriture Fabrication réussie");
}

async function getCambriolageSheetId() {
  if (cache.cambriolageSheetId !== null) return cache.cambriolageSheetId;

  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId,
    fields: "sheets(properties(sheetId,title))",
  });
  const sheet = meta.data.sheets.find(
    (s) => s.properties.title === "Cambriolage",
  );
  cache.cambriolageSheetId = sheet.properties.sheetId;
  return cache.cambriolageSheetId;
}

async function addCambriolageRow(displayNames, quantities) {
  const sheets = getSheets();
  const names = Array.isArray(displayNames) ? displayNames : [displayNames];
  const resolvedNames = await Promise.all(names.map((n) => getMemberName(n)));
  const memberName = resolvedNames.join(", ");
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const objetKeys = [
    "ordinateur", "tableau", "sculpture", "television",
    "tablette", "console", "micro-ondes", "appareil-photo", "enceinte",
  ];
  const row = [date, memberName, ...objetKeys.map((k) => quantities[k] || "")];
  console.log("[Sheets] Ajout ligne Cambriolage:", row);

  const sheetId = await getCambriolageSheetId();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: "ROWS",
            length: 1,
          },
        },
      ],
    },
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: "Cambriolage!B:B",
  });
  const nextRow = (res.data.values ? res.data.values.length : 0) + 1;
  // S'assurer qu'on écrit au moins à la ligne 6 (première ligne de données)
  const writeRow = Math.max(nextRow, 6);
  console.log(`[Sheets] Écriture ligne Cambriolage ${writeRow}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `Cambriolage!A${writeRow}:K${writeRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
  console.log("[Sheets] Écriture Cambriolage réussie");
}

async function preloadCache() {
  console.log("[Sheets] Préchargement du cache...");
  await Promise.all([
    getRaisons(),
    getNames(),
    getGroupes(),
    getEmplacements(),
    getCoffres(),
    getAmmunitions(),
    getRevenuSheetId(),
  ]);
  console.log("[Sheets] Cache prêt");
}

module.exports = {
  getRaisons,
  getGroupes,
  getEmplacements,
  getCoffres,
  getAmmunitions,
  addArgentRow,
  addFabriqueRow,
  addCambriolageRow,
  addMunitionsRow,
  preloadCache,
};
