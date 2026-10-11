'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function PwaStartupSplash() {
  const [standalone, setStandalone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone) return;
    setStandalone(true);

    const exitTimer = window.setTimeout(() => setExiting(true), 900);
    const removeTimer = window.setTimeout(() => setRemoved(true), 1240);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!standalone || removed) return null;

  return (
    <div className={`pwa-startup-splash${exiting ? ' is-exiting' : ''}`} aria-hidden="true">
      <div className="pwa-startup-grid" />
      <div className="pwa-startup-content">
        <div className="pwa-startup-logo-wrap">
          <Image
            className="pwa-startup-logo"
            src="/logo/innovator-camp-logo-dark.png"
            alt="Clevio Innovator Camp"
            width={420}
            height={210}
            priority
          />
        </div>
        <div className="pwa-startup-line"><span /></div>
        <div className="pwa-startup-status">Menyiapkan LMS</div>
        <div className="pwa-startup-dots"><i /><i /><i /></div>
      </div>

      <style>{`
        .pwa-startup-splash {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #f5f8fc;
          opacity: 1;
          transition: opacity .34s ease, visibility .34s ease;
        }
        .pwa-startup-splash.is-exiting {
          visibility: hidden;
          opacity: 0;
        }
        .pwa-startup-grid {
          position: absolute;
          inset: 0;
          opacity: .46;
          background-image: linear-gradient(rgba(34, 54, 123, .045) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 54, 123, .045) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
        }
        .pwa-startup-content {
          position: relative;
          display: flex;
          width: min(76vw, 340px);
          flex-direction: column;
          align-items: center;
          animation: pwaStartupLift .7s cubic-bezier(.2,.8,.2,1) both;
        }
        .pwa-startup-logo-wrap {
          display: grid;
          width: 100%;
          place-items: center;
          padding: 0 8px;
          animation: pwaStartupLogo .72s cubic-bezier(.2,.8,.2,1) both;
        }
        .pwa-startup-logo {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        .pwa-startup-line {
          width: 100%;
          height: 3px;
          margin-top: 22px;
          overflow: hidden;
          border-radius: 999px;
          background: #dce5f1;
        }
        .pwa-startup-line span {
          display: block;
          width: 34%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #b1e93c, #00b0d7, #22367b);
          animation: pwaStartupProgress 1.02s ease-in-out infinite;
        }
        .pwa-startup-status {
          margin-top: 14px;
          color: #617292;
          font-size: 12px;
          font-weight: 750;
          letter-spacing: .02em;
        }
        .pwa-startup-dots {
          display: flex;
          gap: 5px;
          margin-top: 10px;
        }
        .pwa-startup-dots i {
          display: block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22367b;
          animation: pwaStartupDot 1s ease-in-out infinite;
        }
        .pwa-startup-dots i:nth-child(2) { animation-delay: .14s; }
        .pwa-startup-dots i:nth-child(3) { animation-delay: .28s; }
        @keyframes pwaStartupLift {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pwaStartupLogo {
          from { opacity: 0; transform: scale(.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pwaStartupProgress {
          0% { transform: translateX(-120%); }
          55%, 100% { transform: translateX(330%); }
        }
        @keyframes pwaStartupDot {
          0%, 100% { opacity: .35; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pwa-startup-content, .pwa-startup-logo-wrap, .pwa-startup-line span, .pwa-startup-dots i { animation: none; }
        }
      `}</style>
    </div>
  );
}
