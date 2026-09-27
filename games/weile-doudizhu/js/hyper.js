/** 超几何分布：从未知牌里估计某家拿到某点的概率。 */

export function comb(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let out = 1;
  for (let i = 1; i <= kk; i += 1) {
    out = (out * (n - kk + i)) / i;
  }
  return out;
}

export function hyperPeq(N, K, n, x) {
  if (N <= 0 || n < 0) return x === 0 ? 1 : 0;
  if (n > N) n = N;
  const den = comb(N, n);
  if (den === 0) return 0;
  return (comb(K, x) * comb(N - K, n - x)) / den;
}

export function hyperPAtLeast(N, K, n, t) {
  if (t <= 0) return 1;
  let p = 0;
  const max = Math.min(K, n);
  for (let x = t; x <= max; x += 1) p += hyperPeq(N, K, n, x);
  return Math.max(0, Math.min(1, p));
}

export function estimateRankProb(unknownOfRank, unknownTotal, handSize) {
  const N = unknownTotal;
  const K = unknownOfRank;
  const n = Math.min(handSize, N);
  return {
    atLeast1: hyperPAtLeast(N, K, n, 1),
    atLeast2: hyperPAtLeast(N, K, n, 2),
    bomb: K === 4 ? hyperPAtLeast(N, K, n, 4) : 0,
  };
}
