# Monetization foundation

This branch adds the first reusable commercialization layer without coupling game logic to a specific Web game platform SDK.

## Local test

Run the static server:

```bash
npm run serve
```

Open the game with mock advertisements enabled:

```text
http://localhost:8080/?mockAds=1
```

The mock adapter asks whether a rewarded ad was completed and displays a blocking test interstitial. It never grants a reward when the mock rewarded ad is declined.

## Modules

- `src/platform.js`: platform-neutral adapter facade
- `src/analytics.js`: local event queue and forwarding event
- `src/storage.js`: persistent player and monetization metrics
- `src/monetization.js`: rewarded/interstitial orchestration and frequency policy
- `src/monetization-hooks.js`: integration with the existing tower-defense loop

A channel build should install its adapter before gameplay begins:

```javascript
GamePlatform.setAdapter({
  name: 'channel-name',
  async init(context) {},
  gameplayStart() {},
  gameplayStop() {},
  async showRewarded(placement, context) {
    return { completed: true };
  },
  async showInterstitial(placement, context) {
    return { completed: true };
  }
});
```

## Rewarded placements

### `revive`

- Offered after defeat
- Limited to once per run
- Restores 35% core armor
- Removes the three enemies closest to the core
- Does not grant anything when the ad is unavailable or incomplete

### `protocol_reroll`

- Offered in each protocol three-choice screen
- Limited to once per offer
- Replaces all three choices after a completed rewarded ad

## Interstitial policy

The `run_complete` interstitial is requested before restarting, subject to all of these controls:

- no interstitial after the first completed run
- at least two completed runs between interstitials
- at least 120 seconds between interstitials
- no interstitial within 60 seconds of a completed rewarded ad
- no gameplay interruption during an active wave

## Local data

Recent analytics events and profile counters are stored in `localStorage`.

```javascript
GameAnalytics.getEvents();
GameStorage.get();
GameMonetization.getPolicy();
```

The analytics layer also emits a `neon:analytics` browser event so a platform-specific analytics adapter can forward events without modifying combat code.

## Validation

```bash
npm run check
```

Real platform adapters, IDs and SDK scripts should be added only after the corresponding developer accounts and project credentials are available.
