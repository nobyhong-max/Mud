# 独造榜 / DuZao Rank

Next.js 15 App Router ranking site for AI indie projects (seed data MVP).

## Run locally

```bash
cd ranking-site
npm install
npm run dev
```

Open [http://localhost:3000/zh](http://localhost:3000/zh) or [http://localhost:3000/en](http://localhost:3000/en).

## Stack

- Next.js 15, Tailwind CSS 4, shadcn-style UI primitives
- `next-intl` locale routes (`/zh`, `/en`) + `NEXT_LOCALE` cookie
- `next-themes` dark/light (default dark)

## Data

Seed projects: `data/seed.json` (28 projects from product spec).
