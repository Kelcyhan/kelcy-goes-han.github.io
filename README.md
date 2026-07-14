# Kelcy Han — portfolio

A React + Vite portfolio with one application router, shared project-page components,
and isolated interactive demos. Project pages no longer load full pages inside a
site-wide iframe; only the three projects that contain an actual sandbox use a
dedicated, guarded demo iframe.

## Local development

```sh
npm install
npm run dev
```

## Production check

```sh
npm run test:site
npm run preview
```

`test:site` builds the site and verifies all project routes, demo bundles, transition
frames, music, and browser-compatible videos expected in the production output.

## Architecture

- `/` is the scenic three-room portfolio.
- `/projects/:slug` renders each case study through the shared React project shell.
- Old URLs such as `/AgentSystem` redirect to the corresponding React route.
- `/demos/*` contains self-contained interactive sandboxes copied during the build.
- Project media is imported explicitly so Vite includes it in production.
- Demo readiness uses a same-origin, versioned message with a per-demo identity.
- Dense research images open in an accessible full-size viewer; Puri's borrowing
  flow is a native React component rather than another iframe.

Deployment rewrites live in `vercel.json`. Demo URLs intentionally keep their
trailing slash so their relative JavaScript and image paths resolve correctly.
