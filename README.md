# Elev8ai

Marketplace where young people take paid micro-jobs and buy courses that unlock
better-paying, skill-gated jobs. See `CLAUDE.md` for scope and rules and
`docs/schema.md` for the data model.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

First time running e2e tests: `npx playwright install --with-deps chromium`.

## Scripts

| Command             | What it does                |
| ------------------- | --------------------------- |
| `npm run dev`       | Start the dev server        |
| `npm run build`     | Production build            |
| `npm run lint`      | ESLint                      |
| `npm run typecheck` | TypeScript, no emit         |
| `npm run format`    | Prettier (write)            |
| `npm run test:e2e`  | Playwright end-to-end tests |
