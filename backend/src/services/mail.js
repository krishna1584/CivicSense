const nodemailer = require('nodemailer');

const isProduction = process.env.NODE_ENV === 'production';

// Names and titles are typed by users, so they must not be able to inject HTML into emails.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

// All email goes out over SMTP (Gmail, Brevo, Mailgun, your host's mail server…).
const isSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const fromAddress = process.env.EMAIL_FROM || `"CivicSense" <${process.env.SMTP_USER || 'no-reply@civicsense.local'}>`;

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    family: 4, // some hosts can't reach mail servers over IPv6
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  : null;

/**
 * Whether this deployment can actually deliver email:
 *   'not_configured' – no SMTP settings
 *   'checking'       – startup check still running
 *   'available'      – connected to the SMTP server
 *   'unavailable'    – SMTP is set but the server can't be reached. Typical on Render's
 *                      free plan, which blocks outgoing SMTP connections.
 * The frontend reads this to tell users when codes won't arrive by email.
 */
let emailStatus = isSmtpConfigured ? 'checking' : 'not_configured';
const getEmailStatus = () => emailStatus;

// Email verification is only enforced when codes can actually be delivered. While the
// startup check is still running we assume email works.
const canDeliverEmail = () => emailStatus === 'available' || emailStatus === 'checking';

/** Connect to the SMTP server once at startup (with a time limit) to learn the status. */
async function checkEmailDelivery() {
  if (!transporter) {
    console.log('⚡ No SMTP settings: email is not sent (codes are printed here in development).');
    return emailStatus;
  }
  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 15000)),
    ]);
    emailStatus = 'available';
    console.log(`📧 Email is sent through ${process.env.SMTP_HOST}`);
  } catch (err) {
    emailStatus = 'unavailable';
    console.warn(`⚠️  Cannot reach SMTP server ${process.env.SMTP_HOST} (${err.message}). Emails will not be delivered; ` +
      'hosts such as Render\'s free plan block outgoing SMTP.');
  }
  return emailStatus;
}

/** Send one email. Failures are logged, never thrown, so a mail outage can't break sign-up. */
const sendMailHelper = async (email, name, otp, subject, htmlContent) => {
  if (!transporter) {
    if (otp) logOtpFallback(email, name, otp);
    else if (!isProduction) console.log(`[DEV] Email would be sent to ${email} | Subject: "${subject}"`);
    return;
  }
  try {
    await transporter.sendMail({ from: fromAddress, to: email, subject, html: htmlContent });
    emailStatus = 'available';
    console.log(`📧 Email sent to ${email}`);
  } catch (err) {
    // Connection-level failures mean the server can't reach SMTP at all
    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(err.code)) emailStatus = 'unavailable';
    console.error(`❌ Email to ${email} failed:`, err.message);
    if (otp) logOtpFallback(email, name, otp);
  }
};

const VERIFY_EMAIL_COPY = {
  subject: 'Verify your CivicSense account',
  heading: 'Confirm your email address',
  intro: 'Thank you for joining CivicSense! To complete your registration and secure your account, please enter the following 6-digit One-Time Password (OTP) in the verification page.',
};

const RESET_PASSWORD_COPY = {
  subject: 'Reset your CivicSense password',
  heading: 'Reset your password',
  intro: 'We received a request to reset your CivicSense password. Enter the following 6-digit code on the password reset page.',
};

