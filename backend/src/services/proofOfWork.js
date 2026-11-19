/**
 * Proof-of-work for no-login reports: the browser must spend CPU time before
 * submitting, which makes bulk spam costly without identifying anyone and
 * without sending the reporter's IP to a third-party CAPTCHA.
 *
 * Challenges are signed, so the server stores nothing until one is redeemed.
 */
const crypto = require('crypto');

const DIFFICULTY_BITS = Number(process.env.POW_DIFFICULTY_BITS) || 16;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const redeemed = new Map(); // nonce -> expiry, so each solved challenge works once

const sign = (body) =>
  crypto.createHmac('sha256', `pow:${process.env.JWT_SECRET}`).update(body).digest('hex');

const leadingZeroBits = (buffer) => {
  let bits = 0;
  for (const byte of buffer) {
    if (byte === 0) { bits += 8; continue; }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
};

function issueChallenge() {
  const body = `${crypto.randomBytes(16).toString('hex')}.${Date.now() + CHALLENGE_TTL_MS}.${DIFFICULTY_BITS}`;
  return { challenge: `${body}.${sign(body)}`, difficulty: DIFFICULTY_BITS };
}

function redeemSolution(challenge, solution) {
  const [nonce, expires, difficulty, signature, extra] = String(challenge).split('.');
  if (!nonce || !expires || !difficulty || !signature || extra !== undefined) return false;

  const expected = Buffer.from(sign(`${nonce}.${expires}.${difficulty}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return false;

  const now = Date.now();
  if (Number(expires) < now || redeemed.has(nonce)) return false;

  const hash = crypto.createHash('sha256').update(`${challenge}:${solution}`).digest();
  if (leadingZeroBits(hash) < Number(difficulty)) return false;

  for (const [key, expiry] of redeemed) if (expiry < now) redeemed.delete(key);
  redeemed.set(nonce, Number(expires));
  return true;
}

module.exports = { issueChallenge, redeemSolution };
