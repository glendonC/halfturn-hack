import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { FinishedSummary } from '@/components/drill';
import { useDrillStore } from '@/state';

/**
 * Thin post-drill summary route. Persist/save already happened in the store.
 */
export default function DrillSummaryScreen() {
  const router = useRouter();
  const status = useDrillStore((s) => s.status);
  const reset = useDrillStore((s) => s.reset);
  const enterReady = useDrillStore((s) => s.enterReady);
  const leaving = useRef(false);

  useEffect(() => {
    if (status !== 'finished' && !leaving.current) {
      router.replace('/');
    }
  }, [status, router]);

  if (status !== 'finished') return null;

  return (
    <FinishedSummary
      onDone={() => {
        leaving.current = true;
        reset();
        router.replace('/');
      }}
      onRepeat={() => {
        leaving.current = true;
        reset();
        enterReady();
        router.replace('/drill/active');
      }}
    />
  );
}
