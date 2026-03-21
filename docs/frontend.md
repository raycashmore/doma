# Frontend

## Framework

TanStack Start with React 19. File-based routing via TanStack Router — routes live in `src/routes/`, root layout in `__root.tsx`.

## Styling

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (NOT PostCSS — do not add `postcss.config.js`)
- **Shadcn UI:** new-york style, zinc base color, components at `@/components/ui/`
- **Class merging:** Use `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- **Icons:** Lucide React (`lucide-react`)

## React Compiler

Enabled via `babel-plugin-react-compiler`. Skip manual `useMemo`/`useCallback` — the compiler handles memoization automatically.

## Component Locations

| Path               | Purpose                     |
| ------------------ | --------------------------- |
| `@/components/ui/` | Shadcn UI primitives        |
| `@/components/`    | Custom app components       |
| `@repo/ui/button`  | Shared cross-app components |

## Convex Integration

`ConvexProvider` wraps the app in `__root.tsx`, configured in `src/integrations/convex/`.
