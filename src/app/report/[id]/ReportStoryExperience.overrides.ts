export const REPORT_STORY_OVERRIDES = `
.clevio-story .secondary-btn { white-space: nowrap; }
.clevio-story .skills-board-layout {
  display: grid;
  grid-template-columns: minmax(300px, .42fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(32px, 5vw, 72px);
}
.clevio-story .skills-board-copy {
  position: relative;
  padding-right: clamp(18px, 3vw, 44px);
  border-right: 1px dashed rgba(255,255,255,.18);
}
.clevio-story .skills-board-copy .display.medium {
  max-width: 430px;
  font-size: clamp(50px, 5.2vw, 82px);
}
.clevio-story .skills-board-copy .lead { max-width: 430px; }
.clevio-story .skills-board-callout {
  margin-top: 34px;
  width: min(100%, 390px);
  min-height: 94px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.18);
  background: linear-gradient(140deg, rgba(255,255,255,.09), rgba(255,255,255,.035));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.09), 0 24px 56px rgba(0,0,0,.18);
  display: grid;
  grid-template-columns: 46px 1fr;
  align-items: center;
  gap: 14px;
}
.clevio-story .skills-board-callout svg {
  width: 36px;
  height: 36px;
  color: var(--cyan);
  padding: 7px;
  border-radius: 14px;
  background: rgba(88,214,255,.12);
}
.clevio-story .skills-board-callout strong {
  display: block;
  font-size: 15px;
  color: var(--text);
  line-height: 1.25;
}
.clevio-story .skills-board-callout span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}
.clevio-story .lesson-card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(10px, 1.3vw, 18px);
  align-content: center;
}
.clevio-story .lesson-card {
  position: relative;
  min-height: clamp(132px, 16.4vh, 178px);
  padding: 18px 13px 17px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.13);
  background: linear-gradient(150deg, rgba(255,255,255,.105), rgba(255,255,255,.032));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 18px 46px rgba(0,0,0,.18);
  display: grid;
  grid-template-rows: 1fr auto;
  justify-items: center;
  align-items: center;
  text-align: center;
  overflow: hidden;
  opacity: 0;
  transform: translateY(16px) scale(.96);
  transition: opacity .45s var(--ease), transform .55s var(--ease), border-color .25s ease;
  transition-delay: calc(var(--i) * 38ms);
}
.clevio-story .slide.active .lesson-card { opacity: 1; transform: translateY(0) scale(1); }
.clevio-story .lesson-card::before {
  content: "";
  position: absolute;
  inset: -35% -20% auto;
  height: 70%;
  background: radial-gradient(circle, rgba(88,214,255,.15), transparent 62%);
  opacity: .8;
}
.clevio-story .lesson-index {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1;
  width: 28px;
  height: 28px;
  border-radius: 11px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(7,14,45,.45);
  color: var(--green-bright);
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 13px;
}
.clevio-story .lesson-check {
  position: relative;
  z-index: 1;
  width: clamp(50px, 5.6vw, 74px);
  height: clamp(50px, 5.6vw, 74px);
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,.13);
  background: linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.035));
  color: var(--green-bright);
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 22px rgba(255,255,255,.035);
}
.clevio-story .lesson-check svg {
  width: 48%;
  height: 48%;
  stroke-width: 2.5;
}
.clevio-story .lesson-card strong {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 132px;
  min-height: 2.6em;
  color: var(--text);
  font-size: clamp(11px, .9vw, 15px);
  line-height: 1.24;
  font-weight: 850;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.clevio-story .skills-board-layout.compact .lesson-card,
.clevio-story .skills-board-layout.dense .lesson-card {
  min-height: clamp(116px, 14.3vh, 154px);
  padding: 15px 10px 14px;
  border-radius: 16px;
}
.clevio-story .skills-board-layout.dense .lesson-card-grid { gap: clamp(8px, 1vw, 14px); }
.clevio-story .skills-board-layout.dense .lesson-card strong {
  font-size: clamp(10px, .78vw, 13px);
  line-height: 1.2;
  max-width: 120px;
}
.clevio-story .skills-board-layout.dense .lesson-index {
  width: 25px;
  height: 25px;
  border-radius: 9px;
  font-size: 12px;
}
@media (max-width: 980px) {
  .clevio-story .app { min-height: 620px; height: 100dvh; overflow: hidden; }
  .clevio-story .topbar { grid-template-columns: 1fr auto; }
  .clevio-story .progress { grid-column: 1 / -1; grid-row: 2; }
  .clevio-story .stage { min-height: 0; }
  .clevio-story .slide-inner { max-height: calc(100dvh - 178px); overflow: auto; padding: 30px 0; }
  .clevio-story .intro-layout,
  .clevio-story .recap-layout,
  .clevio-story .stats-layout,
  .clevio-story .skills-layout,
  .clevio-story .skills-board-layout,
  .clevio-story .coach-layout,
  .clevio-story .reflection-layout { grid-template-columns: 1fr; }
  .clevio-story .skills-board-copy { padding-right: 0; border-right: 0; }
  .clevio-story .skills-board-copy .display.medium,
  .clevio-story .skills-board-copy .lead { max-width: 760px; }
  .clevio-story .skills-board-callout { display: none; }
  .clevio-story .lesson-card-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .clevio-story .identity-orbit { width: min(390px, 86vw); justify-self: center; order: -1; }
  .clevio-story .intro-copy { text-align: center; }
  .clevio-story .intro-copy .lead { margin-left: auto; margin-right: auto; }
  .clevio-story .intro-actions { justify-content: center; }
  .clevio-story .score-visual { min-height: 420px; order: -1; }
  .clevio-story .radar-wrap { width: min(430px, 86vw); }
  .clevio-story .skill-path { grid-template-columns: repeat(4, 1fr); }
  .clevio-story .coach-card.growth { transform: none; }
  .clevio-story .project-art { width: min(370px, 82vw); }
}
@media (max-width: 640px) {
  .clevio-story .app { padding: 14px 16px 12px; min-height: 620px; height: 100dvh; }
  .clevio-story .brand { font-size: 13px; letter-spacing: .12em; }
  .clevio-story .brand-mark { width: 30px; height: 30px; }
  .clevio-story .topbar { gap: 12px; }
  .clevio-story .top-actions .icon-btn { display: none; }
  .clevio-story .stage { min-height: 0; }
  .clevio-story .slide-inner { max-height: calc(100dvh - 150px); padding: 16px 0 22px; }
  .clevio-story .display { font-size: clamp(38px, 12vw, 54px); }
  .clevio-story .display.medium { font-size: clamp(36px, 11vw, 50px); }
  .clevio-story .lead { font-size: 16px; }
  .clevio-story .intro-layout { gap: 16px; }
  .clevio-story .identity-orbit { width: 100%; height: 190px; aspect-ratio: auto; }
  .clevio-story .identity-core { width: 142px; height: 142px; }
  .clevio-story .orbit-line { inset: 0 18%; }
  .clevio-story .orbit-line.two { inset: 24px 29%; }
  .clevio-story .identity-tag { width: min(86%, 310px); bottom: 0; padding: 12px 14px; }
  .clevio-story .identity-tag strong { font-size: 15px; }
  .clevio-story .identity-tag span { margin-top: 3px; font-size: 11px; }
  .clevio-story .intro-copy .eyebrow { margin-bottom: 10px; font-size: 11px; }
  .clevio-story .intro-copy .lead { margin-top: 14px; font-size: 14px; line-height: 1.45; }
  .clevio-story .intro-actions { margin-top: 18px; }
  .clevio-story .intro-actions .secondary-btn { display: none; }
  .clevio-story .score-visual { min-height: 320px; }
  .clevio-story .score-rings { width: min(310px, 82vw); }
  .clevio-story .grade-chip { width: 78px; border-radius: 24px; }
  .clevio-story .grade-chip span { font-size: 44px; }
  .clevio-story .stats-layout { gap: 12px; }
  .clevio-story .metric-list { margin-top: 18px; }
  .clevio-story .metric-row { grid-template-columns: 38px 1fr auto; gap: 10px; padding: 9px 0; }
  .clevio-story .metric-icon { width: 36px; height: 36px; }
  .clevio-story .skill-path { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 16px 0; }
  .clevio-story .skill-path::before { display: none; }
  .clevio-story .skill-node:nth-child(n+5) { transform: none; }
  .clevio-story .skill-node { min-height: 130px; }
  .clevio-story .skill-badge { width: 68px; height: 68px; border-radius: 20px; }
  .clevio-story .skills-board-layout { gap: 18px; }
  .clevio-story .skills-board-copy .display.medium { font-size: clamp(36px, 11vw, 50px); }
  .clevio-story .lesson-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .clevio-story .lesson-card,
  .clevio-story .skills-board-layout.compact .lesson-card,
  .clevio-story .skills-board-layout.dense .lesson-card {
    min-height: 112px;
    padding: 14px 9px 12px;
    border-radius: 15px;
  }
  .clevio-story .lesson-check { width: 48px; height: 48px; }
  .clevio-story .lesson-index { width: 24px; height: 24px; top: 8px; left: 8px; font-size: 11px; border-radius: 8px; }
  .clevio-story .lesson-card strong { max-width: 112px; font-size: 11px; line-height: 1.18; }
  .clevio-story .coach-columns { grid-template-columns: 1fr; }
  .clevio-story .coach-card { min-height: 0; padding: 20px; }
  .clevio-story .project-art { width: min(280px, 76vw); }
  .clevio-story .reflection-item { grid-template-columns: 36px 1fr; }
  .clevio-story .final-actions { width: 100%; flex-direction: column; }
  .clevio-story .final-actions .primary-btn,
  .clevio-story .final-actions .secondary-btn { width: 100%; display: flex; justify-content: center; }
  .clevio-story .bottom-nav { gap: 10px; }
  .clevio-story .nav-hint { font-size: 10px; }
}
@media (max-height: 800px) and (min-width: 981px) {
  .clevio-story .app { padding-top: 16px; padding-bottom: 14px; }
  .clevio-story .topbar { gap: 18px; }
  .clevio-story .slide-inner { max-height: calc(100dvh - 136px); padding: 12px 3px; }
  .clevio-story .display { font-size: clamp(44px, 5.2vw, 68px); }
  .clevio-story .display.medium { font-size: clamp(36px, 4.2vw, 54px); }
  .clevio-story .lead { margin-top: 16px; font-size: clamp(15px, 1.35vw, 18px); }
  .clevio-story .intro-actions { margin-top: 22px; }
  .clevio-story .identity-orbit { width: min(390px, 32vw); }
  .clevio-story .score-rings { width: min(420px, 35vw); }
  .clevio-story .radar-wrap { width: min(410px, 32vw); }
  .clevio-story .metric-list { gap: 5px; margin-top: 16px; }
  .clevio-story .metric-row { padding: 7px 0; }
  .clevio-story .coach-layout { gap: 48px; }
  .clevio-story .coach-quote { margin-top: 18px; font-size: 18px; }
  .clevio-story .coach-signature { margin-top: 14px; }
  .clevio-story .coach-card { min-height: 290px; padding: 22px; }
  .clevio-story .coach-card.growth { transform: none; }
  .clevio-story .coach-card ul { gap: 12px; }
  .clevio-story .project-art { width: min(350px, 28vw); }
  .clevio-story .reflection-list { gap: 5px; margin-top: 14px; }
  .clevio-story .reflection-item { padding: 10px 0; }
  .clevio-story .skills-board-layout { grid-template-columns: minmax(270px, .38fr) minmax(0, 1fr); gap: 36px; }
  .clevio-story .skills-board-copy .display.medium { font-size: clamp(40px, 4.1vw, 58px); }
  .clevio-story .skills-board-copy .lead { margin-top: 14px; font-size: 15px; line-height: 1.45; }
  .clevio-story .skills-board-callout { margin-top: 22px; min-height: 78px; padding: 14px 16px; }
  .clevio-story .lesson-card,
  .clevio-story .skills-board-layout.compact .lesson-card,
  .clevio-story .skills-board-layout.dense .lesson-card { min-height: clamp(102px, 13.1vh, 130px); padding: 13px 9px 11px; }
  .clevio-story .lesson-check { width: 50px; height: 50px; }
  .clevio-story .lesson-card strong { font-size: 11px; line-height: 1.18; }
}
@media (prefers-color-scheme: light) {
  .clevio-story .radar-label { fill: #22367b; }
  .clevio-story .recap-copy blockquote,
  .clevio-story .coach-quote,
  .clevio-story .coach-card li { color: #31466f; }
  .clevio-story .identity-tag span,
  .clevio-story .reflection-item p { color: #607194; }
}
@media (prefers-reduced-motion: reduce) {
  .clevio-story,
  .clevio-story *,
  .clevio-story *::before,
  .clevio-story *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
@media print {
  .clevio-story { display: none !important; }
}
`;
