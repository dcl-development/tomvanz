# tomvanz.com

Personal site for Tom Vanz: a small Next.js app in `web/`.

**Live**

- Home: https://tomvanz.com/
- Map: https://tomvanz.com/map
- Drone Clips (in-browser video compressor; files stay on your device): https://tomvanz.com/droneclips
- Studio: https://tomvanz.com/studio

## Local setup

```bash
cd web && npm install && npm run dev
```

- Home: http://localhost:3000/
- Map: http://localhost:3000/map
- Drone Clips: http://localhost:3000/droneclips
- Studio: http://localhost:3000/studio

Copy `web/.env.example` to `web/.env.local` if you want a Sanity read token. Project id and dataset use the public defaults in the repo.

Other commands (from `web/`):

```bash
npm run build
npm run lint
```

## Editing content

Content is edited in the embedded Sanity Studio at `/studio`. Add editors as **Editor** in [sanity.io/manage](https://www.sanity.io/manage). Published documents appear on the site; drafts do not.

## Contributing

Fork or branch from `main`, make your changes, and open a pull request against `main`. PRs are squash-merged. Vercel builds a preview deployment for each PR.
