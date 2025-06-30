# Scripts Documentation

This directory contains various utility scripts for the Duve Helper application.

## Daily Task Scripts

### `test-daily.ts`
Runs the daily task manually for testing purposes.
```bash
npx tsx scripts/test-daily.ts
```

## Failed Lock Update Scripts

When lock code updates fail during the daily task, they are automatically logged to `logs/failed-lock-updates.json`. The following scripts help manage these failures:

### `view-failed-locks.ts`
Displays all failed lock updates without attempting to retry them.
```bash
npx tsx scripts/view-failed-locks.ts
```

**Output example:**
```
=== Failed Lock Updates (2 total) ===

1. 123 Main St, New York - John Doe
   Reservation ID: abc123
   Lock ID: 5703050
   Duve ID: cmcjfragk00pu070w964sln4r
   Dates: 1/15/2024 - 1/17/2024
   Error: Lock code update failed
   Failed at: 1/14/2024, 10:30:45 AM

💡 To retry these failed locks, run: npx tsx scripts/retry-failed-locks.ts
```

### `retry-failed-locks.ts`
Attempts to retry all failed lock updates with new codes.
```bash
npx tsx scripts/retry-failed-locks.ts
```

**Features:**
- Generates new lock codes for each retry
- Skips locks with "unknown" lockId (cannot be retried)
- Provides detailed progress and results
- Saves retry results to `logs/retry-results.json`
- Updates the failed locks file to remove successfully retried locks

**Output example:**
```
Found 2 failed lock updates to retry...

Retrying lock update for: 123 Main St, New York - John Doe
Lock ID: 5703050, Reservation ID: abc123
✅ Successfully retried lock code update

Retrying lock update for: 456 Oak Ave, Boston - Jane Smith
Lock ID: 7706256, Reservation ID: def456
❌ Failed to retry lock code update

=== Retry Summary ===
Total attempted: 2
Successful: 1
Failed: 1
Results saved to: logs/retry-results.json
Updated failed locks file - 1 locks still failed
```

## File Structure

```
logs/
├── failed-lock-updates.json    # Failed lock updates from daily task
└── retry-results.json          # Results from retry attempts
```

## Daily Task Summary

The daily task now provides a detailed summary including:
- Total reservations processed
- Number of lock code update failures
- Number of successful lock code updates
- Instructions for retrying failed updates

**Example output:**
```
=== Daily Task Summary ===
Total reservations processed: 11
Lock code update failures: 1
Successful lock code updates: 10
⚠️  1 lock code updates failed. Check logs/failed-lock-updates.json for details.
💡 Run 'npx tsx scripts/retry-failed-locks.ts' to retry failed lock updates.
```

## Logging Details

Failed lock updates include:
- Reservation ID and Duve ID
- Lock ID
- Full property address
- Guest name
- Check-in and check-out dates
- Error message
- Timestamp of failure

This information helps with debugging and provides context for retry attempts. 