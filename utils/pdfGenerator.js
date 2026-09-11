const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const drawBox = (doc, x, y, width, height, title) => {
    // Background for header
    doc.fillColor('#f8f9fa').rect(x, y, width, 20).fill();
    doc.rect(x, y, width, height).strokeColor('#333333').stroke();

    // Title
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text((title || '').toUpperCase(), x + 5, y + 5);

    // Reset
    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    return y + 25; // Return content start Y
};

const drawBarcode = (doc, x, y, text, scale = 1.0, height = 35) => {
    const patterns = [
        "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
        "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
        "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
        "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
        "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
        "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
        "314111", "221411", "431111", "111124", "111422", "121124", "121421", "141122", "141221", "112214",
        "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
        "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
        "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
        "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
    ];

    let currentX = x;
    let totalWidth = 0;
    doc.fillColor('#000000');

    // Start B
    const startPattern = patterns[104];
    for (let i = 0; i < startPattern.length; i++) {
        const w = parseInt(startPattern[i]) * scale;
        if (i % 2 === 0) doc.rect(currentX, y, w, height).fill();
        currentX += w;
        totalWidth += w;
    }

    let checksum = 104;
    for (let i = 0; i < text.length; i++) {
        const val = text.charCodeAt(i) - 32;
        if (val < 0 || val > 102) continue;
        const pattern = patterns[val];
        for (let j = 0; j < pattern.length; j++) {
            const w = parseInt(pattern[j]) * scale;
            if (j % 2 === 0) doc.rect(currentX, y, w, height).fill();
            currentX += w;
            totalWidth += w;
        }
        checksum += val * (i + 1);
    }

    // Checksum
    const checkPattern = patterns[checksum % 103];
    for (let i = 0; i < checkPattern.length; i++) {
        const w = parseInt(checkPattern[i]) * scale;
        if (i % 2 === 0) doc.rect(currentX, y, w, height).fill();
        currentX += w;
        totalWidth += w;
    }

    // Stop
    const stopPattern = patterns[106];
    for (let i = 0; i < stopPattern.length; i++) {
        const w = parseInt(stopPattern[i]) * scale;
        if (i % 2 === 0) doc.rect(currentX, y, w, height).fill();
        currentX += w;
        totalWidth += w;
    }
    
    return totalWidth;
};

