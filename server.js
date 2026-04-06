const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { createCanvas, loadImage, registerFont } = require('canvas');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Helper to reshape and reverse Arabic text for Canvas
const { ArabicShaper } = require('arabic-persian-reshaper');
function formatArabic(text) {
    if (!text) return "";
    return ArabicShaper.convertArabic(text);
}

// Font registration
const fontPathBold = path.join(__dirname, 'public/Amiri-Bold.ttf');
const fontPathRegular = path.join(__dirname, 'public/Amiri-Regular.ttf');
if (fs.existsSync(fontPathBold)) registerFont(fontPathBold, { family: 'Amiri', weight: 'bold' });
if (fs.existsSync(fontPathRegular)) registerFont(fontPathRegular, { family: 'Amiri', weight: 'normal' });

const app = express();
const PORT = 3001;

// Ensure directories exist before starting
const dirs = ['public/uploads', 'public/cards'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[INIT] Created directory: ${dir}`);
    }
});

app.use(cors());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.static('public'));

app.get('/ping', (req, res) => {
    res.send('pong');
});

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'public/uploads/'),
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    })
});

app.post('/generate-card', upload.single('photo'), async (req, res) => {
    try {
        const { name, job_title, job_number, dob, email, phone } = req.body;
        const photoPath = req.file ? req.file.path : null;

        if (!photoPath) return res.status(400).json({ error: 'Photo is required' });

        const qrData = JSON.stringify({ id: job_number, name: name, title: job_title, dob, email, phone });
        const qrCodeDataUrl = await QRCode.toDataURL(qrData);

        const width = 638;
        const height = 1011;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const titleLower = job_title ? job_title.trim() : '';
        const isStudent = titleLower.includes('طالب') || titleLower.includes('student');

        if (isStudent) {
            await drawStudentCard(ctx, width, height, name, job_title, job_number, qrCodeDataUrl, photoPath, dob, email, phone);
        } else {
            await drawEmployeeCard(ctx, width, height, name, job_title, job_number, qrCodeDataUrl, photoPath);
        }

        // Save PNG
        const outputFileName = `card-${Date.now()}-${job_number}`;
        const pngPath = path.join(__dirname, 'public/cards', `${outputFileName}.png`);
        const out = fs.createWriteStream(pngPath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        await new Promise((resolve) => out.on('finish', resolve));

        // Generate PDF
        const pdfPath = path.join(__dirname, 'public/cards', `${outputFileName}.pdf`);
        const doc = new PDFDocument({ size: [153.07, 242.64], margin: 0 });
        const pdfStream = fs.createWriteStream(pdfPath);
        doc.pipe(pdfStream);
        doc.image(pngPath, 0, 0, { width: 153.07, height: 242.64 });
        doc.end();
        await new Promise((resolve) => pdfStream.on('finish', resolve));

        res.json({ success: true, pngUrl: `/cards/${outputFileName}.png`, pdfUrl: `/cards/${outputFileName}.pdf` });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error while generating ID card.' });
    }
});

const server = app.listen(PORT, () => {
    console.log(`\n\x1b[32m[SUCCESS] ID Card Generator Server is Running!\x1b[0m`);
    console.log(`\x1b[36m[URL] http://localhost:${PORT}\x1b[0m\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[ERROR] Port ${PORT} is already in use.\x1b[0m`);
        console.log(`[TIP] Use 'lsof -i :${PORT}' and 'kill -9 <PID>' to clear it.`);
    } else {
        console.error('[ERROR] Server failure:', err.message);
    }
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==========================================
// EMPLOYEE CARD RENDERER (FLAT VECTOR DESIGN)
// ==========================================
async function drawEmployeeCard(ctx, width, height, name, job_title, job_number, qrCodeDataUrl, photoPath) {
    const navyColor = '#08172c';
    const blueColor = '#3163a3';

    ctx.clearRect(0, 0, width, height);

    // 1. Base Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Top Header Polygons
    // Navy Top Left
    ctx.fillStyle = navyColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(480, 0);
    ctx.lineTo(330, 150);
    ctx.lineTo(0, 150);
    ctx.closePath();
    ctx.fill();

    // Medium Blue Top Right
    ctx.fillStyle = blueColor;
    ctx.beginPath();
    ctx.moveTo(505, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, 100);
    ctx.lineTo(405, 100);
    ctx.closePath();
    ctx.fill();

    // Company Name inside Navy Polygon
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Amiri';
    ctx.fillText(formatArabic('شركة واصل'), 160, 80);

    // 3. User Photo (Square with subtle border)
    const pSize = 340;
    const pX = (width - pSize) / 2;
    const pY = 220;

    // Soft shadow for photo box
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(pX - 10, pY - 10, pSize + 20, pSize + 20);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw Photo
    const photo = await loadImage(photoPath);
    ctx.drawImage(photo, pX, pY, pSize, pSize);

    // 4. Name and Job Title
    const nameY = pY + pSize + 80;
    ctx.textAlign = 'center';
    
    // Name (Arabic or English)
    ctx.fillStyle = navyColor;
    ctx.font = 'bold 56px Amiri';
    const cleanName = /^[A-Za-z\s]+$/.test(name) ? name : formatArabic(name);
    ctx.fillText(cleanName, width / 2, nameY);

    // Job Title (Handling the split if "Arabic (English)" format is used)
    let arTitle = job_title;
    let enTitle = '';
    if (job_title.includes('(')) {
        const parts = job_title.split('(');
        arTitle = parts[0].trim();
        enTitle = parts[1].replace(')', '').trim().toUpperCase();
    }

    ctx.fillStyle = blueColor;
    ctx.font = 'bold 22px sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(enTitle || arTitle.toUpperCase(), width / 2, nameY + 45);
    ctx.letterSpacing = '0px';

    // 5. Details Section
    const startY = nameY + 120;
    const gap = 50;

    const details = [
        { label: formatArabic('الرقم الوظيفي'), value: job_number },
        { label: formatArabic('تاريخ الإصدار'), value: new Date().toLocaleDateString('ar-EG') },
        { label: formatArabic('فصيلة الدم'), value: 'O+' }, // Aesthetic placeholder
    ];

    details.forEach((d, index) => {
        const rowY = startY + (index * gap);
        
        // Label (Right aligned)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#666666';
        ctx.font = '22px Amiri';
        ctx.fillText(d.label, 450, rowY);
        
        // Colon
        ctx.textAlign = 'center';
        ctx.fillText(':', 320, rowY);

        // Value (Left aligned)
        ctx.textAlign = 'left';
        ctx.fillStyle = navyColor;
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(d.value, 180, rowY);
    });

    // 6. QR Code (Bottom Left)
    const qrSize = 140;
    const qrX = 60;
    const qrY = height - 190;
    
    // Draw QR Background
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 10;
    ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
    ctx.shadowBlur = 0;

    const qrImage = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // 7. Bottom Footer Polygons
    // Navy Bottom Right
    ctx.fillStyle = navyColor;
    ctx.beginPath();
    ctx.moveTo(width, height);
    ctx.lineTo(150, height);
    ctx.lineTo(300, height - 150);
    ctx.lineTo(width, height - 150);
    ctx.closePath();
    ctx.fill();

    // Medium Blue Bottom Left
    ctx.fillStyle = blueColor;
    ctx.beginPath();
    ctx.moveTo(125, height);
    ctx.lineTo(0, height);
    ctx.lineTo(0, height - 100);
    ctx.lineTo(225, height - 100);
    ctx.closePath();
    ctx.fill();
    
    // "Employee Card" text in footer
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Amiri';
    ctx.fillText(formatArabic('بطاقة موظف'), width - 40, height - 40);
}

// ==========================================
// STUDENT CARD RENDERER – "GOLDEN SUN" DESIGN
// ==========================================
async function drawStudentCard(ctx, width, height, name, job_title, job_number, qrCodeDataUrl, photoPath, dob, email, phone) {
    const navy   = '#0f2b4c';
    const orange = '#f5a623';
    const white  = '#ffffff';

    ctx.clearRect(0, 0, width, height);

    // 1. CARD BACKGROUND (rounded navy)
    const R = 30;
    roundRect(ctx, 0, 0, width, height, R);
    ctx.fillStyle = navy;
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, width, height, R);
    ctx.clip();

    // 2. ORANGE DIAGONAL
    ctx.fillStyle = orange;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, 100);
    ctx.lineTo(0, 420);
    ctx.closePath();
    ctx.fill();

    // 3. HEADER — Sun icon + GOLDEN SUN
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.arc(185, 55, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = white;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(185 + Math.cos(a) * 18, 55 + Math.sin(a) * 18);
        ctx.lineTo(185 + Math.cos(a) * 25, 55 + Math.sin(a) * 25);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(185, 44, 10, Math.PI, 2 * Math.PI);
    ctx.stroke();
    for (let dx of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.arc(185 + dx, 36, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = white;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('GOLDEN SUN', 215, 68);

    // 4. CIRCULAR PHOTO (smaller, centered)
    const pR = 100;
    const pX = width / 2;
    const pY = 240;

    // Navy swoosh behind photo (right side)
    ctx.save();
    ctx.strokeStyle = navy;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(pX + 8, pY + 5, pR + 45, -0.35 * Math.PI, 0.55 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // Orange partial arc (left side)
    ctx.save();
    ctx.strokeStyle = orange;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pX, pY, pR + 25, 0.65 * Math.PI, 1.05 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // White ring
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.arc(pX, pY, pR + 8, 0, Math.PI * 2);
    ctx.fill();

    // Navy inner ring
    ctx.strokeStyle = navy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pX, pY, pR + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
    ctx.clip();
    const photo = await loadImage(photoPath);
    ctx.drawImage(photo, pX - pR, pY - pR, pR * 2, pR * 2);
    ctx.restore();

    // 5. NAME (bold, centered)
    const nameY = 400;
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = 'bold 42px Amiri';
    const displayName = /^[A-Za-z\s]+$/.test(name) ? name : formatArabic(name);
    ctx.fillText(displayName, width / 2, nameY);

    // 6. TITLE (orange italic)
    ctx.fillStyle = orange;
    ctx.font = 'italic bold 28px Amiri';
    const displayTitle = /^[A-Za-z\s]+$/.test(job_title || '') ? (job_title || 'Student') : formatArabic(job_title || 'طالب');
    ctx.fillText(displayTitle, width / 2, nameY + 50);

    // 7. DETAILS — 4 rows, properly spaced
    // Layout: Label (right-aligned) : Value (left-aligned)
    const startY = nameY + 120;
    const gap = 45;
    const labelCol = width - 60;   // right edge for Arabic labels
    const colonCol = width - 190;  // colon position
    const valueCol = colonCol - 20; // values right of colon going left... actually left-aligned

    const details = [
        { label: formatArabic('الرقم الجامعي'),    value: job_number || '0000000000' },
        { label: formatArabic('تاريخ الميلاد'),     value: dob || '01 - 01 - 2000' },
        { label: formatArabic('البريد الإلكتروني'), value: email || 'student@mail.com' },
        { label: formatArabic('الهاتف'),            value: phone || '+966 5XX XXX XXX' }
    ];

    details.forEach((d, i) => {
        const rowY = startY + (i * gap);

        // Arabic label — right aligned
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = 'bold 22px Amiri';
        ctx.fillText(d.label, labelCol, rowY);

        // Colon
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '22px sans-serif';
        ctx.fillText(':', colonCol, rowY);

        // Value — left aligned (to the LEFT of the colon for RTL feel)
        ctx.textAlign = 'right';
        ctx.fillStyle = white;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(d.value, colonCol - 20, rowY);
    });

    // 8. QR CODE — centered, BELOW details
    const qrSize = 130;
    const qrX = (width - qrSize) / 2;
    const qrY = startY + (details.length * gap) + 25;

    // Orange frame
    ctx.fillStyle = orange;
    roundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 8);
    ctx.fill();

    // White inner
    ctx.fillStyle = white;
    roundRect(ctx, qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 4);
    ctx.fill();

    // QR image
    const qrImage = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // 9. ORANGE STRIPE — below QR
    const stripeY = qrY + qrSize + 20;
    ctx.fillStyle = orange;
    ctx.fillRect(0, stripeY, width, 6);

    // 10. FOOTER
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '14px Amiri';
    ctx.fillText(formatArabic('بطاقة طالب'), width / 2, height - 15);

    ctx.restore();
}

// Helpers
function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (let side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

function hexToRgbA(hex, alpha) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return `rgba(255, 255, 255, ${alpha})`;
}
