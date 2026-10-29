import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { etaCountdown, taskTracker } from './index';

function fakeClient() {
  const handlers = new Map<string, Set<(payload: any) => void>>();
  return {
    on: vi.fn((event: string, handler: (payload: any) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)!.delete(handler);
    }),
    emit(event: string, payload: any) {
      for (const handler of handlers.get(event) ?? []) handler(payload);
    },
    listen: vi.fn(async () => {}),
    stopListening: vi.fn(async () => {}),
    listeners: () => [...handlers.values()].reduce((n, set) => n + set.size, 0),
  };
}

afterEach(() => vi.useRealTimers());

describe('taskTracker', () => {
  it('tracks while subscribed and stops after the last subscriber leaves', async () => {
    const client = fakeClient();
    const tracker = taskTracker(client as any, 't1');
    expect(client.listen).not.toHaveBeenCalled();

    const seen: any[] = [];
    const a = tracker.subscribe((s) => seen.push(s));
    const b = tracker.subscribe(() => {});
    await Promise.resolve();
    expect(client.listen).toHaveBeenCalledTimes(1);

    client.emit('TASK_ASSIGNED', { taskId: 't1', status: 'ASSIGNED', currentStageIndex: 0 });
    client.emit('RIDER_LOCATION_UPDATE', {
      taskId: 't1',
      location: { latitude: 6.45, longitude: 3.39 },
      eta: { stageIndex: 0, seconds: 120, meters: 900 },
      timestamp: new Date().toISOString(),
    });
    expect(get(tracker)).toMatchObject({ status: 'ASSIGNED', eta: { meters: 900 } });
    expect(seen.at(-1).rider).toMatchObject({ latitude: 6.45 });

    a();
    expect(client.stopListening).not.toHaveBeenCalled();
    b();
    await Promise.resolve();
    expect(client.stopListening).toHaveBeenCalledWith('t1');
    expect(client.listeners()).toBe(0);
  });
});

describe('etaCountdown', () => {
  it('counts down from a tracker or a bare ETA store', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00.000Z'));
    const client = fakeClient();
    const tracker = taskTracker(client as any, 't1', {
      initial: { eta: { stageIndex: 0, seconds: 90, meters: 500, arrivesAt: '2026-10-28T10:01:30.000Z', updatedAt: '2026-10-28T10:00:00.000Z' } },
    });
    const left = etaCountdown(tracker);
    const values: Array<number | null> = [];
    const stop = left.subscribe((v) => values.push(v));
    vi.advanceTimersByTime(30_000);
    stop();
    expect(values[0]).toBe(90);
    expect(values.at(-1)).toBe(60);
  });
});
