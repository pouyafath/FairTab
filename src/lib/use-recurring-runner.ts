import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useUserId } from '@/lib/auth';
import { todayLocal } from '@/lib/dates';
import { keys } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

const MIN_GAP_MS = 60 * 60 * 1000; // at most once an hour
const BUDGET = 200; // run_recurring stops after about this many; call again while it returns at least this
const MAX_CALLS = 5;

/**
 * Adds recurring expenses that are due (rent, subscriptions): once after sign-in, and again when the
 * app comes back to the foreground, at most once an hour. The database never adds a date twice, so
 * this only avoids needless calls.
 */
export function useRecurringRunner() {
  const userId = useUserId();
  const client = useQueryClient();
  const lastRun = useRef({ userId: '', at: 0 });

  useEffect(() => {
    if (!userId) return;
    let running = false;

    const run = async () => {
      const last = lastRun.current;
      if (running || (last.userId === userId && Date.now() - last.at < MIN_GAP_MS)) return;
      running = true;
      lastRun.current = { userId, at: Date.now() };
      try {
        let added = 0;
        for (let call = 0; call < MAX_CALLS; call++) {
          // The device's date, so a date that is "today" here is added today (the database uses UTC).
          const { data, error } = await supabase.rpc('run_recurring', { p_today: todayLocal() });
          if (error) throw error;
          added += Number(data);
          if (Number(data) < BUDGET) break;
        }
        // Something was added: refresh everything. Otherwise only the rules may have moved on.
        void client.invalidateQueries(added > 0 ? undefined : { queryKey: keys.recurring });
      } catch {
        // Not critical (offline, or the database update has not been run yet): allow a retry on the
        // next foreground instead of waiting an hour.
        lastRun.current = { userId: '', at: 0 };
      } finally {
        running = false;
      }
    };

    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => subscription.remove();
  }, [userId, client]);
}
