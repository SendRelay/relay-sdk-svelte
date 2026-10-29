# @relay-sdk/svelte

Official [Relay](https://sendrelay.com.ng) Svelte bindings: show a delivery's status, the rider on a map and a live arrival time with one store. Svelte 4 and 5, SvelteKit.

```bash
npm install @relay-sdk/svelte
```

```svelte
<script lang="ts">
  import { RelayRealtimeClient, etaCountdown, taskTracker } from '@relay-sdk/svelte';

  export let taskId: string;

  // Your server mints the token with its API key (relay.auth.createWebSocketToken).
  const relay = new RelayRealtimeClient({ getToken: (taskIds) => fetchTrackingToken(taskIds) });
  const tracker = taskTracker(relay, taskId);
  const secondsLeft = etaCountdown(tracker);
</script>

<p>
  {$tracker.status ?? 'Finding a rider'}
  {#if $secondsLeft !== null} · arriving in {Math.ceil($secondsLeft / 60)} min{/if}
</p>
```

The store starts listening when the first subscriber arrives and stops after the last one leaves. Share one client with `setRelayClient(relay)` in a layout and `getRelayClient()` below it. In SvelteKit, create the client in the browser only.

Everything from `@relay-sdk/sdk-browser` is re-exported. [Full documentation](https://docs.sendrelay.com.ng/sdks/svelte-sdk)
