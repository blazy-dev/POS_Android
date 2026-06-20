# Mobile app conventions

Expo is already working in this workspace. Do not change Expo versions, app.json, or the native setup unless a task explicitly requires it.

Current mobile structure:

- App.tsx: thin bootstrap only
- src/navigation: entry point for app flow
- src/screens: screen-level UI
- src/components: reusable UI pieces
- src/theme: design tokens and styling primitives
- src/types: shared TypeScript types
- src/api: remote API client and contracts
- src/database: local persistence and schema helpers
- src/hooks: reusable React hooks
- src/modules: feature modules
- src/services: hardware and platform services
- src/store: app state
- src/sync: offline queue and synchronization
- src/utils: pure helpers

Keep the app offline-first and POS-focused. New UI should start from src/screens and be composed from reusable pieces under src/components.
