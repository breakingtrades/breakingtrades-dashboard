## 1. Extract Nav CSS

- [ ] 1.1 Create `css/nav.css` with all nav-related styles consolidated from index.html, watchlist.html, market.html (`.nav-bar`, `.nav-logo`, `.nav-links`, `.bt-logo-text`, search input, marquee strip, timezone selector, market status, mobile breakpoints)
- [ ] 1.2 Remove nav CSS from inline `<style>` blocks in all 3 HTML files
- [ ] 1.3 Add `<link rel="stylesheet" href="css/nav.css">` to all 3 HTML files

## 2. Create nav.js

- [ ] 2.1 Create `js/nav.js` that builds the full nav bar DOM: logo (`<a>` with SVG + `.bt-logo-text`), page links (Signals, Watchlist, Market), search input, ticker marquee container, market status container, timezone selector
- [ ] 2.2 Add active page detection — match `location.pathname` against link hrefs, apply `.active` class
- [ ] 2.3 Export/call `initTickerSearch()` after nav is mounted
- [ ] 2.4 Export/call market status + marquee init functions after nav is mounted
- [ ] 2.5 Call `renderNav()` on DOMContentLoaded targeting `<nav id="nav"></nav>`

## 3. Update HTML Pages

- [ ] 3.1 In index.html: replace inline nav HTML with `<nav id="nav"></nav>`, add `<script src="js/nav.js"></script>` before page-specific scripts
- [ ] 3.2 In watchlist.html: replace inline nav HTML with `<nav id="nav"></nav>`, add nav.js script tag
- [ ] 3.3 In market.html: replace inline nav HTML with `<nav id="nav"></nav>`, add nav.js script tag

## 4. Refactor ticker-search.js

- [ ] 4.1 Wrap ticker-search.js initialization in an exported `initTickerSearch()` function instead of self-executing on DOMContentLoaded
- [ ] 4.2 Ensure the modal overlay HTML is created by ticker-search.js if not present (since it may have been inline in index.html)

## 5. Refactor market-status.js

- [ ] 5.1 Wrap market-status.js in an exported `initMarketStatus()` function callable by nav.js
- [ ] 5.2 Ensure marquee/ticker strip init is callable after nav mount

## 6. Verify

- [ ] 6.1 Test all 3 pages render identical nav bars
- [ ] 6.2 Test search works on watchlist.html and market.html (autocomplete + TV overlay)
- [ ] 6.3 Test mobile (≤480px) shows icon-only logo on all pages
- [ ] 6.4 Test active page highlighting on each page
- [ ] 6.5 Commit and push, verify on GitHub Pages
