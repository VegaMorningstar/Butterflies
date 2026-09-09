# Wings and Wind

React + Vite + Tailwind CSS project. Standalone — developed locally (VS Code
+ Claude Code) and deployed to GitHub Pages via `.github/workflows/deploy.yml`
on every push to `main`. See `README.md` for what the app does.

## Development Server

Not auto-started. Run `pnpm dev` (dev server on `$PORT`, default 8443) and
open it in a browser. Hot reload picks up source changes immediately.

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element, page metadata, and font links
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration: React, Tailwind CSS v4, the `@` alias for `src`, and two small dev-only plugins (an error-overlay-replay fix and a React-Refresh-boundary fallback — both documented inline)
- `.mise.toml` - Toolchain versions for Node.js and pnpm
- `.github/workflows/deploy.yml` - Builds and deploys `dist/` to GitHub Pages on push to `main`; sets `PUBLIC_BASE_PATH` so Vite's `base` matches the Pages subpath

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Google Fonts are loaded via `<link>` tags in `index.html` (not a CSS `@import`) so the fetch isn't render-blocking.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
