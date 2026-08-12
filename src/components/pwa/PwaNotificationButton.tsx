'use client';

import { BellRing, Download, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function decodeBase64Url(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

export default function PwaNotificationButton() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setMessage('Gunakan menu browser “Add to Home Screen” untuk memasang LMS.');
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage('Aplikasi LMS siap dipakai dari home screen.');
  };

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('Browser ini belum mendukung notifikasi push.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const keyResponse = await fetch('/api/push/vapid-public-key');
      const keyData = await keyResponse.json();
      if (!keyData.enabled || !keyData.publicKey) throw new Error('Notifikasi push belum dikonfigurasi di server.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.');
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
      if (!response.ok) throw new Error('Subscription notifikasi belum berhasil disimpan.');
      setPushEnabled(true);
      setMessage('Notifikasi aktif di perangkat ini.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Notifikasi belum berhasil diaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-icon btn-ghost"
        aria-label="Install LMS dan atur notifikasi"
        title="Install LMS dan atur notifikasi"
        onClick={() => setOpen((value) => !value)}
      >
        <BellRing size={18} />
      </button>
      {open ? (
        <div className="pwa-menu" role="dialog" aria-label="Pengaturan aplikasi LMS">
          <div className="pwa-menu-title">Aplikasi Clevio LMS</div>
          <p className="pwa-menu-copy">Pasang LMS di HP dan aktifkan push agar tahu saat WhatsApp logout.</p>
          <button type="button" className="pwa-menu-action" onClick={install}><Download size={15} /> Pasang di HP</button>
          <button type="button" className="pwa-menu-action primary" onClick={enablePush} disabled={busy || pushEnabled}>
            <BellRing size={15} /> {busy ? 'Mengaktifkan...' : pushEnabled ? 'Notifikasi aktif' : 'Aktifkan notifikasi'}
          </button>
          {message ? <p className="pwa-menu-message" role="status">{message}</p> : null}
          <button type="button" className="pwa-menu-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={14} /></button>
        </div>
      ) : null}
      <style>{`
        .pwa-menu { position: absolute; z-index: 1000; top: calc(100% + 10px); right: 0; width: min(320px, calc(100vw - 28px)); padding: 16px; border: 1px solid #dce5f1; border-radius: 14px; background: #fff; box-shadow: 0 16px 40px rgba(24, 47, 91, .16); }
        .pwa-menu-title { color: #152d64; font-size: 14px; font-weight: 800; }
        .pwa-menu-copy { margin: 7px 0 13px; color: #637493; font-size: 12px; line-height: 1.5; }
        .pwa-menu-action { display: flex; width: 100%; align-items: center; justify-content: center; gap: 7px; min-height: 38px; margin-top: 8px; border: 1px solid #d4dfef; border-radius: 9px; background: #f7faff; color: #203a79; font-size: 12px; font-weight: 750; cursor: pointer; }
        .pwa-menu-action.primary { border-color: #22367b; background: #22367b; color: #fff; }
        .pwa-menu-action:disabled { cursor: default; opacity: .55; }
        .pwa-menu-message { margin: 10px 0 0; color: #26734d; font-size: 11px; line-height: 1.4; }
        .pwa-menu-close { position: absolute; top: 9px; right: 9px; display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #789; cursor: pointer; }
        @media (max-width: 640px) { .pwa-menu { position: fixed; top: 62px; right: 14px; } }
      `}</style>
    </div>
  );
}
