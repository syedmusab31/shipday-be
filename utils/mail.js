// utils/mail.js
const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');

const writeVerificationCodeToTempFile = (to, code) => {
  try {
    const logPath = path.join(__dirname, '../temp_email.txt');
    const logContent = `[${new Date().toISOString()}] To: ${to} | Code: ${code}\n`;
    fs.appendFileSync(logPath, logContent);
    return true;
  } catch (fsErr) {
    console.error("Failed to write to temp_email.txt:", fsErr.message);
    return false;
  }
};

const extractVerificationCode = (text) => {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    /verification code is:\s*([A-Z0-9]+)/i,
    /code is:\s*([A-Z0-9]+)/i,
    /code:\s*([A-Z0-9]+)/i,
    /Your verification code is:\s*([A-Z0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
};

/**
 * Mail utility using ShipDay email service
 * Uses noreply@shipday.co.za for verification/notification emails
 */
// Send mail function
const sendMail = async (to, subject, text, html = null) => {
  const transporter = nodemailer.createTransport({
    host: process.env.NOREPLY_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.NOREPLY_SMTP_PORT) || 465,
    secure: true, // true for 465
    pool: true,
    auth: {
      user: process.env.NOREPLY_EMAIL || 'codeforge0@gmail.com',
      pass: process.env.NOREPLY_EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 60000,
    greetingTimeout: 60000,
  });

  const isVerification = (subject || '').toLowerCase().includes('verification');
  const verificationCode = extractVerificationCode(text);

  if (isVerification && verificationCode) {
    writeVerificationCodeToTempFile(to, verificationCode);
  }

  try {
    const mailOptions = {
      from: `"ShipDay" <${process.env.FROM_EMAIL || process.env.NOREPLY_EMAIL || 'noreply@shipday.co.za'}>`,
      to,
      subject,
      text,
      ...(html && { html }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);

    // Fallback for Development: Log to console and file
    if (isVerification) {
      const code = verificationCode || "UNKNOWN";

      console.log("\n--- DEVELOPMENT FALLBACK ---");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`VERIFICATION CODE: ${code}`);
      console.log("----------------------------\n");

      if (code !== 'UNKNOWN') {
        writeVerificationCodeToTempFile(to, code);
      }

      throw new Error(`SMTP_FAIL_FALLBACK_OK:${code}`);
    }

    throw new Error(`Email could not be sent. Error: ${error.message}`);
  }
};

module.exports = sendMail;
