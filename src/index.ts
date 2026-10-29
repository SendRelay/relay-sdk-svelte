/**
 * Official Relay Svelte bindings: `taskTracker(client, taskId)` is a Svelte store with the task's
 * live status, rider position and ETA. Use it with `$tracker` in any component. Works in Svelte 4
 * and 5, and SvelteKit (track on the client only).
 *
 * Built on `@relay-sdk/sdk-browser`. Every framework binding wraps the same `createTaskTracker`
 * store, so Svelte, React, Vue and React Native behave identically.
 *
 * @packageDocumentation
 */

import {
  createTaskTracker,
  type RelayRealtimeClient,
  type TaskTrackerOptions,
  type TaskTrackerState,
  type TrackedEta,
} from '@relay-sdk/sdk-browser';
import { getContext, setContext } from 'svelte';
import { derived, readable, type Readable } from 'svelte/store';

export * from '@relay-sdk/sdk-browser';

const RELAY_CLIENT = Symbol('relay-client');

/** Make a realtime client available to child components. Call during component setup. */
export function setRelayClient(client: RelayRealtimeClient): RelayRealtimeClient {
  setContext(RELAY_CLIENT, client);
  return client;
}

/** The realtime client set by `setRelayClient` in a parent component. */
export function getRelayClient(): RelayRealtimeClient {
  const client = getContext<RelayRealtimeClient | undefined>(RELAY_CLIENT);
  if (!client) throw new Error('getRelayClient needs setRelayClient(client) in a parent component');
  return client;
}

/** State before tracking starts. */
export function idleTrackerState(taskId = ''): TaskTrackerState {
  return {
    taskId,
    connection: 'idle',
    status: null,
    currentStageIndex: null,
    rider: null,
    eta: null,
    events: [],
    finished: false,
    error: null,
  };
}

/**
 * A store tracking one task. It starts listening when the first subscriber arrives and stops when
 * the last one leaves, so `$tracker` in a component is all you need.
 *
 * @example
 * ```svelte
 * <script>
 *   import { getRelayClient, taskTracker } from '@relay-sdk/svelte';
 *   export let taskId;
 *   const tracker = taskTracker(getRelayClient(), taskId);
 * </script>
 *
 * <p>{$tracker.status ?? 'Finding a rider'}</p>
 * ```
 */
export function taskTracker(
  client: RelayRealtimeClient,
  taskId: string,
  options: TaskTrackerOptions = {},
): Readable<TaskTrackerState> {
  return readable<TaskTrackerState>(idleTrackerState(taskId), (set) => {
    const tracker = createTaskTracker(client, taskId, options);
    set(tracker.getState());
    const unsubscribe = tracker.subscribe(set);
    void tracker.start();
    return () => {
      unsubscribe();
      void tracker.stop();
    };
  });
}

/**
 * Seconds left until the ETA's `arrivesAt`, ticking once a second. Null when there's no ETA.
 *
 * @example
 * ```svelte
 * const secondsLeft = etaCountdown(tracker);
 * <p>{$secondsLeft === null ? '' : `${Math.ceil($secondsLeft / 60)} min away`}</p>
 * ```
 */
export function etaCountdown(source: Readable<TaskTrackerState> | Readable<TrackedEta | null>): Readable<number | null> {
  const eta = derived(source, (value: TaskTrackerState | TrackedEta | null) =>
    value && 'taskId' in value ? value.eta : (value as TrackedEta | null),
  );
  const now = readable(Date.now(), (set) => {
    const timer = setInterval(() => set(Date.now()), 1000);
    return () => clearInterval(timer);
  });
  return derived([eta, now], ([value, at]) =>
    value ? Math.max(0, Math.round((Date.parse(value.arrivesAt) - at) / 1000)) : null,
  );
}
