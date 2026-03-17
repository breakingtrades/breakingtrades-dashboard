## ADDED Requirements

### Requirement: FAB notification badge for new insights
The system SHALL display a red notification dot with count on the FAB when new proactive insights are available (detected during data refresh comparison).

#### Scenario: New retest detected
- **WHEN** the page refreshes data and a new ticker enters RETEST status that wasn't in RETEST before
- **THEN** the FAB shows a red badge with the count of new insights (e.g., "2")

#### Scenario: Badge cleared on chat open
- **WHEN** user opens the chat panel after a notification badge is showing
- **THEN** Tom's first message is the proactive insight, and the badge count resets to 0

### Requirement: Proactive insight message on chat open
The system SHALL auto-populate Tom's first message with the proactive insight when the chat opens after a notification.

#### Scenario: RETEST insight
- **WHEN** user opens chat and MSFT just entered RETEST status
- **THEN** Tom's first message reads: "Heads up — MSFT just triggered a RETEST of SMA20 at $400.10. [View MSFT →]"

#### Scenario: Status change insight
- **WHEN** a watched ticker changes from ACTIVE to EXIT_SMA20
- **THEN** Tom's proactive message warns: "⚠ AAPL closed below SMA20 ($262.45). Exit signal active. [View AAPL →]"

### Requirement: Compare previous and current data for change detection
The system SHALL store the last-loaded `setups.json` data in `sessionStorage` and compare against newly fetched data to detect status changes.

#### Scenario: Data refresh with changes
- **WHEN** `setups.json` is re-fetched (manually or via periodic refresh) and AMZN's status changed from APPROACHING to RETEST
- **THEN** the change is detected and added to the proactive insights queue

#### Scenario: No changes
- **WHEN** `setups.json` is re-fetched and no status fields changed
- **THEN** no notification badge appears
