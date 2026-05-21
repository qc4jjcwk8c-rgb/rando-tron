import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function longestStreak(spins) {
  if (!spins.length) return { name: null, count: 0 };
  let best = { name: spins[0].winner, count: 1 };
  let cur  = { name: spins[0].winner, count: 1 };
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
  const [spins, setSpins] = useState([]);

  useEffect(() => {
    if (!supabase) return; // local-only mode — env vars not configured

    // ── Initial load ─────────────────────────────────
    supabase
      .from('spins')
      .select('id, winner, created_at')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setSpins(data);
      });

    // ── Real-time: catch inserts from either phone ───
    // Both phones subscribe to the same channel. When one
    // phone spins, the other sees the stat update instantly.
    const channel = supabase
      .channel('spins-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spins' },
        (payload) => {
          setSpins((prev) => {
            // Guard against duplicates (own insert already optimistically added)
            if (prev.some((s) => s.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const resetStats = useCallback(async () => {
    setSpins([]);
    if (!supabase) return;
    await supabase.from('spins').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
  }, []);

  const addSpin = useCallback(async (winner) => {
    // Optimistic update so stats appear instantly on the spinning phone
    const tempId = `temp-${Date.now()}`;
    const tempSpin = { id: tempId, winner, created_at: new Date().toISOString() };
    setSpins((prev) => [...prev, tempSpin]);

    if (!supabase) return; // local-only mode

    // Persist to Supabase — real-time subscription on the OTHER phone
    // will fire and update their stats automatically.
    const { data } = await supabase
      .from('spins')
      .insert({ winner })
      .select()
      .single();

    // Swap temp entry for the real DB row (prevents duplicate when
    // real-time fires on this same phone)
    if (data) {
      setSpins((prev) => prev.map((s) => (s.id === tempId ? data : s)));
    }
  }, []);

  const total       = spins.length;
  const hannahCount = spins.filter((s) => s.winner === 'Hannah').length;
  const elvieCount  = spins.filter((s) => s.winner === 'Elvie').length;

  return {
    stats: {
      total,
      hannahCount,
      elvieCount,
      last5:  spins.slice(-5),
      streak: longestStreak(spins),
    },
    addSpin,
    resetStats,
  };
}
