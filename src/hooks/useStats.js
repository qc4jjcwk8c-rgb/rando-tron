import { useState, useCallback } from 'react';

const KEY = 'rando-tron-stats-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { spins: [] };
  } catch {
    return { spins: [] };
  }
}

function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function longestStreak(spins) {
  if (!spins.length) return { name: null, count: 0 };
  let best = { name: spins[0].winner, count: 1 };
  let cur = { name: spins[0].winner, count: 1 };
  for (let i = 1; i < spins.length; i++) {
    if (spins[i].winner === cur.name) {
      cur.count++;
      if (cur.count > best.count) best = { ...cur };
    } else {
      cur = { name: spins[i].winner, count: 1 };
    }
  }
  return best;
}

export function useStats() {
  const [raw, setRaw] = useState(load);

  const addSpin = useCallback((winner) => {
    setRaw((prev) => {
      const next = { spins: [...prev.spins, { winner, ts: Date.now() }] };
      save(next);
      return next;
    });
  }, []);

  const resetStats = useCallback(() => {
    const empty = { spins: [] };
    save(empty);
    setRaw(empty);
  }, []);

  const total = raw.spins.length;
  const hannahCount = raw.spins.filter((s) => s.winner === 'Hannah').length;
  const elvieCount = raw.spins.filter((s) => s.winner === 'Elvie').length;
  const last5 = raw.spins.slice(-5);
  const streak = longestStreak(raw.spins);

  return {
    stats: { total, hannahCount, elvieCount, last5, streak },
    addSpin,
    resetStats,
  };
}
