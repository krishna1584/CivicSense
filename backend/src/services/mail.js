const nodemailer = require('nodemailer');

// Read SMTP configurations from environment
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  family: 4, // Force IPv4 — Render free tier cannot reach Gmail over IPv6
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const smtpFrom = process.env.SMTP_FROM || '"CivicSense" <no-reply@civicsense.org>';

// Check if SMTP is fully configured
const isSmtpConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;

if (isSmtpConfigured) {
  try {
    transporter = nodemailer.createTransport(smtpConfig);
    console.log('📧 Mailer initialized with SMTP configuration:', smtpConfig.host);
  } catch (err) {
    console.error('❌ Failed to initialize Nodemailer transporter:', err);
  }
} else {
  console.log('⚡ SMTP host or credentials not set in .env. Falling back to Developer Debug Mode.');
}

/**
 * Sends a high-fidelity email verification OTP.
 * If SMTP is not configured, prints a beautiful banner in console logs.
 */
const sendOtpEmail = async (email, name, otp) => {
  const mailOptions = {
    from: smtpFrom,
    to: email,
    subject: 'Verify your CivicSense account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
  <style>
    body {
      background-color: #05070a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #05070a;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: rgba(11, 15, 20, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .logo-container {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: rgba(0, 170, 239, 0.15);
      border: 1px solid rgba(0, 170, 239, 0.3);
      border-radius: 8px;
      display: inline-block;
      text-align: center;
      line-height: 36px;
      color: #00aaef;
      font-size: 20px;
      font-weight: bold;
      margin-right: 12px;
    }
    .logo-text {
      font-size: 22px;
      font-weight: bold;
      color: #ffffff;
      letter-spacing: -0.5px;
      line-height: 36px;
    }
    .logo-highlight {
      color: #00aaef;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 16px;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #9ca3af;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .otp-box {
      background: #0e131a;
      border: 1px dashed rgba(97, 192, 255, 0.3);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 32px 0;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      color: #61c0ff;
      letter-spacing: 6px;
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
      margin: 0;
      line-height: 1;
    }
    .warning-text {
      font-size: 12px;
      color: #4b5563;
      margin-bottom: 0;
      margin-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 20px;
    }
    .accent {
      color: #61c0ff;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="logo-container">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Civic<span class="logo-highlight">Sense</span></span>
      </div>
      
      <h1>Confirm your email address</h1>
      <p>Hello <span class="accent">${name}</span>,</p>
      <p>Thank you for joining CivicSense! To complete your registration and secure your account, please enter the following 6-digit One-Time Password (OTP) in the verification page. This code is valid for <span class="accent">10 minutes</span>.</p>
      
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
</html>
    `,
  };

  if (isSmtpConfigured && transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 OTP successfully sent via SMTP to: ${email}`);
    } catch (err) {
      console.error(`❌ SMTP mail delivery failed for ${email}:`, err);
      logOtpFallback(email, name, otp);
    }
  } else {
    logOtpFallback(email, name, otp);
  }
};

const logOtpFallback = (email, name, otp) => {
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

/**
 * Email helpers for resolution-related notifications.
 * Shared CSS/layout mirrors the OTP email for brand consistency.
 */
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

/**
 * Sent to the original reporter when admin marks the issue as resolved
 * and it moves to `pending_verification`.
 */
const sendResolutionPendingEmail = async (email, name, issueTitle, issueId) => {
  const issueUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/issues/${issueId}`;
  const mailOptions = {
    from: smtpFrom,
    to: email,
    subject: `Action Required: Resolution pending review for "${issueTitle}"`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resolution Pending</title><style>${BASE_STYLES}</style></head>
<body><div class="wrapper"><div class="container">
  <div><span class="logo-icon">⚡</span><span class="logo-text">Civic<span class="logo-highlight">Sense</span></span></div>
  <span class="badge badge-yellow">⏳ Awaiting Your Review</span>
  <h1>Your issue may have been resolved</h1>
  <p>Hello <span class="accent">${name}</span>,</p>
  <p>An administrator has reviewed your civic issue and submitted resolution evidence. Please log in to <strong>verify</strong> whether the problem has been fixed to your satisfaction.</p>
  <div class="issue-card">
    <div class="issue-title">${issueTitle}</div>
    <p style="margin:0;font-size:13px;color:#6b7280;">Awaiting your confirmation</p>
  </div>
  <p>Visit the issue page to approve or reject the proposed resolution. If you approve, the issue will be marked as <span class="accent">Resolved</span>. If you reject it, it will be sent back for further action.</p>
  <a href="${issueUrl}" class="issue-link link-primary">Review Resolution →</a>
  <p class="footer-note">This is an automated message from CivicSense. Please do not reply directly to this email.</p>
</div></div></body></html>`,
  };

  if (isSmtpConfigured && transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 Resolution-pending email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Failed to send resolution-pending email to ${email}:`, err.message);
    }
  } else {
    console.log(`[DEV] Resolution-pending email → ${email} | Issue: "${issueTitle}"`);
  }
};

/**
 * Sent to the original reporter when the issue is fully resolved and
 * the citizen has acknowledged/approved it.
 */
const sendResolvedEmail = async (email, name, issueTitle, issueId) => {
  const issueUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/issues/${issueId}`;
  const mailOptions = {
    from: smtpFrom,
    to: email,
    subject: `✅ Issue Resolved: "${issueTitle}"`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Issue Resolved</title><style>${BASE_STYLES}</style></head>
<body><div class="wrapper"><div class="container">
  <div><span class="logo-icon">⚡</span><span class="logo-text">Civic<span class="logo-highlight">Sense</span></span></div>
  <span class="badge badge-green">✅ Resolved</span>
  <h1>Your issue has been resolved!</h1>
  <p>Hello <span class="accent">${name}</span>,</p>
  <p>Great news! The civic issue you reported has been <strong>fully resolved</strong> and acknowledged. Thank you for making your community a better place by reporting it.</p>
  <div class="issue-card">
    <div class="issue-title">${issueTitle}</div>
    <p style="margin:0;font-size:13px;color:#34d399;font-weight:600;">✓ Resolved</p>
  </div>
  <p>You can view the full resolution history and any evidence uploaded by the authorities on the issue page.</p>
  <a href="${issueUrl}" class="issue-link link-primary">View Issue →</a>
  <p class="footer-note">This is an automated message from CivicSense. Please do not reply directly to this email.</p>
</div></div></body></html>`,
  };

  if (isSmtpConfigured && transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 Resolved email sent to: ${email}`);
    } catch (err) {
      console.error(`❌ Failed to send resolved email to ${email}:`, err.message);
    }
  } else {
    console.log(`[DEV] Resolved email → ${email} | Issue: "${issueTitle}"`);
  }
};

module.exports = {
  sendOtpEmail,
  sendResolutionPendingEmail,
  sendResolvedEmail,
};
