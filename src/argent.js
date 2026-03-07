const {
  EmbedBuilder,
  MessageFlags,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const config = require("./config");
const {
  loadArgent,
  saveArgent,
  loadBraquages,
  saveBraquages,
} = require("./data");
const {
  getWeekBounds,
  parseDateFR,
  formatDateFR,
  formatMoney,
  hasLostRole,
} = require("./utils");
const { renderRanking, PER_PAGE } = require("./canvas-ranking");
const { getRaisons, getGroupes, addArgentRow } = require("./sheets");
const {
  findAvailableSlot,
  sendOrUpdateBraquagesMessage,
} = require("./braquages");

const BRAQUAGE_RAISONS = { Superette: "sup", Ammunation: "ammu" };

function checkLostRole(interaction) {
  if (!hasLostRole(interaction, config.roles.lost)) {
    interaction.reply({
      content: "❌ Vous devez avoir le rôle Lost pour utiliser cette commande.",
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

function parseWeekDate(interaction) {
  const dateStr = interaction.options.getString("date");
  if (!dateStr) return new Date();
  const parsed = parseDateFR(dateStr);
  if (!parsed) {
    interaction.reply({
      content: "❌ Format de date invalide. Utilisez JJ/MM/AAAA.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return parsed;
}

function formatEntryLine(entry, includeYear = true) {
  const options = includeYear
    ? { day: "2-digit", month: "2-digit", year: "numeric" }
    : { day: "2-digit", month: "2-digit" };
  return `${formatDateFR(entry.date, options)} | ${formatMoney(entry.montant)} | ${entry.activite}`;
}

function buildWeekResults(argentData, start, end) {
  const results = [];
  for (const [userId, entries] of Object.entries(argentData)) {
    const weekEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    if (weekEntries.length > 0) {
      const total = weekEntries.reduce((sum, e) => sum + e.montant, 0);
      results.push({ userId, total, count: weekEntries.length });
    }
  }
  return results.sort((a, b) => b.total - a.total);
}

function buildRankingLines(results) {
  return results.map(
    (r, i) =>
      `${i + 1}. <@${r.userId}> - **${formatMoney(r.total)}** (${r.count} entrée(s))`,
  );
}

async function handleArgentAutocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused(true);

    if (focused.name === "raison" && focused.value.length < 1) {
      return await interaction.respond([
        {
          name: "Écrivez au moins 1 lettres pour voir les raisons",
          value: "__placeholder__",
        },
      ]);
    }

    let choices = [];
    if (focused.name === "raison") {
      choices = await getRaisons();
    } else if (focused.name === "groupe") {
      choices = await getGroupes();
    }

    const filtered = choices
      .filter((c) => c.toLowerCase().includes(focused.value.toLowerCase()))
      .slice(0, 25)
      .map((c) => ({ name: c, value: c }));
    await interaction.respond(filtered);
  } catch (error) {
    console.error("Erreur autocomplete argent:", error.message);
    await interaction.respond([]);
  }
}

async function handleArgent(interaction, client) {
  if (!checkLostRole(interaction)) return;

  const montant = interaction.options.getNumber("montant");
  const raison = interaction.options.getString("raison");
  const groupe = interaction.options.getString("groupe") || "Lost";
  const info = interaction.options.getString("info") || "";
  const userId = interaction.user.id;
  const displayName =
    interaction.member?.displayName || interaction.user.username;

  // Validation des champs autocomplete
  const validRaisons = await getRaisons();
  if (!validRaisons.some((r) => r.toLowerCase() === raison.toLowerCase())) {
    await interaction.reply({
      content: "❌ Raison invalide. Veuillez choisir parmi les suggestions.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const groupeInput = interaction.options.getString("groupe");
  if (groupeInput) {
    const validGroupes = await getGroupes();
    if (
      !validGroupes.some((g) => g.toLowerCase() === groupeInput.toLowerCase())
    ) {
      await interaction.reply({
        content: "❌ Groupe invalide. Veuillez choisir parmi les suggestions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  await interaction.deferReply();

  const argentData = loadArgent();
  if (!argentData[userId]) argentData[userId] = [];
  argentData[userId].push({
    montant,
    activite: raison,
    date: new Date().toISOString(),
  });
  saveArgent(argentData);

  let sheetsSaved = true;
  try {
    await addArgentRow(displayName, raison, montant, groupe, info);
  } catch (error) {
    sheetsSaved = false;
    console.error("Erreur ajout Google Sheets:", error.message);
  }

  const fields = [
    { name: "Montant", value: formatMoney(montant), inline: true },
    { name: "Activité", value: raison, inline: true },
  ];
  if (info) fields.push({ name: "Info", value: info, inline: true });

  // Si la raison est Superette ou Ammunation, réserver aussi un slot de braquage
  const braquageType = BRAQUAGE_RAISONS[raison];
  if (braquageType) {
    const withUsers = interaction.options.getString("with");
    const heure = interaction.options.getString("heure");

    const braquageData = loadBraquages();
    const slotKey = findAvailableSlot(braquageData, braquageType);

    if (slotKey) {
      const membres = [userId];
      if (withUsers) {
        const mentions = withUsers.match(/<@!?(\d+)>/g) || [];
        for (const mention of mentions) {
          const mentionId = mention.replace(/<@!?(\d+)>/, "$1");
          if (!membres.includes(mentionId)) membres.push(mentionId);
        }
      }

      const now = new Date();
      const heureValue =
        heure ||
        now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        });

      braquageData[slotKey] = {
        date: formatDateFR(now),
        heure: heureValue,
        membre: membres,
      };
      saveBraquages(braquageData);

      try {
        const channel = await client.channels.fetch(config.braquagesChannelId);
        if (channel) await sendOrUpdateBraquagesMessage(channel);
      } catch (error) {
        console.error("Erreur mise à jour message braquages:", error);
      }

      const typeName = braquageType === "sup" ? "Superette" : "Ammu";
      const slotNum = slotKey.slice(-1);
      fields.push({
        name: "Braquage",
        value: `✅ ${typeName} ${slotNum} réservée!`,
        inline: false,
      });
    } else {
      const typeName = braquageType === "sup" ? "Superette" : "Ammu";
      fields.push({
        name: "Braquage",
        value: `❌ Les 2 ${typeName}s sont déjà réservées!`,
        inline: false,
      });
    }
  }

  const embed = new EmbedBuilder()
    .addFields(fields)
    .setColor(montant >= 0 ? 0x57f287 : 0xed4245);

  await interaction.editReply({ embeds: [embed] });

  if (sheetsSaved) {
    try {
      const reply = await interaction.fetchReply();
      await reply.react("✅");
    } catch (error) {
      console.error("Erreur ajout réaction:", error.message);
    }
  }
}

async function handleArgentTotal(interaction) {
  if (!checkLostRole(interaction)) return;

  const targetUser = interaction.options.getUser("membre") || interaction.user;
  const argentData = loadArgent();
  const entries = argentData[targetUser.id] || [];
  const total = entries.reduce((sum, e) => sum + e.montant, 0);

  const lines = entries
    .slice(-15)
    .reverse()
    .map((e) => formatEntryLine(e));

  const embed = new EmbedBuilder()
    .setTitle(`💰 Total de ${targetUser.username}`)
    .addFields(
      {
        name: "Total cumulé",
        value: `**${formatMoney(total)}**`,
        inline: false,
      },
      {
        name: `Dernières entrées (${entries.length} au total)`,
        value: lines.length > 0 ? lines.join("\n") : "Aucune entrée",
        inline: false,
      },
    )
    .setColor(total >= 0 ? 0x57f287 : 0xed4245)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleArgentSemaine(interaction) {
  if (!checkLostRole(interaction)) return;

  const refDate = parseWeekDate(interaction);
  if (!refDate) return;

  const targetUser = interaction.options.getUser("membre");
  const { start, end } = getWeekBounds(refDate);
  const startStr = formatDateFR(start);
  const endStr = formatDateFR(end);
  const argentData = loadArgent();

  if (targetUser) {
    const entries = (argentData[targetUser.id] || []).filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    const total = entries.reduce((sum, e) => sum + e.montant, 0);
    const lines = entries.map((e) => formatEntryLine(e, false));

    const embed = new EmbedBuilder()
      .setTitle(`💰 Semaine de ${targetUser.username}`)
      .setDescription(`Du ${startStr} au ${endStr}`)
      .addFields(
        {
          name: "Total semaine",
          value: `**${formatMoney(total)}**`,
          inline: false,
        },
        {
          name: `Détail (${entries.length} entrée(s))`,
          value:
            lines.length > 0 ? lines.join("\n") : "Aucune entrée cette semaine",
          inline: false,
        },
      )
      .setColor(total >= 0 ? 0x57f287 : 0xed4245)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const results = buildWeekResults(argentData, start, end);

  if (results.length === 0) {
    await interaction.reply({
      content: "Aucune entrée cette semaine.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const sorted = results.map((r) => ({
    userId: r.userId,
    value: formatMoney(r.total),
    subtitle: `${r.count} entrée(s)`,
  }));

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    0,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: `Semaine du ${startStr} au ${endStr}`,
      subtitle: `Du ${startStr} au ${endStr}`,
    },
  );

  const file = new AttachmentBuilder(buffer, { name: "argent-semaine.png" });
  const row = buildPageButtons("argent_semaine", currentPage, totalPages);
  await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

async function handleArgentTop(interaction) {
  if (!checkLostRole(interaction)) return;

  const argentData = loadArgent();
  const results = Object.entries(argentData)
    .map(([userId, entries]) => ({
      userId,
      total: entries.reduce((sum, e) => sum + e.montant, 0),
      count: entries.length,
    }))
    .sort((a, b) => b.total - a.total);

  if (results.length === 0) {
    await interaction.reply({
      content: "Aucune entrée enregistrée.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const sorted = results.map((r) => ({
    userId: r.userId,
    value: formatMoney(r.total),
    subtitle: `${r.count} entrée(s)`,
  }));

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    0,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: "Classement global",
    },
  );

  const file = new AttachmentBuilder(buffer, { name: "argent-top.png" });
  const row = buildPageButtons("argent_top", currentPage, totalPages);
  await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

async function handleArgentTopSemaine(interaction) {
  if (!checkLostRole(interaction)) return;

  const refDate = parseWeekDate(interaction);
  if (!refDate) return;

  const { start, end } = getWeekBounds(refDate);
  const startStr = formatDateFR(start);
  const endStr = formatDateFR(end);

  const argentData = loadArgent();
  const results = buildWeekResults(argentData, start, end);

  if (results.length === 0) {
    await interaction.reply({
      content: "Aucune entrée cette semaine.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const sorted = results.map((r) => ({
    userId: r.userId,
    value: formatMoney(r.total),
    subtitle: `${r.count} entrée(s)`,
  }));

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    0,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: `Semaine du ${startStr} au ${endStr}`,
      subtitle: `Du ${startStr} au ${endStr}`,
    },
  );

  const file = new AttachmentBuilder(buffer, {
    name: "argent-top-semaine.png",
  });
  const row = buildPageButtons("argent_topsemaine", currentPage, totalPages);
  await interaction.editReply({ files: [file], components: row ? [row] : [] });
}

function buildPageButtons(prefix, currentPage, totalPages) {
  if (totalPages <= 1) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}_page_${currentPage - 1}`)
      .setLabel("Precedent")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}_page_${currentPage + 1}`)
      .setLabel("Suivant")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
  );
}

function buildArgentTopSorted(argentData) {
  return Object.entries(argentData)
    .map(([userId, entries]) => ({
      userId,
      value: formatMoney(entries.reduce((sum, e) => sum + e.montant, 0)),
      subtitle: `${entries.length} entrée(s)`,
      total: entries.reduce((sum, e) => sum + e.montant, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

function buildArgentWeekSorted(argentData, start, end) {
  const results = buildWeekResults(argentData, start, end);
  return results.map((r) => ({
    userId: r.userId,
    value: formatMoney(r.total),
    subtitle: `${r.count} entrée(s)`,
  }));
}

async function handleArgentTopPage(interaction) {
  const page = parseInt(interaction.customId.split("_").pop());
  await interaction.deferUpdate();

  const argentData = loadArgent();
  const sorted = buildArgentTopSorted(argentData);
  if (sorted.length === 0) return;

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    page,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: "Classement global",
    },
  );

  const file = new AttachmentBuilder(buffer, { name: "argent-top.png" });
  const row = buildPageButtons("argent_top", currentPage, totalPages);
  await interaction.editReply({
    files: [file],
    components: row ? [row] : [],
    embeds: [],
    content: null,
  });
}

async function handleArgentSemainePage(interaction) {
  const page = parseInt(interaction.customId.split("_").pop());
  await interaction.deferUpdate();

  const argentData = loadArgent();
  const refDate = new Date();
  const { start, end } = getWeekBounds(refDate);
  const startStr = formatDateFR(start);
  const endStr = formatDateFR(end);
  const sorted = buildArgentWeekSorted(argentData, start, end);
  if (sorted.length === 0) return;

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    page,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: `Semaine du ${startStr} au ${endStr}`,
      subtitle: `Du ${startStr} au ${endStr}`,
    },
  );

  const file = new AttachmentBuilder(buffer, { name: "argent-semaine.png" });
  const row = buildPageButtons("argent_semaine", currentPage, totalPages);
  await interaction.editReply({
    files: [file],
    components: row ? [row] : [],
    embeds: [],
    content: null,
  });
}

async function handleArgentTopSemainePage(interaction) {
  const page = parseInt(interaction.customId.split("_").pop());
  await interaction.deferUpdate();

  const argentData = loadArgent();
  const refDate = new Date();
  const { start, end } = getWeekBounds(refDate);
  const startStr = formatDateFR(start);
  const endStr = formatDateFR(end);
  const sorted = buildArgentWeekSorted(argentData, start, end);
  if (sorted.length === 0) return;

  const { buffer, currentPage, totalPages } = await renderRanking(
    sorted,
    page,
    interaction.guild,
    interaction.user.id,
    {
      title: "A R G E N T",
      titleColor: "#57F287",
      accentColor: "#57F287",
      footerLabel: `Semaine du ${startStr} au ${endStr}`,
      subtitle: `Du ${startStr} au ${endStr}`,
    },
  );

  const file = new AttachmentBuilder(buffer, {
    name: "argent-top-semaine.png",
  });
  const row = buildPageButtons("argent_topsemaine", currentPage, totalPages);
  await interaction.editReply({
    files: [file],
    components: row ? [row] : [],
    embeds: [],
    content: null,
  });
}

async function handleArgentHistorique(interaction) {
  if (!checkLostRole(interaction)) return;

  const targetUser = interaction.options.getUser("membre") || interaction.user;
  const argentData = loadArgent();
  const entries = argentData[targetUser.id] || [];

  if (entries.length === 0) {
    await interaction.reply({
      content: `❌ Aucune entrée pour ${targetUser.username}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const total = entries.reduce((sum, e) => sum + e.montant, 0);
  const lines = entries
    .slice()
    .reverse()
    .slice(0, 25)
    .map((e) => formatEntryLine(e));
  if (entries.length > 25)
    lines.push(`... et ${entries.length - 25} autres entrées`);

  const embed = new EmbedBuilder()
    .setTitle(`💰 Historique de ${targetUser.username}`)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Total cumulé",
        value: `**${formatMoney(total)}**`,
        inline: true,
      },
      { name: "Nombre d'entrées", value: `${entries.length}`, inline: true },
    )
    .setColor(total >= 0 ? 0x57f287 : 0xed4245)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

module.exports = {
  handleArgent,
  handleArgentAutocomplete,
  handleArgentTotal,
  handleArgentSemaine,
  handleArgentTop,
  handleArgentTopSemaine,
  handleArgentHistorique,
  handleArgentTopPage,
  handleArgentSemainePage,
  handleArgentTopSemainePage,
};