const generateWaybill = (shipment, res) => {
    // Helper to clean "N/A" values
    const cleanVal = (val) => {
        if (!val || val === 'N/A' || val === 'n/a' || val === 'NA' || val === 'na') return '-';
        return val;
    };

    // A5 Landscape: ~595 x 420 pts
    const doc = new PDFDocument({ margin: 15, size: 'A5', layout: 'landscape' });

    doc.pipe(res);

    // Helpers
    const drawSectionHeader = (x, y, w, title) => {
        doc.fillColor('#d1d5db').rect(x, y, w, 15).fill();
        doc.rect(x, y, w, 15).strokeColor('#000000').lineWidth(0.5).stroke();
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8).text((title || '').toUpperCase(), x, y + 4, {
            width: w,
            align: 'center'
        });
    };

    const drawSectionBody = (x, y, w, h) => {
        doc.rect(x, y, w, h).strokeColor('#000000').lineWidth(0.5).stroke();
    };

    // ================= HEADER [Y: 15-75] =================
    // Logo
    const logoJPG = path.join(__dirname, '../assets/logo.jpg');
    const logoPNG = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoJPG)) {
        doc.image(logoJPG, 20, 15, { width: 100 });
    } else if (fs.existsSync(logoPNG)) {
        doc.image(logoPNG, 20, 15, { width: 100 });
    }

    // Centered Barcode and ID — use dedicated barcode field (falls back to shipmentId for legacy records)
    const sId = shipment.shipmentId || 'SD-UNKNOWN';
    const barcodeValue = shipment.barcode || sId;
    const centerX = 297;
    
    const barcodeWidth = drawBarcode(doc, centerX - 75, 15, barcodeValue, 1.0, 30);
    const barcodeStartX = centerX - 75;
    
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
    const textWidth = doc.widthOfString(barcodeValue);
    const textX = barcodeStartX + (barcodeWidth / 2) - (textWidth / 2);
    doc.text(barcodeValue, textX, 50);

    // Right Side Labels
    doc.font('Helvetica-Bold').fontSize(24).text('WAYBILL', 430, 20, { align: 'right' });
    doc.fontSize(10).text(`Ref: ${sId}`, 430, 48, { align: 'right' });
    doc.text(`Date: ${new Date().toISOString().split('T')[0]}`, 430, 60, { align: 'right' });


    // ================= ROW 1 [Y: 85 - 175] =================
    const row1Y = 80;
    const colWidth = 185;
    const row1Height = 85;

    // COL 1: SENDER
    drawSectionHeader(20, row1Y, colWidth, 'SENDER DETAILS');
    drawSectionBody(20, row1Y + 15, colWidth, row1Height);

    const sender = shipment.senderDetails || { fullName: shipment.senderName, mobile: shipment.senderPhone, address: { city: shipment.start } };
    const collection = shipment.collectionDetails || {};
    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    let textY = row1Y + 21;
    const colStartX = 25;
    const colTextWidth = colWidth - 10;

    // Full name
    doc.font('Helvetica-Bold').fillColor('#000000').text(cleanVal(sender.fullName), colStartX, textY, { width: colTextWidth, align: 'center' });

    // Business name
    const senderCompany = cleanVal(sender.company || collection.company);
    if (senderCompany && senderCompany !== '-') {
        doc.font('Helvetica-Bold').fillColor('#000000').text(senderCompany, colStartX, textY + 10, { width: colTextWidth, align: 'center' });
    }
    doc.fillColor('#000000');

    // Mobile
    doc.font('Helvetica').text(cleanVal(sender.mobile), colStartX, textY + 20, { width: colTextWidth, align: 'center' });

    // Email
    doc.text(cleanVal(sender.email), colStartX, textY + 30, { width: colTextWidth, align: 'center' });

    if (sender.address) {
        doc.text(cleanVal(sender.address.street), colStartX, textY + 40, { width: colTextWidth, align: 'center' });
        const addrLine2 = `${cleanVal(sender.address.suburb)}, ${cleanVal(sender.address.city)}`.replace(/^, |-|-, /g, '').trim();
        doc.text(addrLine2 === ',' ? '' : addrLine2, colStartX, textY + 50, { width: colTextWidth, align: 'center' });
        doc.text(`${cleanVal(sender.address.province)} ${cleanVal(sender.address.postalCode)}`.replace(/^- -$/g, '').trim(), colStartX, textY + 60, { width: colTextWidth, align: 'center' });
    }

    // COL 2: RECEIVER
    drawSectionHeader(20 + colWidth, row1Y, colWidth, 'RECEIVER DETAILS');
    drawSectionBody(20 + colWidth, row1Y + 15, colWidth, row1Height);

    const receiver = shipment.deliveryDetails || { receiverName: shipment.receiverName, mobile: shipment.receiverPhone, address: { city: shipment.end } };
    textY = row1Y + 21;
    const rStartX = 20 + colWidth + 5;
    const rTextWidth = colWidth - 10;

    doc.font('Helvetica-Bold').fillColor('#000000').text(cleanVal(receiver.receiverName), rStartX, textY, { width: rTextWidth, align: 'center' });

    if (receiver.company && receiver.company !== 'N/A') {
        doc.font('Helvetica-Bold').fillColor('#000000').text(cleanVal(receiver.company), rStartX, textY + 10, { width: rTextWidth, align: 'center' });
    }

    doc.font('Helvetica').text(cleanVal(receiver.mobile), rStartX, textY + 20, { width: rTextWidth, align: 'center' });
    doc.text(cleanVal(receiver.email), rStartX, textY + 30, { width: rTextWidth, align: 'center' });

    if (receiver.address) {
        doc.text(cleanVal(receiver.address.street), rStartX, textY + 40, { width: rTextWidth, align: 'center' });
        const rAddr2 = `${cleanVal(receiver.address.suburb)}, ${cleanVal(receiver.address.city)}`.replace(/^, |-|-, /g, '').trim();
        doc.text(rAddr2 === ',' ? '' : rAddr2, rStartX, textY + 50, { width: rTextWidth, align: 'center' });
        doc.text(`${cleanVal(receiver.address.province)} ${cleanVal(receiver.address.postalCode)}`.replace(/^- -$/g, '').trim(), rStartX, textY + 60, { width: rTextWidth, align: 'center' });
    }

    // COL 3: SERVICE
    drawSectionHeader(20 + colWidth * 2, row1Y, colWidth, 'SERVICE INFO');
    drawSectionBody(20 + colWidth * 2, row1Y + 15, colWidth, row1Height);

    const sX = 20 + colWidth * 2 + 5;
    textY = row1Y + 21;
    const parcel = shipment.parcelDetails || { serviceType: 'Standard', parcelType: shipment.packageType, dimensions: { weight: shipment.parcelWeight } };

    // Handle dimensions as array or single object
    const dimsArray = Array.isArray(parcel.dimensions) ? parcel.dimensions : [parcel.dimensions].filter(Boolean);
    const firstDim = dimsArray[0] || {};
    const totalWeight = dimsArray.reduce((sum, d) => sum + (parseFloat(d.weight) || 0), 0);
    const numBoxes = dimsArray.length > 0 ? dimsArray.length : (shipment.numberOfBoxes || 1);

    doc.fillColor('#000000').font('Helvetica-Bold').text('Service:', sX, textY);
    doc.font('Helvetica').text((parcel.serviceType || 'ECONOMY').toUpperCase(), sX + 50, textY);
    
    doc.font('Helvetica-Bold').text('Type:', sX, textY + 12);
    const parcelTypeDisplay = (parcel.parcelType || 'Parcel').toUpperCase();
    doc.font('Helvetica').text(parcelTypeDisplay, sX + 50, textY + 12);
    
    doc.font('Helvetica-Bold').text('Weight:', sX, textY + 24);
    doc.font('Helvetica').text(`${totalWeight > 0 ? totalWeight.toFixed(1) : (shipment.parcelWeight || 0)} kg`, sX + 50, textY + 24);
    
    if (firstDim.length && firstDim.width && firstDim.height) {
        if (dimsArray.length === 1) {
            doc.font('Helvetica-Bold').text('Dims:', sX, textY + 36);
            doc.font('Helvetica').text(`${firstDim.length}x${firstDim.width}x${firstDim.height} cm`, sX + 50, textY + 36);
        } else {
            doc.font('Helvetica-Bold').text('Dims:', sX, textY + 36);
            doc.font('Helvetica').text(`${dimsArray.length} boxes`, sX + 50, textY + 36);
        }
    }
    
    const dimsLine = firstDim.length && firstDim.width && firstDim.height ? 12 : 0;
    doc.font('Helvetica-Bold').text('Qty:', sX, textY + 36 + dimsLine);
    doc.font('Helvetica').text(`${numBoxes}`, sX + 50, textY + 36 + dimsLine);
    
    doc.font('Helvetica-Bold').text('Carrier:', sX, textY + 48 + dimsLine);
    doc.font('Helvetica').text('Shipday Courier', sX + 50, textY + 48 + dimsLine);


    // ================= ROW 2 [Y: ~185 - 235] =================
    const row2Y = row1Y + 15 + row1Height + 5;
    const row2Height = 45;

    // COL 1: INSTRUCTIONS
    drawSectionHeader(20, row2Y, colWidth, 'INSTRUCTIONS');
    drawSectionBody(20, row2Y + 15, colWidth, row2Height);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text(parcel.specialInstructions || 'None', 25, row2Y + 20, { width: colWidth - 10, lineGap: 2 });

    // COL 2: PAYMENT
    drawSectionHeader(20 + colWidth, row2Y, colWidth - 40, 'PAYMENT INFO');
    drawSectionBody(20 + colWidth, row2Y + 15, colWidth - 40, row2Height);

    const pay = shipment.payment || { method: 'COD', amount: shipment.cost, status: 'Pending' };
    doc.font('Helvetica-Bold').fontSize(8).text('Method:', 20 + colWidth + 5, row2Y + 21);
    doc.font('Helvetica').text((pay.method || 'Account').toUpperCase(), 20 + colWidth + 50, row2Y + 21);

    doc.font('Helvetica-Bold').text('Amount:', 20 + colWidth + 5, row2Y + 32);
    doc.font('Helvetica').text(`R ${(pay.amount || shipment.cost || 0).toFixed(2)}`, 20 + colWidth + 50, row2Y + 32);

    doc.font('Helvetica-Bold').text('Status:', 20 + colWidth + 5, row2Y + 43);
    doc.font('Helvetica').text((pay.status || 'Pending').toUpperCase(), 20 + colWidth + 50, row2Y + 43);

    // COL 3: REF
    const col3X = 20 + colWidth + (colWidth - 40);
    const col3W = colWidth + 40;
    drawSectionHeader(col3X, row2Y, col3W, 'MARKETPLACE / REF');
    drawSectionBody(col3X, row2Y + 15, col3W, row2Height);

    let refY = row2Y + 21;
    const mStartX = col3X + 5;
    const mTextWidth = col3W - 10;

    // Order number
    const orderNum = cleanVal(shipment.orderNumber);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8).text(`Order: ${orderNum}`, mStartX, refY, { width: mTextWidth, align: 'center' });

    // Ref
    doc.font('Helvetica').fontSize(8).text(`Ref: ${shipment.shipmentId || '-'}`, mStartX, refY + 11, { width: mTextWidth, align: 'center' });

    // Marketplace name
    const marketName = cleanVal(shipment.marketplaceName);
    doc.text(`Market: ${marketName}`, mStartX, refY + 22, { width: mTextWidth, align: 'center' });


    // ================= DELIVERY DETAILS [Y: ~245 - 305] =================
    const podY = row2Y + 15 + row2Height + 10;
    const podHeight = 70;
    const pageWidth = 595 - 30; // 565

    drawSectionHeader(20, podY, pageWidth, 'Delivery Details');
    drawSectionBody(20, podY + 15, pageWidth, podHeight);

    const halfWidth = pageWidth / 2;
    const col1X = 20;
    const col2X = 20 + halfWidth;
    const contentStartY = podY + 18;
    const colPadding = 8;
    const rowHeight = 16;
    const signatureRowHeight = 28;

    // Draw column headers
    doc.fillColor('#e8e8e8').rect(col1X + 1, contentStartY, halfWidth - 2, 12).fill();
    doc.fillColor('#e8e8e8').rect(col2X + 1, contentStartY, halfWidth - 2, 12).fill();

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7);
    doc.text('DISPATCH/COLLECTION INFO', col1X + colPadding, contentStartY + 3, { width: halfWidth - colPadding * 2, align: 'center' });
    doc.text('RECEIVER DELIVERY INFO', col2X + colPadding, contentStartY + 3, { width: halfWidth - colPadding * 2, align: 'center' });

    const nameRowY = contentStartY + 14;

    // === LEFT COLUMN: DISPATCH ===
    // Row 1: Name
    doc.fillColor('#ffffff').rect(col1X + 1, nameRowY, halfWidth - 2, rowHeight).fill();
    doc.rect(col1X + 1, nameRowY, halfWidth - 2, rowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Name:', col1X + colPadding, nameRowY + 5, { width: 40 });
    doc.font('Helvetica').fontSize(7);
    doc.text(cleanVal(shipment.senderDetails?.fullName || shipment.senderName), col1X + colPadding + 35, nameRowY + 5, { width: halfWidth - colPadding * 2 - 35 });

    // Row 2: Signature
    const sigRowY = nameRowY + rowHeight;
    doc.fillColor('#ffffff').rect(col1X + 1, sigRowY, halfWidth - 2, signatureRowHeight).fill();
    doc.rect(col1X + 1, sigRowY, halfWidth - 2, signatureRowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Signature:', col1X + colPadding, sigRowY + 5, { width: halfWidth - colPadding * 2 });

    // Row 3: Date
    const dateRowY = sigRowY + signatureRowHeight;
    doc.fillColor('#ffffff').rect(col1X + 1, dateRowY, halfWidth - 2, rowHeight).fill();
    doc.rect(col1X + 1, dateRowY, halfWidth - 2, rowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Date:', col1X + colPadding, dateRowY + 5, { width: halfWidth - colPadding * 2 });

    // === RIGHT COLUMN: RECEIVER ===
    // Row 1: Name
    doc.fillColor('#ffffff').rect(col2X + 1, nameRowY, halfWidth - 2, rowHeight).fill();
    doc.rect(col2X + 1, nameRowY, halfWidth - 2, rowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Name:', col2X + colPadding, nameRowY + 5, { width: 40 });
    doc.font('Helvetica').fontSize(7);
    doc.text(cleanVal(shipment.deliveryDetails?.receiverName || shipment.receiverName), col2X + colPadding + 35, nameRowY + 5, { width: halfWidth - colPadding * 2 - 35 });

    // Row 2: Signature
    doc.fillColor('#ffffff').rect(col2X + 1, sigRowY, halfWidth - 2, signatureRowHeight).fill();
    doc.rect(col2X + 1, sigRowY, halfWidth - 2, signatureRowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Signature:', col2X + colPadding, sigRowY + 5, { width: halfWidth - colPadding * 2 });

    // Row 3: Date
    doc.fillColor('#ffffff').rect(col2X + 1, dateRowY, halfWidth - 2, rowHeight).fill();
    doc.rect(col2X + 1, dateRowY, halfWidth - 2, rowHeight).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7).text('Date:', col2X + colPadding, dateRowY + 5, { width: halfWidth - colPadding * 2 });

    doc.end();
};

const generatePOD = (shipment, res) => {
    const doc = new PDFDocument();
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('SHIPDAY WAYBILL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Waybill No: ${shipment.shipmentId}`, { align: 'right' });
    doc.moveDown();

    // Basic Info
    doc.fontSize(12).text(`Date Shipped: ${shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'N/A'}`);
    doc.text(`From: ${shipment.senderName || (shipment.senderDetails ? shipment.senderDetails.fullName : '')}`);
    doc.text(`To: ${shipment.receiverName || (shipment.deliveryDetails ? shipment.deliveryDetails.receiverName : '')}`);
    doc.moveDown();

    // Content
    doc.text('Received in good order and condition:');
    doc.moveDown(2);

    // Signature Block
    const sigY = 400;
    doc.moveTo(50, sigY).lineTo(250, sigY).stroke();
    doc.text('Receiver Signature', 50, sigY + 10);

    doc.moveTo(300, sigY).lineTo(500, sigY).stroke();
    doc.text('Date & Time', 300, sigY + 10);

    doc.end();
};

module.exports = {
    generateWaybill,
    generatePOD
};
