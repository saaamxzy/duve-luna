# Scripts Documentation

This directory contains various utility scripts for the Duve Helper application.

## Daily Task Scripts

### `test-daily.ts`
Runs the daily task manually for testing purposes.
```bash
npx tsx scripts/test-daily.ts
```

## Lock Profile Management

The lock profile system has been integrated into the daily task. Lock profiles and keyboard passwords are automatically refreshed at the beginning of each daily task run.

### `refresh-lock-profiles.ts`
Manually refreshes all lock profile data (equivalent to running clear-lock-profiles.ts, populate-lock-profiles.ts, and populate-keyboard-passwords.ts in sequence).

```bash
npx tsx scripts/refresh-lock-profiles.ts
```

**Features:**
- Clears all existing lock profiles and keyboard passwords
- Fetches latest lock data from Sifely API
- Populates lock profiles with current lock information
- Fetches and stores keyboard passwords for each lock
- Integrated logging with [LockProfileManager] prefix

**Note:** This process is automatically run at the beginning of each daily task, so manual execution is typically only needed for debugging or testing purposes.

### Legacy Scripts (Still Available)

The following individual scripts are still available for debugging purposes:

#### `clear-lock-profiles.ts`
Clears all lock profiles and keyboard passwords from the database.
```bash
npx tsx scripts/clear-lock-profiles.ts
```

#### `populate-lock-profiles.ts`
Fetches locks from the Sifely API and populates the lock profiles table.
```bash
npx tsx scripts/populate-lock-profiles.ts
```

#### `populate-keyboard-passwords.ts`
Fetches keyboard passwords for all locks and populates the keyboard passwords table.
```bash
npx tsx scripts/populate-keyboard-passwords.ts
```

**Migration Note:** Instead of running these three scripts separately, use `refresh-lock-profiles.ts` or let the daily task handle it automatically.

## Failed Lock Update Scripts

When lock code updates fail during the daily task, they are automatically logged to the database. The following scripts help manage these failures:

### `view-failed-locks.ts`
Displays all failed lock updates without attempting to retry them.
```bash
npx tsx scripts/view-failed-locks.ts
```

**Features:**
- Reads failed lock updates from the database (primary source)
- Fallback to file system for backward compatibility
- Works in serverless environments (Vercel, AWS Lambda, etc.)

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
- Reads failed lock updates from the database (primary source)
- Generates new lock codes for each retry
- Skips locks with "unknown" lockId (cannot be retried)
- Provides detailed progress and results
- Removes successfully retried locks from the database
- Fallback to file system for backward compatibility
- Works in serverless environments (Vercel, AWS Lambda, etc.)

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
Database updated - 1 locks still failed
```

## Serverless Environment Support

The failed lock update system now works seamlessly in serverless environments:

- **Database-first approach**: Failed locks are stored in the database
- **File system fallback**: Maintains backward compatibility with existing file-based logs
- **Automatic detection**: Skips file operations in serverless environments (Vercel, AWS Lambda, etc.)
- **No file system errors**: Prevents `ENOENT` errors in read-only file systems

## File Structure

```
logs/                            # Only used in non-serverless environments
├── failed-lock-updates.json    # Fallback storage for failed lock updates
└── retry-results.json          # Results from retry attempts (file-based only)
```

**Note**: In serverless environments, all failed lock data is stored in the database, eliminating the need for file system access.

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

## Manual Lock Update Script

### `manual-lock-update.ts`
A debugging script that allows manual lock code updates with extensive logging for troubleshooting issues.

```bash
# Interactive mode (prompts for all parameters)
npx tsx scripts/manual-lock-update.ts

# Command line mode with all parameters
npx tsx scripts/manual-lock-update.ts --lockId 1234567 --passcode 9876 --startDate 2024-01-15 --endDate 2024-01-17

# With optional Duve ID
npx tsx scripts/manual-lock-update.ts -l 1234567 -p 9876 -s "2024-01-15 15:00" -e "2024-01-17 11:00" -d cmcjfragk00pu070w964sln4r

# Skip Duve update (for debugging)
npx tsx scripts/manual-lock-update.ts --lockId 1234567 --passcode 9876 --startDate 2024-01-15 --endDate 2024-01-17 --skipDuveUpdate

# Show help
npx tsx scripts/manual-lock-update.ts --help
```

**Features:**
- **Interactive Mode**: Prompts for all required parameters step-by-step
- **Command Line Mode**: Accepts all parameters via command line arguments
- **Extensive Debugging**: Shows detailed information about lock profiles, keyboard passwords, and API responses
- **Validation**: Validates passcode format and date ranges before attempting update
- **Confirmation**: Requires user confirmation before making changes
- **Verification**: Shows before and after state of the lock profile
- **Optional Duve Update**: Can skip Duve reservation updates for debugging purposes

**Parameters:**
- `--lockId, -l`: Lock ID from the lock system (required)
- `--passcode, -p`: 4-digit passcode (required, # prefix optional)
- `--startDate, -s`: Start date in YYYY-MM-DD or YYYY-MM-DD HH:MM format (required)
- `--endDate, -e`: End date in YYYY-MM-DD or YYYY-MM-DD HH:MM format (required)
- `--duveId, -d`: Duve reservation ID (optional, will use linked reservation if available)
- `--skipDuveUpdate`: Skip updating Duve reservation (optional flag)

**Output example:**
```
🔧 Manual Lock Update Script Started
⏰ Current time: 2024-01-14T10:30:45.123Z

🔍 STEP 1: Validating lock profile...

🔍 Fetching lock profile details for lockId: 1234567
✅ Lock Profile Found:
   - ID: clr123abc456def789
   - Property: 123 Main St - A1
   - Street Number: 123
   - Lock Name: A1
   - Current Lock Code: #1234
   - Created: 2024-01-01T12:00:00.000Z
   - Updated: 2024-01-10T15:30:00.000Z
   - Linked Reservation: clr789xyz123abc456
   - Guest: John Doe
   - Duve ID: cmcjfragk00pu070w964sln4r
   - Check-in: 2024-01-15T19:00:00.000Z
   - Check-out: 2024-01-17T15:00:00.000Z
   - Keyboard Passwords Found: 2
     1. ID: 98765, Name: "Guest Code 1"
        Code: 1234, Status: 1
        Start: 2024-01-15T19:00:00.000Z
        End: 2024-01-17T15:00:00.000Z
        Version: 1, Type: 1

🔍 STEP 2: Logging update attempt details...

📝 UPDATE ATTEMPT DETAILS:
   - Lock ID: 1234567
   - New Passcode: 9876
   - Start Date: 2024-01-15T19:00:00.000Z
   - End Date: 2024-01-17T15:00:00.000Z
   - Duve ID: cmcjfragk00pu070w964sln4r
   - Timezone: UTC (times will be adjusted for EDT check-in/out)

Proceed with lock update? (y/N): y

🚀 STEP 3: Attempting lock code update...
⏱️  Update completed in 1250ms
✅ LOCK UPDATE SUCCESSFUL!

🔍 STEP 4: Verifying changes...
[Shows updated lock profile details]

🔌 Disconnecting from database...
✅ Script completed
```

**Use Cases:**
- **Debugging Failed Updates**: Test lock updates manually when the daily task fails
- **Testing New Locks**: Verify lock connectivity and API functionality
- **Emergency Updates**: Manually update lock codes outside of the daily task schedule
- **Troubleshooting**: Get detailed information about lock profiles and their current state 