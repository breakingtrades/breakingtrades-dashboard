/**
 * components/collapsible.js — Collapsible sections with persistent state
 */
(function() {
  'use strict';

  BT.components = BT.components || {};

  BT.components.collapsible = {
    /**
     * Make a section collapsible.
     * @param {string} sectionId - e.g. 'market:heatmap'
     * @param {HTMLElement} headerEl - The section header (gets chevron + click handler)
     * @param {HTMLElement} bodyEl - The section body (gets collapsed/expanded)
     * @returns {{ destroy: Function }}
     */
    init: function(sectionId, headerEl, bodyEl) {
      if (!headerEl || !bodyEl) return { destroy: function() {} };

      // Add collapsible classes
      headerEl.classList.add('section-header-collapsible');
      bodyEl.classList.add('section-body-collapsible');

      // Add chevron icon
      var chevron = document.createElement('i');
      chevron.setAttribute('data-lucide', 'chevron-down');
      chevron.className = 'collapse-chevron';
      headerEl.appendChild(chevron);

      // Read saved state
      var collapsed = BT.preferences.getPref('collapsedSections.' + sectionId) || false;

      function applyState(isCollapsed, animate) {
        if (isCollapsed) {
          headerEl.classList.add('collapsed');
          bodyEl.classList.add('collapsed');
        } else {
          headerEl.classList.remove('collapsed');
          bodyEl.classList.remove('collapsed');
        }
      }

      // Apply initial state without animation
      if (collapsed) {
        bodyEl.style.transition = 'none';
        applyState(true, false);
        // Re-enable transitions after a tick
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            bodyEl.style.transition = '';
          });
        });
      }

      // Click handler
      function onClick(e) {
        // Don't toggle if clicking a link or button inside header
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;

        var isCollapsed = headerEl.classList.contains('collapsed');
        var newState = !isCollapsed;
        applyState(newState, true);
        BT.preferences.setPref('collapsedSections.' + sectionId, newState);
      }

      headerEl.addEventListener('click', onClick);

      // Render the chevron icon
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { class: 'lucide' }, nameAttr: 'data-lucide' });
      }

      return {
        destroy: function() {
          headerEl.removeEventListener('click', onClick);
          headerEl.classList.remove('section-header-collapsible', 'collapsed');
          bodyEl.classList.remove('section-body-collapsible', 'collapsed');
          if (chevron.parentNode) chevron.parentNode.removeChild(chevron);
        }
      };
    }
  };
})();
