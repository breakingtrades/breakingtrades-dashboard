## ADDED Requirements

### Requirement: Desktop 2-column layout
The system SHALL display a 2-column layout on desktop (≥1200px): left column (~70%) for filter bar + card grid, right column (~30%) for macro context, pair ratios, sector strength, and daily briefing.

#### Scenario: Desktop rendering
- **WHEN** viewport width is ≥ 1200px
- **THEN** the layout shows side-by-side columns with the right panel always visible

### Requirement: Tablet 1-column layout
The system SHALL collapse to a single column on tablet (768-1199px) with the right panel content moved above the card grid as a collapsible section.

#### Scenario: Tablet rendering
- **WHEN** viewport width is between 768px and 1199px
- **THEN** macro strip remains at top, right panel content collapses into an expandable section above cards

### Requirement: Mobile full-width with bottom nav
The system SHALL display a full-width single-column layout on mobile (<768px) with a fixed bottom tab bar for status group navigation, replacing the horizontal tab bar.

#### Scenario: Mobile rendering
- **WHEN** viewport width is < 768px
- **THEN** cards fill full width, filter bar becomes a collapsible dropdown, status groups move to a fixed bottom tab bar with icons

#### Scenario: Mobile swipe between tabs
- **WHEN** user swipes left/right on the card grid area on mobile
- **THEN** the active status tab advances/retreats (e.g., swipe left on "Hot" → switches to "Active")

### Requirement: Responsive breakpoints
The system SHALL use 4 breakpoints: 1440px (large desktop, max-width container), 1200px (desktop, 2-column threshold), 768px (tablet), 480px (mobile, smaller cards).

#### Scenario: Large desktop
- **WHEN** viewport is ≥ 1440px
- **THEN** content is centered in a max-width 1440px container with side margins

#### Scenario: Small mobile
- **WHEN** viewport is ≤ 480px
- **THEN** card font sizes reduce by 1 step, padding reduces to 8px, FAB size is 44px