const sendOtpEmail = async (email, name, otp, copy = VERIFY_EMAIL_COPY) => {
  const subject = copy.subject;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
  <style>
    body { background-color: #05070a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #ffffff; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; background-color: #05070a; padding: 40px 20px; box-sizing: border-box; }
    .container { max-width: 560px; margin: 0 auto; background: rgba(11, 15, 20, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
    .logo-container { display: flex; align-items: center; margin-bottom: 30px; }
    .logo-icon { width: 36px; height: 36px; background: rgba(0, 170, 239, 0.15); border: 1px solid rgba(0, 170, 239, 0.3); border-radius: 8px; display: inline-block; text-align: center; line-height: 36px; color: #00aaef; font-size: 20px; font-weight: bold; margin-right: 12px; }
    .logo-text { font-size: 22px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px; line-height: 36px; }
    .logo-highlight { color: #00aaef; }
    h1 { font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #ffffff; letter-spacing: -0.5px; }
    p { font-size: 15px; line-height: 1.6; color: #9ca3af; margin-top: 0; margin-bottom: 24px; }
    .otp-box { background: #0e131a; border: 1px dashed rgba(97, 192, 255, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2); }
    .otp-code { font-size: 38px; font-weight: 800; color: #61c0ff; letter-spacing: 6px; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; margin: 0; line-height: 1; }
    .warning-text { font-size: 12px; color: #4b5563; margin-bottom: 0; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; }
    .accent { color: #61c0ff; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-container">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Civic<span class="logo-highlight">Sense</span></span>
      </div>
      
      <h1>${copy.heading}</h1>
      <p>Hello <span class="accent">${escapeHtml(name)}</span>,</p>
      <p>${copy.intro} This code is valid for <span class="accent">10 minutes</span>.</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <p>If you did not initiate this request, you can safely ignore this email.</p>
      
      <p class="warning-text">
        This is an automated message, please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendMailHelper(email, name, otp, subject, htmlContent);
};

const logOtpFallback = (email, name, otp) => {
  // Printing a live code into production logs would let anyone with log access take over the account.
  if (isProduction) {
    console.error('A verification code email could not be delivered. Check the email provider settings.');
    return;
  }
  console.log(`
┌────────────────────────────────────────────────────────┐
│              🚨 DEVELOPER DEBUG MODE OTP 🚨             │
├────────────────────────────────────────────────────────┤
│  Email Target:   ${email.padEnd(38)} │
│  Recipient:      ${name.padEnd(38)} │
│                                                        │
│  Verification Code:                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │                     ${otp}                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Expires in: 10 minutes                                │
└────────────────────────────────────────────────────────┘
`);
};

const BASE_STYLES = `
  body { background:#05070a; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; margin:0; padding:0; color:#fff; -webkit-font-smoothing:antialiased; }
  .wrapper { width:100%; background:#05070a; padding:40px 20px; box-sizing:border-box; }
  .container { max-width:560px; margin:0 auto; background:rgba(11,15,20,0.95); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:40px; box-shadow:0 20px 40px rgba(0,0,0,0.5); }
  .logo-icon { width:36px; height:36px; background:rgba(0,170,239,0.15); border:1px solid rgba(0,170,239,0.3); border-radius:8px; display:inline-block; text-align:center; line-height:36px; color:#00aaef; font-size:20px; font-weight:bold; margin-right:12px; vertical-align:middle; }
  .logo-text { font-size:22px; font-weight:bold; color:#fff; letter-spacing:-0.5px; vertical-align:middle; }
  .logo-highlight { color:#00aaef; }
  h1 { font-size:24px; font-weight:700; margin:24px 0 12px; color:#fff; letter-spacing:-0.5px; }
  p { font-size:15px; line-height:1.6; color:#9ca3af; margin:0 0 16px; }
  .badge { display:inline-block; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:24px; }
  .badge-yellow { background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.35); color:#fbbf24; }
  .badge-green  { background:rgba(52,211,153,0.15); border:1px solid rgba(52,211,153,0.35); color:#34d399; }
  .issue-card { background:#0e131a; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:20px 24px; margin:24px 0; }
  .issue-title { font-size:17px; font-weight:700; color:#fff; margin:0 0 6px; }
  .issue-link { display:inline-flex; align-items:center; gap:6px; margin-top:20px; padding:12px 24px; border-radius:10px; font-size:14px; font-weight:600; text-decoration:none; }
  .link-primary { background:linear-gradient(135deg,#00aaef,#61c0ff); color:#05070a; }
  .link-outline  { background:transparent; border:1px solid rgba(97,192,255,0.35); color:#61c0ff; }
  .footer-note { font-size:12px; color:#4b5563; margin-top:24px; border-top:1px solid rgba(255,255,255,0.05); padding-top:20px; }
  .accent { color:#61c0ff; font-weight:600; }
`;

const sendResolutionPendingEmail = async (email, name, issueTitle, issueId) => {
  const issueUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/issues/${issueId}`;
  const subject = `Action Required: Resolution pending review for "${issueTitle}"`;
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resolution Pending</title><style>${BASE_STYLES}</style></head>
<body><div class="wrapper"><div class="container">
  <div><span class="logo-icon">⚡</span><span class="logo-text">Civic<span class="logo-highlight">Sense</span></span></div>
  <span class="badge badge-yellow">⏳ Awaiting Your Review</span>
  <h1>Your issue may have been resolved</h1>
  <p>Hello <span class="accent">${escapeHtml(name)}</span>,</p>
  <p>An administrator has reviewed your civic issue and submitted resolution evidence. Please log in to <strong>verify</strong> whether the problem has been fixed to your satisfaction.</p>
  <div class="issue-card">
    <div class="issue-title">${escapeHtml(issueTitle)}</div>
    <p style="margin:0;font-size:13px;color:#6b7280;">Awaiting your confirmation</p>
  </div>
  <p>Visit the issue page to approve or reject the proposed resolution. If you approve, the issue will be marked as <span class="accent">Resolved</span>. If you reject it, it will be sent back for further action.</p>
  <a href="${issueUrl}" class="issue-link link-primary">Review Resolution →</a>
  <p class="footer-note">This is an automated message from CivicSense. Please do not reply directly to this email.</p>
</div></div></body></html>`;

  await sendMailHelper(email, name, null, subject, htmlContent);
};

const sendResolvedEmail = async (email, name, issueTitle, issueId) => {
  const issueUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/issues/${issueId}`;
  const subject = `✅ Issue Resolved: "${issueTitle}"`;
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Issue Resolved</title><style>${BASE_STYLES}</style></head>
<body><div class="wrapper"><div class="container">
  <div><span class="logo-icon">⚡</span><span class="logo-text">Civic<span class="logo-highlight">Sense</span></span></div>
  <span class="badge badge-green">✅ Resolved</span>
  <h1>Your issue has been resolved!</h1>
  <p>Hello <span class="accent">${escapeHtml(name)}</span>,</p>
  <p>Great news! The civic issue you reported has been <strong>fully resolved</strong> and acknowledged. Thank you for making your community a better place by reporting it.</p>
  <div class="issue-card">
    <div class="issue-title">${escapeHtml(issueTitle)}</div>
    <p style="margin:0;font-size:13px;color:#34d399;font-weight:600;">✓ Resolved</p>
  </div>
  <p>You can view the full resolution history and any evidence uploaded by the authorities on the issue page.</p>
  <a href="${issueUrl}" class="issue-link link-primary">View Issue →</a>
  <p class="footer-note">This is an automated message from CivicSense. Please do not reply directly to this email.</p>
</div></div></body></html>`;

  await sendMailHelper(email, name, null, subject, htmlContent);
};

const sendPasswordResetEmail = (email, name, otp) => sendOtpEmail(email, name, otp, RESET_PASSWORD_COPY);

module.exports = {
  getEmailStatus,
  canDeliverEmail,
  checkEmailDelivery,
  escapeHtml,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendResolutionPendingEmail,
  sendResolvedEmail,
};
