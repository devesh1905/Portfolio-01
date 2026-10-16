# Deveshwar S: Portfolio

Personal portfolio of Deveshwar S, full-stack and AI developer and B.Tech IT student. Dark glass-and-gold design with a hero win stack, hackathon achievements, selected works, a journey timeline, a filterable skills matrix and a contact form.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Framer Motion.

## Content

Most content lives in [`src/data/portfolioConfig.json`](src/data/portfolioConfig.json):

- `personalInfo`: name, title, bio, links, resume path
- `skills`: grouped skill chips
- `projects`: project cards (optional `stats` chips and `githubUrl`; empty `githubUrl` hides the link)
- `achievements`, `upcomingProjects`

Project cards for EtherWave and AudioLens are hand-built in `src/app/page.tsx` because they include interactive demos. Every other project renders from the config. The Wins cards and Journey timeline are written in `page.tsx`.

The resume files are `public/Deveshwar_S_Resume.pdf` and `.docx`.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Notes

- The contact form opens the visitor's email app with the message pre-filled (no backend).
- Social previews use `public/og.png`. The base URL comes from `VERCEL_PROJECT_PRODUCTION_URL` when deployed on Vercel.
- Animations respect the visitor's reduced-motion setting.
