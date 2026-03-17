## ADDED Requirements

### Requirement: 7 card layouts by trade status
The system SHALL render cards in one of 7 visual variants based on the `status` field, as defined in `docs/UX_DESIGN_SPEC.md` §8.

#### Scenario: RETEST card (expanded)
- **WHEN** a setup has `status: "RETEST"`
- **THEN** the card is expanded with a pulsing left border (cyan→orange), shows retest level chip ("SMA50 RETEST"), confidence badge, volume health indicator, and confluence badge if applicable. Height: ~140px.

#### Scenario: APPROACHING card (expanded)
- **WHEN** a setup has `status: "APPROACHING"`
- **THEN** the card is expanded with a range bar showing price position relative to the approaching level, distance percentage, and target level name. Height: ~120px.

#### Scenario: ACTIVE card (standard)
- **WHEN** a setup has `status: "ACTIVE"` or `"TRAILING"`
- **THEN** the card shows a range bar (entry→current→target), current P&L percentage, and an "OVERBOUGHT" warning badge if RSI > 70.

#### Scenario: EXIT_SIGNAL card (warning-prominent)
- **WHEN** a setup has status starting with `EXIT_`
- **THEN** the card has a red left border, shows exit level prominently (e.g., "Below SMA20: $262.45"), and the warning banner fills the top of the card.

#### Scenario: WATCHING card (compact)
- **WHEN** a setup has `status: "WATCHING"`
- **THEN** the card is compact (2 lines: ticker+bias+RSI on line 1, SMA20+SMA50 on line 2). Height: ~60px.

#### Scenario: STOPPED card (dimmed)
- **WHEN** a setup has `status: "STOPPED"`
- **THEN** the card has 60% opacity, strikethrough on ticker name, and shows stop loss hit price.

#### Scenario: DORMANT card (ultra-compact)
- **WHEN** a setup has `status: "DORMANT"`
- **THEN** the card is a single line showing only ticker, bias dot, and price. Height: ~32px.

### Requirement: Status badge colors match design tokens
The system SHALL use these exact colors for status badges: RETEST=`#ff6b35`, APPROACHING=`#ffa726`, ACTIVE=`#00d4aa`, TRAILING=`#00d4aa`, TARGET_HIT=`#ffd700`, EXIT_*=`#ff4757`, WATCHING=`#8e8ea0`, STOPPED=`#ff4757`, DORMANT=`#4a4a5a`.

#### Scenario: Badge rendering
- **WHEN** any card renders a status badge
- **THEN** the badge background uses the color defined above with 15% opacity, and the text uses the full color

### Requirement: Confluence zone display
The system SHALL display a special "CONFLUENCE" badge on cards where `confluence: true`, showing the converging level names (e.g., "SMA20 + SMA50 + W20").

#### Scenario: Confluence badge on retest card
- **WHEN** a RETEST card has `confluence: true` with `confluence_levels: ["SMA20", "SMA50", "W20"]`
- **THEN** a gold-colored "⚡ CONFLUENCE: SMA20 + SMA50 + W20" badge appears below the retest level chip
