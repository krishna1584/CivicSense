const hasLeadingZeroBits = (bytes: Uint8Array, bits: number) => {
  let remaining = bits;
  for (const byte of bytes) {
    if (remaining <= 0) return true;
    if (remaining >= 8) {
      if (byte !== 0) return false;
      remaining -= 8;
    } else {
      return byte >> (8 - remaining) === 0;
    }
  }
  return remaining <= 0;
};

/** Find a value whose hash with the challenge starts with enough zero bits. */
export async function solveChallenge(challenge: string, difficulty: number): Promise<string> {
  const encoder = new TextEncoder();
  for (let attempt = 0; ; attempt++) {
    const solution = String(attempt);
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${challenge}:${solution}`));
    if (hasLeadingZeroBits(new Uint8Array(digest), difficulty)) return solution;
  }
}
