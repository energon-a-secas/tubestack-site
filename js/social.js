// ── Social utilities — match scores, category stats ──────────

export function jaccardMatch(setA, setB) {
  if (!setA.length && !setB.length) return 0;
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export function matchBadgeClass(score) {
  if (score >= 70) return 'match-high';
  if (score >= 40) return 'match-mid';
  if (score > 0) return 'match-low';
  return 'match-none';
}

export function matchLabel(score) {
  if (score >= 70) return 'Great match';
  if (score >= 40) return 'Good match';
  if (score > 0) return 'Some overlap';
  return '';
}

export function categoryStats(userChannels) {
  const counts = {};
  for (const uc of userChannels) {
    for (const cat of uc.categories || []) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ category: cat, count }));
}
