/* Goan Craving customer location permission prompt.
 * Browser location is requested only after the customer explicitly taps the button.
 * Coordinates are kept in sessionStorage for the current tab/session.
 */
(function () {
  'use strict';
  const SESSION_KEY = 'goanCravingLocationPrompted';
  const LOCATION_KEY = 'goanCravingCurrentLocation';

  function addStyles() {
    if (document.getElementById('gc-location-prompt-style')) return;
    const style = document.createElement('style');
    style.id = 'gc-location-prompt-style';
    style.textContent = `
      #gc-location-backdrop{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(4px)}
      #gc-location-dialog{width:min(440px,100%);padding:28px;border-radius:24px;background:#fffaf4;color:#24352b;box-shadow:0 24px 80px rgba(0,0,0,.25);font-family:system-ui,-apple-system,sans-serif}
      #gc-location-dialog .gc-location-icon{width:58px;height:58px;margin:0 auto 16px;border-radius:18px;display:grid;place-items:center;background:#e7f3e8;color:#286b4b;font-size:28px}
      #gc-location-dialog h2{margin:0 0 9px;text-align:center;font-size:22px;font-weight:800}
      #gc-location-dialog p{margin:0 0 20px;text-align:center;color:#647166;font-size:14px;line-height:1.55}
      #gc-location-dialog .gc-location-status{margin:0 0 14px;color:#a33d2e;font-size:13px;text-align:center}
      #gc-location-dialog button{width:100%;min-height:46px;margin-top:9px;border:0;border-radius:13px;font:700 14px system-ui;cursor:pointer}
      #gc-location-allow{background:#286b4b;color:#fff}
      #gc-location-manual{background:#edf1eb;color:#34483a}
      #gc-location-later{background:transparent;color:#69756c}
      #gc-location-dialog button:disabled{opacity:.6;cursor:wait}
    `;
    document.head.appendChild(style);
  }

  function showPrompt() {
    if (document.getElementById('gc-location-backdrop')) return;
    addStyles();
    const backdrop = document.createElement('div');
    backdrop.id = 'gc-location-backdrop';
    backdrop.innerHTML = `
      <section id="gc-location-dialog" role="dialog" aria-modal="true" aria-labelledby="gc-location-title">
        <div class="gc-location-icon" aria-hidden="true">⌖</div>
        <h2 id="gc-location-title">Find food near you</h2>
        <p>Allow Goan Craving to use your current location to show nearby restaurants and help set your delivery address.</p>
        <p class="gc-location-status" id="gc-location-status" role="status" aria-live="polite"></p>
        <button id="gc-location-allow" type="button">Allow location</button>
        <button id="gc-location-manual" type="button">Enter address manually</button>
        <button id="gc-location-later" type="button">Not now</button>
      </section>`;
    document.body.appendChild(backdrop);

    const status = document.getElementById('gc-location-status');
    const allow = document.getElementById('gc-location-allow');
    const remove = () => backdrop.remove();
    document.getElementById('gc-location-later').addEventListener('click', remove);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) remove(); });

    document.getElementById('gc-location-manual').addEventListener('click', () => {
      remove();
      window.dispatchEvent(new CustomEvent('goan:location-manual-entry'));
      const addressField = document.querySelector('[name="deliveryAddress"], [name="address"], #deliveryAddress, #address');
      if (addressField) {
        addressField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        addressField.focus({ preventScroll: true });
      } else {
        window.location.href = '/account';
      }
    });

    allow.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        status.textContent = 'Location is not supported by this browser. Please enter your address manually.';
        return;
      }
      allow.disabled = true;
      allow.textContent = 'Getting your location…';
      status.textContent = '';
      navigator.geolocation.getCurrentPosition(position => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString()
        };
        try { sessionStorage.setItem(LOCATION_KEY, JSON.stringify(location)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('goan:location', { detail: location }));
        status.style.color = '#286b4b';
        status.textContent = 'Location received. You can now choose this as your delivery location.';
        allow.textContent = 'Location enabled';
        setTimeout(remove, 1100);
      }, error => {
        allow.disabled = false;
        allow.textContent = 'Try again';
        if (error.code === error.PERMISSION_DENIED) {
          status.textContent = 'Location permission was denied. Allow it in your browser site settings, or enter your address manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          status.textContent = 'Your device location is unavailable or turned off. Enable location services and try again.';
        } else {
          status.textContent = 'Location request timed out. Check that device location is enabled and try again.';
        }
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
  }

  function initialize() {
    if (window.__BLOGIFY_CURRENT_USER_ID === undefined || !window.__BLOGIFY_CURRENT_USER_ID) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (_) {}
    // Avoid presenting over authentication screens or during another modal.
    if (/\/user\/(signin|signup)/.test(window.location.pathname)) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showPrompt, { once: true });
    } else {
      showPrompt();
    }
  }

  initialize();
  window.GoanCravingLocation = {
    getCurrent: function () {
      try { return JSON.parse(sessionStorage.getItem(LOCATION_KEY) || 'null'); }
      catch (_) { return null; }
    },
    request: function () { showPrompt(); }
  };
})();