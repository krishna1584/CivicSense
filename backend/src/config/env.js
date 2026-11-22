/**
 * Checks environment settings at startup, so a missing value stops the server with a
 * clear message instead of failing later in a confusing way. See backend/.env.example.
 */

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

function checkEnv(env = process.env) {
  // Older names are still accepted so existing deployments keep working.
  if (!env.FRONTEND_URL && env.CLIENT_URL) env.FRONTEND_URL = env.CLIENT_URL;
  if (!env.EMAIL_FROM && env.SMTP_FROM) env.EMAIL_FROM = env.SMTP_FROM;
  const errors = [];
  const warnings = [];

  for (const key of REQUIRED) {
    if (!env[key]) errors.push(`${key} is required`);
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    warnings.push('JWT_SECRET and JWT_REFRESH_SECRET should be different');
  }

  if (env.NODE_ENV === 'production') {
    if (!env.FRONTEND_URL) errors.push('FRONTEND_URL is required in production (browser access and email links)');
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      if (env[key] && env[key].length < 32) warnings.push(`${key} should be at least 32 characters`);
    }
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      warnings.push('SMTP is not configured, so verification and password-reset emails will not be sent');
    }
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      warnings.push('Cloudinary is not configured, so uploads are saved to local disk and lost on redeploy');
    }
  }

  return { errors, warnings };
}

function assertEnv() {
  const { errors, warnings } = checkEnv();
  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
  if (errors.length) {
    console.error(`❌ Missing configuration:\n  - ${errors.join('\n  - ')}\nSee backend/.env.example.`);
    process.exit(1);
  }
}

module.exports = { checkEnv, assertEnv };
