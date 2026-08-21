export const REPORT_STORY_LAYOUT_FIX = `
.clevio-story {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100dvh !important;
  max-height: none !important;
  margin: 0 !important;
  z-index: 2147483000 !important;
  isolation: isolate;
  contain: paint;
  overflow: hidden !important;
}
.clevio-story .app {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
}
.clevio-story .stage {
  overflow: visible;
}
.clevio-story {
  overscroll-behavior: none;
  touch-action: pan-y;
}
.clevio-story .slide-inner {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
.clevio-story .slide-inner:has(.primary-btn) {
  overflow: visible;
}
.clevio-story .slide-inner:has(.coach-card) {
  overflow: visible;
  padding-bottom: 64px;
}
.clevio-story .coach-layout {
  padding-bottom: 48px;
}
.clevio-story .coach-card {
  overflow: visible;
  box-shadow: 0 22px 48px rgba(0, 0, 0, .16);
}
.clevio-story .primary-btn {
  box-shadow: 0 14px 28px rgba(157, 200, 59, .22);
}
.clevio-story .primary-btn:hover {
  box-shadow: 0 18px 34px rgba(157, 200, 59, .28);
}
.clevio-story .slide-inner.final-layout {
  max-height: none;
  overflow: visible;
  padding-bottom: 56px;
}
.clevio-story .final-actions {
  padding-bottom: 18px;
}
@media (prefers-color-scheme: light) {
  .clevio-story {
    color-scheme: light;
    --white: #22367b;
    --green-bright: #527f16;
    --cyan: #00738f;
    --violet-soft: #6a56c5;
    --orange: #ad5d00;
    background:
      radial-gradient(circle at 10% 16%, rgba(0, 142, 174, .1), transparent 30%),
      radial-gradient(circle at 88% 82%, rgba(111, 159, 29, .12), transparent 30%),
      linear-gradient(145deg, #f8fbff 0%, #edf4ff 56%, #f5faef 100%);
  }
  .clevio-story .display .accent {
    background: linear-gradient(110deg, #22367b, #6551bd 38%, #00738f 72%, #527f16);
    background-clip: text;
    -webkit-background-clip: text;
  }
  .clevio-story .grid {
    opacity: .2;
    background-image:
      linear-gradient(rgba(34, 54, 123, .07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34, 54, 123, .07) 1px, transparent 1px);
  }
  .clevio-story .glow::before,
  .clevio-story .glow::after {
    opacity: .07;
  }
  .clevio-story .eyebrow,
  .clevio-story .unlocked,
  .clevio-story .coach-signature {
    color: #527f16;
  }
  .clevio-story .coach-card {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #ffffff, #f1f6ff);
    box-shadow: 0 22px 48px rgba(34, 54, 123, .16);
  }
  .clevio-story .coach-card.strength h3,
  .clevio-story .coach-card.strength li::before {
    color: #527f16;
  }
  .clevio-story .coach-card.growth h3,
  .clevio-story .coach-card.growth li::before {
    color: #ad5d00;
  }
  .clevio-story .coach-card li,
  .clevio-story .coach-quote,
  .clevio-story .recap-copy blockquote {
    color: #31466f;
  }
  .clevio-story .progress-segment {
    background: rgba(34, 54, 123, .14);
  }
  .clevio-story .progress-segment.active {
    box-shadow: 0 0 14px rgba(0, 142, 174, .2);
  }
  .clevio-story .icon-btn,
  .clevio-story .story-skip,
  .clevio-story .secondary-btn,
  .clevio-story .nav-btn {
    border-color: rgba(34, 54, 123, .14);
    background: rgba(255, 255, 255, .78);
    color: #22367b;
    box-shadow: 0 8px 20px rgba(34, 54, 123, .08);
  }
  .clevio-story .icon-btn:hover,
  .clevio-story .story-skip:hover,
  .clevio-story .secondary-btn:hover,
  .clevio-story .nav-btn:hover:not(:disabled) {
    background: #ffffff;
  }
  .clevio-story .slide-inner {
    scrollbar-color: rgba(34, 54, 123, .25) transparent;
  }
  .clevio-story .skills-board-copy {
    border-color: rgba(34, 54, 123, .2);
  }
  .clevio-story .skills-board-callout,
  .clevio-story .lesson-card {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #ffffff, #f1f6ff);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 18px 42px rgba(34, 54, 123, .12);
  }
  .clevio-story .lesson-index {
    border-color: rgba(34, 54, 123, .14);
    background: #edf3ff;
    color: #3154a4;
  }
  .clevio-story .lesson-check,
  .clevio-story .skill-badge {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #ffffff, #eaf3ff);
    color: #527f16;
    box-shadow: inset 0 0 22px rgba(34, 54, 123, .04), 0 12px 28px rgba(34, 54, 123, .1);
  }
  .clevio-story .skill-node {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #ffffff, #edf4ff);
    box-shadow: 0 16px 36px rgba(34, 54, 123, .11);
  }
  .clevio-story .skill-path::before {
    background: linear-gradient(90deg, rgba(111, 159, 29, .25), rgba(0, 142, 174, .55), rgba(106, 86, 197, .35));
    box-shadow: 0 0 20px rgba(0, 142, 174, .12);
  }
  .clevio-story .metric-row {
    border-color: rgba(34, 54, 123, .12);
  }
  .clevio-story .metric-icon {
    background: #edf5ff;
    border-color: rgba(34, 54, 123, .12);
    color: #00738f;
  }
  .clevio-story .identity-core {
    background: linear-gradient(145deg, #ffffff, #dce9ff);
    border-color: rgba(34, 54, 123, .16);
    box-shadow: inset 0 0 60px rgba(34, 54, 123, .06), 0 26px 64px rgba(34, 54, 123, .18);
  }
  .clevio-story .identity-core::before {
    border-color: rgba(34, 54, 123, .14);
  }
  .clevio-story .orbit-line {
    border-color: rgba(34, 54, 123, .18);
  }
  .clevio-story .orbit-line::before {
    box-shadow: 0 0 18px rgba(0, 142, 174, .3);
  }
  .clevio-story .orbit-line::after {
    box-shadow: 0 0 18px rgba(95, 143, 22, .28);
  }
  .clevio-story .monogram {
    background: rgba(255, 255, 255, .82);
    border-color: rgba(34, 54, 123, .16);
    color: #22367b;
    box-shadow: 0 18px 50px rgba(34, 54, 123, .16);
  }
  .clevio-story .identity-tag {
    background: rgba(255, 255, 255, .9);
    border-color: rgba(34, 54, 123, .14);
    color: #22367b;
    box-shadow: 0 20px 54px rgba(34, 54, 123, .14);
  }
  .clevio-story .identity-tag span {
    color: #607194;
  }
  .clevio-story .score-ring {
    background: conic-gradient(var(--green-bright) calc(var(--score) * 1%), rgba(34, 54, 123, .12) 0);
    filter: drop-shadow(0 0 18px rgba(95, 143, 22, .12));
  }
  .clevio-story .score-ring::before {
    border-color: rgba(34, 54, 123, .18);
  }
  .clevio-story .score-ring.secondary {
    background: conic-gradient(var(--cyan) 64%, rgba(34, 54, 123, .08) 0);
  }
  .clevio-story .grade-chip {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #ffffff, #e3edff);
    color: #22367b;
    box-shadow: 0 20px 44px rgba(34, 54, 123, .16);
  }
  .clevio-story .grade-label {
    border-color: rgba(34, 54, 123, .12);
    background: rgba(255, 255, 255, .88);
    color: #527f16;
  }
  .clevio-story .radar-dot {
    stroke: #ffffff;
  }
  .clevio-story .radar-shape {
    fill: rgba(106, 86, 197, .14);
    filter: drop-shadow(0 0 12px rgba(0, 142, 174, .16));
  }
  .clevio-story .project-cube span {
    border-color: rgba(34, 54, 123, .16);
    background: linear-gradient(145deg, rgba(106, 86, 197, .22), rgba(0, 142, 174, .1));
    box-shadow: inset 0 0 42px rgba(255, 255, 255, .5), 0 24px 52px rgba(34, 54, 123, .14);
  }
  .clevio-story .project-cube span:nth-child(2) {
    background: linear-gradient(145deg, rgba(111, 159, 29, .24), rgba(0, 142, 174, .1));
  }
  .clevio-story .project-cube span:nth-child(3) {
    background: linear-gradient(145deg, rgba(200, 115, 0, .2), rgba(106, 86, 197, .12));
  }
  .clevio-story .project-ring {
    border-color: rgba(34, 54, 123, .18);
  }
  .clevio-story .reflection-item {
    border-color: rgba(34, 54, 123, .12);
  }
  .clevio-story .final-emblem {
    border-color: rgba(34, 54, 123, .14);
    background: linear-gradient(145deg, #f2f8e7, #e5ebff);
    box-shadow: 0 24px 56px rgba(34, 54, 123, .14), inset 0 0 36px rgba(255, 255, 255, .55);
  }
  .clevio-story .nav-hint {
    color: #7180a3;
  }
  .clevio-story .primary-btn {
    color: #17320b;
    background: linear-gradient(100deg, #b9e658, #dfff82);
    box-shadow: 0 14px 28px rgba(95, 143, 22, .2);
  }
  .clevio-story .primary-btn:hover {
    box-shadow: 0 18px 34px rgba(95, 143, 22, .25);
  }
}
@media (max-width: 640px) {
  .clevio-story .app {
    height: 100svh;
    min-height: 0;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .clevio-story .slide-inner {
    max-height: calc(100svh - 160px);
    padding-bottom: 24px;
  }
  .clevio-story .bottom-nav {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .clevio-story.trial-story .slide-inner {
    max-height: calc(100svh - 160px);
    overflow: auto;
    padding: 16px 3px calc(24px + env(safe-area-inset-bottom));
    scrollbar-width: thin;
    scrollbar-color: rgba(34, 54, 123, .25) transparent;
  }
  .clevio-story.trial-story .slide-inner::-webkit-scrollbar {
    display: block;
    width: 4px;
  }
}
`;
