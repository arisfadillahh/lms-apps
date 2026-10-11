'use client';

import { BellRing, Download, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Role = 'COACH' | 'CODER';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function decodeBase64Url(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobileDevice() {
  return window.matchMedia('(max-width: 767px)').matches &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
}

export default function MobilePwaOnboardingCard({ role }: { role: Role }) {
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const phase = standalone ? 'notification' : 'install';
  const dismissKey = `clevio-pwa-onboarding-${role.toLowerCase()}-${phase}`;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateDeviceState = () => {
      setMobile(isMobileDevice());
      setStandalone(isStandaloneMode());
      setIos(isIosDevice());
      setPermission('Notification' in window ? Notification.permission : 'denied');
    };
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setMessage('Clevio LMS sudah terpasang. Buka dari home screen untuk pengalaman aplikasi penuh.');
    };

    updateDeviceState();
    setReady(true);
    media.addEventListener('change', updateDeviceState);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    navigator.serviceWorker?.register('/sw.js').catch(() => undefined);
    return () => {
      media.removeEventListener('change', updateDeviceState);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const dismissedAt = Number(localStorage.getItem(dismissKey) || 0);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    setDismissed(dismissedAt > 0 && Date.now() - dismissedAt < sevenDays);
  }, [dismissKey, ready]);

  const copy = useMemo(() => role === 'COACH'
    ? {
        installTitle: 'Jadikan LMS lebih praktis',
        installBody: 'Pasang Clevio LMS agar dashboard, jadwal, trial, dan penilaian terasa seperti aplikasi.',
        notificationTitle: 'Aktifkan pengingat Coach',
        notificationBody: 'Dapatkan pengingat jadwal, assignment trial, tugas penilaian, dan revisi penting.',
      }
    : {
        installTitle: 'Bawa LMS ke home screen',
        installBody: 'Pasang Clevio LMS agar materi, tugas, rapor, dan jadwal kelas lebih cepat dibuka.',
        notificationTitle: 'Jangan lewatkan kelasmu',
        notificationBody: 'Dapatkan pengingat kelas H-1 dan satu jam sebelum mulai, tugas, feedback, dan rapor.',
      }, [role]);

  const dismiss = () => {
    localStorage.setItem(dismissKey, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    setMessage(null);
    if (ios && !installPrompt) {
      setGuideOpen(true);
      return;
    }
    if (!installPrompt) {
      setMessage('Buka menu browser lalu pilih “Install app” atau “Add to Home Screen”.');
      return;
    }
    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        setMessage('Instalasi dimulai. Buka Clevio LMS dari home screen setelah selesai.');
      }
    } finally {
      setBusy(false);
    }
  };

  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('Perangkat ini belum mendukung notifikasi aplikasi.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const keyResponse = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      const keyData = await keyResponse.json();
      if (!keyData.enabled || !keyData.publicKey) throw new Error('Notifikasi belum tersedia di server.');
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        throw new Error('Izin notifikasi belum diberikan. Anda dapat mengubahnya dari pengaturan perangkat.');
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(keyData.publicKey),
      });
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error('Perangkat belum berhasil didaftarkan untuk notifikasi.');
      setMessage('Notifikasi aktif. Pengingat penting akan masuk ke perangkat ini.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Notifikasi belum berhasil diaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !mobile || dismissed) return null;
  if (standalone && permission === 'granted') return null;
  if (standalone && permission === 'denied') return null;

  const notificationPhase = standalone;
  return (
    <>
      <section className={`mobile-pwa-card mobile-pwa-card--${role.toLowerCase()}`} aria-label="Pengaturan aplikasi Clevio LMS">
        <div className="mobile-pwa-card__icon" aria-hidden="true">
          {notificationPhase ? <BellRing size={22} /> : <Smartphone size={22} />}
        </div>
        <div className="mobile-pwa-card__content">
          <h2>{notificationPhase ? copy.notificationTitle : copy.installTitle}</h2>
          <p>{notificationPhase ? copy.notificationBody : copy.installBody}</p>
          {message ? <p className="mobile-pwa-card__message" role="status">{message}</p> : null}
        </div>
        <button
          type="button"
          className="mobile-pwa-card__action"
          onClick={notificationPhase ? enableNotifications : install}
          disabled={busy}
        >
          {notificationPhase ? <BellRing size={16} /> : <Download size={16} />}
          {busy ? 'Memproses...' : notificationPhase ? 'Aktifkan' : 'Pasang'}
        </button>
        <button type="button" className="mobile-pwa-card__dismiss" onClick={dismiss} aria-label="Ingatkan nanti">
          <X size={16} />
        </button>
      </section>

      {guideOpen ? (
        <div className="pwa-ios-guide" role="dialog" aria-modal="true" aria-labelledby="pwa-ios-title" onClick={() => setGuideOpen(false)}>
          <div className="pwa-ios-guide__sheet" onClick={(event) => event.stopPropagation()}>
            <div className="pwa-ios-guide__handle" aria-hidden="true" />
            <button type="button" className="pwa-ios-guide__close" onClick={() => setGuideOpen(false)} aria-label="Tutup petunjuk"><X size={18} /></button>
            <Share2 size={28} className="pwa-ios-guide__share" />
            <h2 id="pwa-ios-title">Pasang Clevio LMS di iPhone</h2>
            <ol>
              <li>Tekan tombol <strong>Bagikan</strong> di Safari.</li>
              <li>Pilih <strong>Add to Home Screen</strong>.</li>
              <li>Tekan <strong>Add</strong>, lalu buka LMS dari home screen.</li>
            </ol>
            <button type="button" className="pwa-ios-guide__done" onClick={() => setGuideOpen(false)}>Mengerti</button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .mobile-pwa-card { display: none; }
        @media (max-width: 767px) {
          .mobile-pwa-card {
            position: relative;
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr);
            gap: 10px 12px;
            width: 100%;
            margin: 0 0 20px;
            padding: 14px 42px 14px 14px;
            border: 1px solid #cddcf0;
            border-radius: 8px;
            background: #ffffff;
            color: #152d64;
            box-shadow: 0 8px 24px rgba(29, 55, 104, .08);
          }
          .mobile-pwa-card__icon {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            border-radius: 8px;
            background: #eaf5ff;
            color: #087eb8;
          }
          .mobile-pwa-card__content { min-width: 0; }
          .mobile-pwa-card__content h2 { margin: 1px 0 4px; font-size: 14px; line-height: 1.25; font-weight: 800; letter-spacing: 0; }
          .mobile-pwa-card__content p { margin: 0; color: #60708e; font-size: 11px; line-height: 1.5; letter-spacing: 0; }
          .mobile-pwa-card__message { margin-top: 7px !important; color: #22704d !important; font-weight: 700; }
          .mobile-pwa-card__action {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 40px;
            padding: 0 14px;
            border: 0;
            border-radius: 8px;
            background: #22367b;
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
          }
          .mobile-pwa-card--coach .mobile-pwa-card__action { background: #008f68; }
          .mobile-pwa-card__action:disabled { opacity: .6; cursor: wait; }
          .mobile-pwa-card__dismiss {
            position: absolute;
            top: 8px;
            right: 8px;
            display: grid;
            place-items: center;
            width: 28px;
            height: 28px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: transparent;
            color: #71809b;
          }
          [data-coder-theme='dark'] .mobile-pwa-card {
            border-color: #314d70;
            background: #142941;
            color: #f4f8ff;
            box-shadow: none;
          }
          [data-coder-theme='dark'] .mobile-pwa-card__icon { background: #193a57; color: #5ddcff; }
          [data-coder-theme='dark'] .mobile-pwa-card__content p { color: #b7c7dc; }
          [data-coder-theme='dark'] .mobile-pwa-card__dismiss { color: #b7c7dc; }
        }
        .pwa-ios-guide {
          position: fixed;
          inset: 0;
          z-index: 1000000;
          display: flex;
          align-items: flex-end;
          background: rgba(7, 18, 38, .58);
          backdrop-filter: blur(5px);
        }
        .pwa-ios-guide__sheet {
          position: relative;
          width: 100%;
          max-height: min(82dvh, 620px);
          overflow-y: auto;
          padding: 26px 22px calc(22px + env(safe-area-inset-bottom));
          border-radius: 18px 18px 0 0;
          background: #ffffff;
          color: #152d64;
        }
        .pwa-ios-guide__handle { position: absolute; top: 9px; left: 50%; width: 38px; height: 4px; border-radius: 4px; background: #d7deea; transform: translateX(-50%); }
        .pwa-ios-guide__close { position: absolute; top: 15px; right: 16px; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: #eef3f9; color: #435573; }
        .pwa-ios-guide__share { color: #087eb8; }
        .pwa-ios-guide h2 { margin: 14px 0 12px; font-size: 20px; line-height: 1.25; font-weight: 850; letter-spacing: 0; }
        .pwa-ios-guide ol { margin: 0; padding-left: 22px; color: #526583; font-size: 14px; line-height: 1.65; }
        .pwa-ios-guide__done { width: 100%; min-height: 46px; margin-top: 20px; border: 0; border-radius: 8px; background: #22367b; color: #fff; font-size: 14px; font-weight: 800; }
      `}</style>
    </>
  );
}
