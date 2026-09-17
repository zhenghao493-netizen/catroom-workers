/** Unbiased, server-only randomness. No client-supplied dice or deck. */
export function randomInt(max) {
  if (!Number.isInteger(max) || max < 1 || max > 0xffffffff) throw new Error('随机数范围错误');
  const limit = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= limit);
  return a[0] % max;
}
export function shuffle(input, rand = randomInt) {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
