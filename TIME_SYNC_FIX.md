# Time Sync Fix - Court Timer Adjustments

## Problem
When admins adjusted court time using the +/- time buttons in the admin dashboard, the changes did not sync to TV displays on other devices. The timer would update locally on the admin's device but remain unchanged on TV displays.

## Root Cause
The issue was caused by the **suppress mechanism** in the state sync system:

1. When a device receives state updates via `refreshSharedState()`, it sets:
   - `suppressSharedPublishUntil = Date.now() + 3000` (3 seconds)
   - This prevents the device from immediately re-publishing the data it just received

2. The `publishSharedState()` function checks this flag:
   ```typescript
   if (Date.now() < suppressSharedPublishUntil) return;
   ```

3. **The problem:** If an admin adjusts the court time during this 3-second suppress window, the `publishSharedState()` call is blocked and the change never syncs to the server or other devices.

### Why This Happened
TV displays poll for updates every 5 seconds. After each poll:
- They apply the received data
- Set `suppressSharedPublishUntil` for 3 seconds
- If an admin clicks +30s or -30s during this window, the change is lost

This created a ~60% chance (3 out of 5 seconds) that a time adjustment wouldn't sync.

## Solution
Added a **force parameter** to bypass the suppress mechanism for critical admin actions:

### 1. Updated `publishSharedState` signature
```typescript
// Before
publishSharedState: () => Promise<void>;

// After
publishSharedState: (options?: { force?: boolean }) => Promise<void>;
```

### 2. Modified suppress check
```typescript
// Before
if (Date.now() < suppressSharedPublishUntil) return;

// After
if (!options?.force && Date.now() < suppressSharedPublishUntil) return;
```

### 3. Updated `persistMatch` to accept force option
```typescript
const persistMatch = async (updatedMatch: Match, options?: { force?: boolean }) => {
  await db.matches.put(updatedMatch);
  useClubStore.setState({
    matches: useClubStore.getState().matches.map((item) => 
      (item.id === updatedMatch.id ? updatedMatch : item)
    ),
  });
  await useClubStore.getState().publishSharedState({ force: options?.force });
};
```

### 4. Made timer functions force immediate sync
All timer-related admin actions now bypass the suppress:

```typescript
// Time adjustment (+/- buttons)
const adjustCourtTime = async (seconds: number) => {
  if (!match?.startedAt) return;
  const currentStart = new Date(match.startedAt).getTime();
  const newStart = new Date(currentStart - seconds * 1000).toISOString();
  await persistMatch({ ...match, startedAt: newStart, timerPausedAt: undefined }, { force: true });
};

// Reset warm-up timer
const resetWarmUp = async () => {
  if (!match) return;
  await persistMatch({ ...match, startedAt: new Date().toISOString(), timerPausedAt: undefined }, { force: true });
};

// Pause/unpause timer
const toggleTimerPause = async () => {
  if (!match?.startedAt) return;
  if (match.timerPausedAt) {
    const pauseDuration = Date.now() - new Date(match.timerPausedAt).getTime();
    const newStart = new Date(new Date(match.startedAt).getTime() + pauseDuration).toISOString();
    await persistMatch({ ...match, startedAt: newStart, timerPausedAt: undefined }, { force: true });
    return;
  }
  await persistMatch({ ...match, timerPausedAt: new Date().toISOString() }, { force: true });
};
```

## Files Modified
1. `apps/web/src/store/useClubStore.ts` - Added force parameter to publishSharedState
2. `apps/web/src/main.tsx` - Updated persistMatch and timer functions to use force: true

## How It Works Now
1. Admin clicks +30s button in AdminCourtCard
2. `adjustCourtTime()` is called
3. `persistMatch()` is called with `{ force: true }`
4. `publishSharedState({ force: true })` bypasses the suppress check
5. State is immediately POSTed to `/api/club-state`
6. TV displays poll within 5 seconds and receive the updated match.startedAt
7. `TvElapsedTimer` component re-renders with new time
8. All devices show the adjusted timer

## Verification Steps

### Setup (2 devices)
1. Device A: Open admin dashboard, authenticate
2. Device B: Open TV display mode
3. Device A: Start a match on any court

### Test Case 1: Basic Time Adjustment
1. Device A: Click "+30s" button on active court
2. Expected: Timer on Device A increases by 30 seconds immediately
3. Expected: Within 5 seconds, Device B timer also shows +30 seconds
4. Repeat with "-30s" button
5. Expected: Both devices sync the decrease

### Test Case 2: Rapid Adjustments
1. Device A: Click "+30s" three times quickly
2. Expected: Timer increases by 90 seconds total
3. Expected: Device B reflects all changes within 5 seconds
4. This tests that force publish works even during suppress windows

### Test Case 3: Pause/Unpause Sync
1. Device A: Click pause button
2. Expected: Both devices show paused state
3. Device A: Click pause again to unpause
4. Expected: Both devices resume timer

### Test Case 4: Reset Warm-Up
1. Device A: Click "Reset Warm-Up" button
2. Expected: Timer resets to 0:00 on both devices
3. Expected: Sync happens within 5 seconds

### Test Case 5: Multiple Courts
1. Start matches on 2+ courts
2. Adjust time on Court 1 from Device A
3. Adjust time on Court 2 from Device A
4. Expected: Device B shows both adjustments correctly
5. This verifies force publish doesn't interfere across courts

### Test Case 6: During TV Poll Window
1. Device B: Note the TV display poll (every 5 seconds)
2. Device A: Adjust time immediately after Device B polls
3. Expected: Next poll (within 5 seconds) shows the change
4. This was the primary failure case - now fixed

## Success Criteria
✅ Time adjustments sync to all devices within 5 seconds
✅ Multiple rapid adjustments all sync correctly
✅ Pause/unpause states sync immediately
✅ Reset warm-up syncs immediately
✅ No phantom time changes or lost updates
✅ Build completes without TypeScript errors

## Why This Design
- **Force flag is opt-in**: Most state changes still respect suppress to avoid publish storms
- **Only critical admin actions force**: Time adjustments, pause/unpause, reset need immediate sync
- **Backward compatible**: Existing code without force parameter works as before
- **TypeScript safe**: Optional parameter with proper type checking

## Related Code
- Timer display: `TvElapsedTimer` component (line 5822)
- Admin controls: `AdminCourtCard` component (line 1244)
- State management: `useClubStore` (apps/web/src/store/useClubStore.ts)
- Sync mechanism: `publishSharedState` and `refreshSharedState`
