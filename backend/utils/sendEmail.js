let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}

let cachedTransporter = null;

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    if (!nodemailer) {
        throw new Error("Email service isn't set up yet. Run `npm install nodemailer` in /backend.");
    }

    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
        throw new Error('Email service is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER and EMAIL_PASS in your .env file.');
    }

    cachedTransporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: Number(EMAIL_PORT) || 587,
        secure: Number(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });

    return cachedTransporter;
}

async function sendEmail({ to, subject, text, html }) {
    const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

    if (!nodemailer || !EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
        console.warn('\n[sendEmail] SMTP is not configured - printing the email instead of sending it:');
        console.warn(`To: ${to}\nSubject: ${subject}\n${text}\n`);
        return { simulated: true };
    }

    const transporter = getTransporter();
    return transporter.sendMail({
        from: EMAIL_FROM || `"CampusShare" <${EMAIL_USER}>`,
        to,
        subject,
        text,
        html
    });
}

module.exports = sendEmail;
