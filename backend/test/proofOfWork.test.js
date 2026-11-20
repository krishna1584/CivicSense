process.env.JWT_SECRET = 'test-secret';
process.env.POW_DIFFICULTY_BITS = '8';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { issueChallenge, redeemSolution } = require('../src/services/proofOfWork');

const leadingZeroBits = (buf) => {
  let bits = 0;
  for (const b of buf) { if (b === 0) { bits += 8; continue; } return bits + Math.clz32(b) - 24; }
  return bits;
};

const solve = ({ challenge, difficulty }) => {
  for (let i = 0; ; i++) {
    const hash = crypto.createHash('sha256').update(`${challenge}:${i}`).digest();
    if (leadingZeroBits(hash) >= difficulty) return String(i);
  }
};

const failingSolution = ({ challenge, difficulty }) => {
  for (let i = 0; ; i++) {
    const hash = crypto.createHash('sha256').update(`${challenge}:${i}`).digest();
    if (leadingZeroBits(hash) < difficulty) return String(i);
  }
};

test('accepts a correct solution', () => {
  const c = issueChallenge();
  assert.strictEqual(redeemSolution(c.challenge, solve(c)), true);
});

test('rejects a solution without enough work', () => {
  const c = issueChallenge();
  assert.strictEqual(redeemSolution(c.challenge, failingSolution(c)), false);
});

test('each challenge can only be redeemed once', () => {
  const c = issueChallenge();
  const solution = solve(c);
  assert.strictEqual(redeemSolution(c.challenge, solution), true);
  assert.strictEqual(redeemSolution(c.challenge, solution), false);
});

test('rejects a challenge whose difficulty was edited', () => {
  const c = issueChallenge();
  const [nonce, expires, , signature] = c.challenge.split('.');
  const forged = `${nonce}.${expires}.0.${signature}`;
  assert.strictEqual(redeemSolution(forged, '0'), false);
});

test('rejects malformed challenges', () => {
  assert.strictEqual(redeemSolution('not-a-challenge', '0'), false);
  assert.strictEqual(redeemSolution('a.b.c.d.e', '0'), false);
});
