# Public portfolio UI fixture

Run from the repository root using the Node version in `package.json`:

```sh
node node_modules/vitest/node_modules/vite/bin/vite.js --config e2e/portfolio/vite.config.mjs
```

Open `http://127.0.0.1:4175/`. Use `/?empty` for a portfolio without published work,
or `/?stress` for a long name/school and unbroken tool, skill, project and block labels.
This renders the actual public portfolio components with synthetic approved snapshots;
it makes no database requests or production writes and is not a Next.js route or data seed.
Official software images use the real read-only image handler through the Vite middleware;
the handler fetches only its fixed vendor-source registry.

Manual checks: 320×480, 390×844, 640×320, 768×1024, 820×1180,
1024×600, 1366×768, and 1920×1080.

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
- Scroll the full-width hero: nebula/star/orbital layers move at different speeds;
  planet/orbit/twinkle stay animated, while text and buttons stay stable.
- Navbar stays at the top while scrolling; modal locks both HTML and body, then
  releases to one document scroll context. Short landscape uses normal scrolling.
- In `/?stress`, no filter, chip, metadata, card action, block title or modal badge
  extends past its container. Open the long-title project and check its close button.

For production verification, additionally confirm that the Next.js optimized logo,
global scroll styles, approved snapshots, and school visibility still behave correctly.

## Software logo form

Open `/software.html` for the actual admin form with local API mocks. The default
checkbox deliberately makes software saving fail after a successful upload. Upload
a test PNG from `public/logo/`, save, uncheck the failure checkbox and save again:
the counters must show one upload and two save attempts. No Supabase write occurs.
Also check URL validation, a broken URL's warning/fallback, “Gunakan logo bawaan”,
and 320/390/768/1280px controls. Signed-out public images and protected admin upload
are independently covered by behavioral route/middleware tests.
