# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Desktop Capture-the-Flag game built with Electron + Phaser + TypeScript + Vite.
- **Main process**: `src/main/` — Electron app lifecycle, window management, networking
- **Renderer process**: `src/renderer/` — Phaser game scenes and UI
- **Shared**: `src/shared/` — Protocol definitions shared between main and renderer

## Build & Dev Commands

```bash
npm run dev        # Start Vite dev server + Electron (hot reload)
npm run build      # Build for production (outputs to dist/)
```

No linter, formatter, or test runner is configured. If you add one, document it here.

## TypeScript Configuration

- Target: ES2020
- Module: ESNext with bundler resolution
- Strict mode: **enabled** — all strict checks are on
- `noEmit: true` — TypeScript is only used for type checking; Vite handles bundling
- Libs: ES2020, DOM

Type-check with:
```bash
npx tsc --noEmit
```

## Code Style Guidelines

### Indentation & Formatting

- **4 spaces** for indentation (match existing files)
- Single quotes for strings: `'hello'`
- Semicolons at end of statements
- Trailing commas in multi-line structures (arrays, objects, args)
- Opening braces on same line as declaration
- Max line length: keep reasonable (~100 chars)

### Imports

- Use ES module syntax: `import { X } from 'module'` or `import X from 'module'`
- Group imports: node builtins first, then third-party, then local
- Use named imports for node/Electron APIs: `import { app } from 'electron'`
- Use default imports for libraries: `import Phaser from 'phaser'`
- Relative imports for local files: `import { createWindow } from './window'`
- Use `.ts` extension only if Vite requires it; otherwise omit
- No barrel files (index.ts re-exports) unless complexity warrants it

### Naming Conventions

- **Files**: PascalCase for classes/scenes (`MenuScene.ts`), camelCase for utilities (`window.ts`)
- **Classes**: PascalCase (`MenuScene`, `BrowserWindow`)
- **Functions**: camelCase (`createWindow`, `createButton`)
- **Variables**: camelCase (`gameConfig`, `win`)
- **Constants**: camelCase or UPPER_SNAKE for true constants
- **Interfaces/Types**: PascalCase, no `I` prefix
- **Enums**: PascalCase with PascalCase members

### Types

- Prefer explicit return types on exported/public functions
- Use `Phaser.Types.Core.GameConfig` style typed configs
- Use `void` for functions that return nothing
- Avoid `any` — use `unknown` or specific types instead
- Interface over type alias for object shapes unless union/intersection needed

### Error Handling

- Use try/catch for async operations and network calls
- Log errors with `console.error()` — do not swallow silently
- Validate inputs at boundaries (network, IPC, file I/O)
- Use early returns for guard clauses

### Phaser Patterns

- Extend `Phaser.Scene` for game scenes; pass `{ key: 'SceneName' }` in constructor
- Use `this.scale` for responsive sizing
- Use `setOrigin(0.5)` for centering text/shapes
- Register scenes in the game config array: `scene: [MenuScene]`
- Use `setInteractive({ useHandCursor: true })` for clickable elements
- Prefer `Phaser.AUTO` for renderer selection

### Electron Patterns

- Main process code goes in `src/main/`
- Use `app.whenReady()` for initialization
- Load dev server URL in dev, file path in production via `VITE_DEV_SERVER_URL`
- Prefer `contextIsolation: false` + `nodeIntegration: true` only if necessary for this project's scope

### Module System

- Package type is `commonjs` but source uses ESNext modules (Vite handles transpilation)
- Export functions/classes explicitly; avoid default exports except for libraries

## Project Structure

```
src/
  main/
    main.ts           # Electron entry point
    window.ts         # BrowserWindow creation
    network/
      tcp.ts          # TCP networking (empty, TODO)
      udp.ts          # UDP networking (empty, TODO)
  renderer/
    renderer.ts       # Phaser game bootstrap
    scenes/
      MenuScene.ts    # Main menu scene
  shared/
    protocol.ts       # Shared protocol types (empty, TODO)
```

## Key Dependencies

- `electron` ^43.2.0 — Desktop app shell
- `phaser` ^4.2.1 — Game engine (renderer process only)
- `vite` ^8.1.5 — Build tool
- `vite-plugin-electron` ^1.1.0 — Vite + Electron integration

## Git Conventions

- Branch naming: `feature/short-description`, `fix/short-description`
- Commit messages: imperative mood, concise (`add menu scene`, `fix window loading`)
- Never commit `node_modules/` or `dist/` (already in `.gitignore`)

## Adding New Files

- New Electron main-process files go in `src/main/`
- New Phaser scenes go in `src/renderer/scenes/`
- New networking code goes in `src/main/network/`
- Shared types/protocols go in `src/shared/`
- Register new scenes in `src/renderer/renderer.ts` scene array

## Common Pitfalls

- Vite dev server URL is set via env var `VITE_DEV_SERVER_URL` — do not hardcode
- Phaser runs in the renderer process; Electron APIs are only available in main process
- TypeScript strict mode means you must handle null/undefined explicitly
- Empty `.ts` files (`tcp.ts`, `udp.ts`, `protocol.ts`) are placeholders — implement or remove
