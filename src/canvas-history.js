const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getRandomImage } = require('./utils');
const { getName, getAvatar } = require('./member-cache');

const W = 900;
const HISTORY_PER_PAGE = 10;

const COLORS = {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    white: '#FFFFFF',
    dim: 'rgba(255,255,255,0.5)',
    present: '#57F287',
    late: '#5865F2',
    absent: '#ED4245',
    noResponse: '#99AAB5',
    card: 'rgba(0,0,0,0.4)',
    cardAlt: 'rgba(0,0,0,0.25)',
};

function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

function drawCircleAvatar(ctx, img, cx, cy, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
}

async function createBg(width, height) {
    const img = await loadImage(getRandomImage());
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const ir = img.width / img.height, cr = width / height;
    let sx, sy, sw, sh;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }

    ctx.filter = 'blur(20px)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    ctx.filter = 'none';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, width, height);

    return { canvas, ctx };
}

async function fetchMember(guild, userId) {
    const name = getName(userId);
    const avatar = getAvatar(userId);
    if (name) return { name, avatar };
    try {
        const member = await guild.members.fetch(userId);
        const img = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 64 })).catch(() => null);
        return { name: member.displayName, avatar: img };
    } catch {
        return { name: 'Ancien membre', avatar: null };
    }
}

function drawDot(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function measureStatsWidth(ctx, s, size) {
    const dotR = size * 0.3;
    const vals = [s.present, s.late, s.absent, s.noResponse];
    ctx.font = `${size}px Arial, sans-serif`;
    let w = 0;
    for (const val of vals) {
        w += dotR * 2 + 5 + ctx.measureText(val.toString()).width + 14;
    }
    ctx.font = `bold ${size}px Arial, sans-serif`;
    w += ctx.measureText('|').width + 10 + ctx.measureText(`${Math.round(s.rate)}%`).width;
    return w;
}

function drawStats(ctx, s, x, y, size = 18) {
    const dotR = size * 0.3;
    const stats = [
        { val: s.present, col: COLORS.present },
        { val: s.late, col: COLORS.late },
        { val: s.absent, col: COLORS.absent },
        { val: s.noResponse, col: COLORS.noResponse },
    ];

    ctx.font = `${size}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let cx = x;
    for (const { val, col } of stats) {
        drawDot(ctx, cx + dotR, y, dotR, col);
        cx += dotR * 2 + 5;
        ctx.fillStyle = COLORS.white;
        ctx.fillText(val.toString(), cx, y);
        cx += ctx.measureText(val.toString()).width + 14;
    }

    ctx.font = `bold ${size}px Arial, sans-serif`;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('|', cx, y);
    cx += ctx.measureText('|').width + 10;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`${Math.round(s.rate)}%`, cx, y);
}

function drawStatsRight(ctx, s, rightX, y, size) {
    const w = measureStatsWidth(ctx, s, size);
    drawStats(ctx, s, rightX - w, y, size);
}

async function renderHistory(sorted, page, guild, callerId = null) {
    const hasSecond = sorted.length >= 2;
    const hasThird = sorted.length >= 3;

    const podiumH = hasSecond ? 300 : 180;

    const rest = sorted.slice(3);
    const totalPages = Math.max(1, Math.ceil(rest.length / HISTORY_PER_PAGE));
    const currentPage = Math.min(page, totalPages - 1);
    const pageItems = rest.slice(currentPage * HISTORY_PER_PAGE, (currentPage + 1) * HISTORY_PER_PAGE);

    const callerIndex = callerId ? sorted.findIndex(s => s.userId === callerId) : -1;
    const callerEntry = callerIndex >= 0 ? sorted[callerIndex] : null;

    const rowH = 48;
    const listHeaderH = 50;
    const listH = pageItems.length > 0 ? listHeaderH + pageItems.length * rowH : 0;
    const callerH = callerEntry ? 70 : 0;
    const footerH = 35;

    const totalH = podiumH + listH + callerH + footerH;

    const { canvas, ctx } = await createBg(W, totalH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText('P O D I U M', W / 2, 35);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(250, 58);
    ctx.lineTo(650, 58);
    ctx.stroke();

    if (sorted[0]) {
        const { name, avatar } = await fetchMember(guild, sorted[0].userId);
        const cardY = 75;
        const avatarR = 30;
        roundRect(ctx, 150, cardY, 600, 90, 12, COLORS.card);
        roundRect(ctx, 150, cardY, 5, 90, 2, COLORS.gold);

        const avX = 195;
        const avY = cardY + 45;
        if (avatar) drawCircleAvatar(ctx, avatar, avX, avY, avatarR);
        else drawDot(ctx, avX, avY, avatarR, 'rgba(255,255,255,0.15)');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.gold;
        ctx.font = 'bold 26px Arial, sans-serif';
        ctx.fillText('#1', avX + avatarR + 15, cardY + 30);

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText(name, avX + avatarR + 60, cardY + 30);

        drawStats(ctx, sorted[0], avX + avatarR + 15, cardY + 65, 18);
    }

    if (hasSecond) {
        const { name, avatar } = await fetchMember(guild, sorted[1].userId);
        const cardY = 185;
        const avatarR = 22;
        roundRect(ctx, 30, cardY, 410, 85, 12, COLORS.card);
        roundRect(ctx, 30, cardY, 5, 85, 2, COLORS.silver);

        const avX = 65;
        const avY = cardY + 30;
        if (avatar) drawCircleAvatar(ctx, avatar, avX, avY, avatarR);
        else drawDot(ctx, avX, avY, avatarR, 'rgba(255,255,255,0.15)');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.silver;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText('#2', avX + avatarR + 12, cardY + 28);

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(name, avX + avatarR + 52, cardY + 28);

        drawStats(ctx, sorted[1], avX + avatarR + 12, cardY + 60, 16);
    }

    if (hasThird) {
        const { name, avatar } = await fetchMember(guild, sorted[2].userId);
        const cardY = 185;
        const avatarR = 22;
        roundRect(ctx, 460, cardY, 410, 85, 12, COLORS.card);
        roundRect(ctx, 460, cardY, 5, 85, 2, COLORS.bronze);

        const avX = 495;
        const avY = cardY + 30;
        if (avatar) drawCircleAvatar(ctx, avatar, avX, avY, avatarR);
        else drawDot(ctx, avX, avY, avatarR, 'rgba(255,255,255,0.15)');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.bronze;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText('#3', avX + avatarR + 12, cardY + 28);

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(name, avX + avatarR + 52, cardY + 28);

        drawStats(ctx, sorted[2], avX + avatarR + 12, cardY + 60, 16);
    }

    if (pageItems.length > 0) {
        const listY = podiumH;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, listY);
        ctx.lineTo(W - 40, listY);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText('C L A S S E M E N T', W / 2, listY + 28);

        for (let i = 0; i < pageItems.length; i++) {
            const s = pageItems[i];
            const rank = currentPage * HISTORY_PER_PAGE + i + 4;
            const y = listY + listHeaderH + i * rowH;

            roundRect(ctx, 20, y, W - 40, rowH - 4, 8, i % 2 === 0 ? COLORS.card : COLORS.cardAlt);

            const { name, avatar } = await fetchMember(guild, s.userId);
            const centerY = y + (rowH - 4) / 2;
            const avatarR = 16;

            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.dim;
            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.fillText(`${rank}.`, 60, centerY);

            const avX = 60 + 10 + avatarR;
            if (avatar) drawCircleAvatar(ctx, avatar, avX, centerY, avatarR);
            else drawDot(ctx, avX, centerY, avatarR, 'rgba(255,255,255,0.15)');

            ctx.textAlign = 'left';
            ctx.fillStyle = COLORS.white;
            ctx.font = '18px Arial, sans-serif';
            const truncName = name.length > 28 ? name.slice(0, 26) + '..' : name;
            ctx.fillText(truncName, avX + avatarR + 10, centerY);

            drawStatsRight(ctx, s, W - 35, centerY, 16);
        }
    }

    if (callerEntry) {
        const yourY = podiumH + listH;
        const barY = yourY + 15;
        const barH = 44;

        ctx.strokeStyle = 'rgba(88, 101, 242, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, yourY + 5);
        ctx.lineTo(W - 40, yourY + 5);
        ctx.stroke();

        roundRect(ctx, 20, barY, W - 40, barH, 8, 'rgba(88, 101, 242, 0.25)');
        roundRect(ctx, 20, barY, 5, barH, 2, '#5865F2');

        const centerY = barY + barH / 2;
        const { name, avatar } = await fetchMember(guild, callerEntry.userId);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#5865F2';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillText('VOUS', 40, centerY - 1);

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillText(`#${callerIndex + 1}`, 90, centerY);

        const avatarR = 16;
        const avX = 140 + avatarR;
        if (avatar) drawCircleAvatar(ctx, avatar, avX, centerY, avatarR);
        else drawDot(ctx, avX, centerY, avatarR, 'rgba(255,255,255,0.15)');

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 18px Arial, sans-serif';
        const truncName = name.length > 28 ? name.slice(0, 26) + '..' : name;
        ctx.fillText(truncName, avX + avatarR + 10, centerY);

        drawStatsRight(ctx, callerEntry, W - 35, centerY, 16);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '13px Arial, sans-serif';
    const footerText = totalPages > 1
        ? `Classement par score  •  Page ${currentPage + 1} / ${totalPages}`
        : 'Classement par score de presence';
    ctx.fillText(footerText, W / 2, totalH - 15);

    return { buffer: canvas.toBuffer('image/png'), currentPage, totalPages };
}

module.exports = { renderHistory, HISTORY_PER_PAGE };
