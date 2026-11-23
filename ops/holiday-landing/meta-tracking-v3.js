// Holiday funnel revision: wait for the Pixel runtime before navigating.
(() => {
  const pixelId = '710028324574763';
  const consentKey = 'clevio-holiday-analytics';
  const banner = document.querySelector('#holiday-measurement');
  let enabled = false;
  let initialized = false;
  const query = new URLSearchParams(location.search);
  const cookie = name => document.cookie.split('; ').find(row => row.startsWith(name + '='))?.slice(name.length + 1);
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('clevio-holiday-attribution') || '{}'); } catch {}
  for (const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid']) {
    if (query.get(name)) saved[name] = query.get(name).slice(0, name === 'fbclid' ? 500 : 200);
  }
  if (query.get('fbclid')) saved.fbc = 'fb.1.' + Date.now() + '.' + query.get('fbclid').slice(0,500);
  try { sessionStorage.setItem('clevio-holiday-attribution', JSON.stringify(saved)); } catch {}
  window.clevioHolidayAttribution = () => ({ ...saved, ...(cookie('_fbp') ? {fbp:cookie('_fbp')}:{}), ...(cookie('_fbc') ? {fbc:cookie('_fbc')}:saved.fbc ? {fbc:saved.fbc}:{}) });
  const sent = new Set();
  window.clevioTrackHolidayRegistration = async eventId => {
    if (!enabled || !/^[a-f0-9-]{36}$/i.test(eventId)) return false;
    if (sent.has(eventId)) return true;
    for (let n=0;n<15;n++) {
      if(sent.has(eventId))return true;
      if(window.fbq?.callMethod) {
        window.fbq('trackSingle',pixelId,'CompleteRegistration',{}, {eventID:eventId});
        sent.add(eventId);
        await new Promise(resolve=>setTimeout(resolve,200));
        return true;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
  };

  function startPixel() {
    if (enabled) return;
    enabled = true;
    if (!window.fbq) {
      const pixel = function (...args) {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      };
      pixel.queue = [];
      pixel.push = pixel;
      pixel.loaded = true;
      pixel.version = '2.0';
      window.fbq = pixel;
      window._fbq = pixel;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
    if (!initialized) {
      window.fbq('set', 'autoConfig', false, pixelId);
      window.fbq('init', pixelId);
      initialized = true;
    } else {
      window.fbq('consent', 'grant');
    }
    window.fbq('trackSingle', pixelId, 'PageView');
  }

  function choose(allowed) {
    try { localStorage.setItem(consentKey, allowed ? 'yes' : 'no'); } catch {}
    banner.close();
    if (allowed) startPixel();
    else if (enabled) {
      enabled = false;
      window.fbq('consent', 'revoke');
    }
  }

  banner.querySelector('[data-measurement-allow]').addEventListener('click', () => choose(true));
  banner.querySelector('[data-measurement-deny]').addEventListener('click', () => choose(false));
  document.querySelector('[data-measurement-settings]').addEventListener('click', () => banner.show());
  let preference;
  try { preference = localStorage.getItem(consentKey); } catch {}
  if (preference !== 'no') startPixel();

  document.addEventListener('clevio:holiday-class', ({ detail }) => {
    if (!enabled) return;
    if (detail?.name === 'whatsapp_click') {
      window.fbq('trackSingle', pixelId, 'Contact', { contact_method: 'whatsapp' });
    }
    if (detail?.name === 'registration_completed' && /^[a-f0-9-]{36}$/i.test(detail.eventId)) {
      void window.clevioTrackHolidayRegistration(detail.eventId);
    }
  });
})();
