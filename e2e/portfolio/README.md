# Public portfolio UI fixture

Run from the repository root using the Node version in `package.json`:

```sh
node node_modules/vitest/node_modules/vite/bin/vite.js --config e2e/portfolio/vite.config.mjs
```

Open `http://127.0.0.1:4175/`. Use `/?empty` for a portfolio without published work.
This renders the actual public portfolio components with synthetic approved snapshots;
it makes no API requests and is not a Next.js route or production data seed.

Manual checks: 320×568, 390×844, 768×1024, 1024×600, and 1366×768.

- Follow “Lihat karya” and “Perjalanan belajar”; headings and controls remain visible.
- Open and close mobile navigation, then select a section.
- Filter both tools and restore “Semua”; each project card has the same image ratio.
- Open a project with a long story; the play action appears before the story.
- Select the second screenshot; close with the button, backdrop, and Escape.
- Tab/Shift+Tab stays in the open modal; closing returns focus to its trigger.
- Check a project with no playable link; its gallery and story remain usable.
- Expand/collapse the journey; the current sixth block is initially visible.
- Test native sharing or clipboard copy and the denied-clipboard message.
- With reduced motion enabled, decorative animations/parallax stop.
- Scroll the hero: planet/star layers move, but text and buttons stay stable.

For production verification, additionally confirm that the Next.js optimized logo,
global scroll styles, approved snapshots, and school visibility still behave correctly.
