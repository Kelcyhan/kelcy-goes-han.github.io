---
name: serve-website
description: Publish a website at agent.blankenhagen.net/sites/<your-token>/<name>/. Drop files into ~/sites/<name>/; a no-listing HTTP server with visitor logging is already running. Works identically on the outer host and inside any user container.
allowed-tools: Bash(python3 *) Bash(pkill *) Bash(curl *) Bash(cat *) Bash(pgrep *) Bash(nohup *) Bash(docker *) Read Write Edit
---

# Serve a Website

Publish a site at `https://agent.blankenhagen.net/sites/<your-token>/<name>/`. Same three steps whether you're on the outer host or inside a user container — the server and token are already provisioned.

## Quick start

```bash
TOKEN=$(cat ~/.site-token)          # already provisioned for this host
mkdir -p ~/sites/hello
cat > ~/sites/hello/index.html <<'EOF'
<!doctype html><title>Hello</title><h1>hello</h1>
EOF

# REQUIRED: record what this site is, who made it, and why — the Live Sites
# widget reads this, and any agent asked to edit the site will read it first.
cat > ~/sites/hello/.site.yaml <<'EOF'
summary: "One-line hello demo for testing the sites server"   # <= 10 words
description: |
  A trivial hello-world page served to verify the token URL works
  end-to-end. Not used by any other system; safe to delete. Created as
  a smoke test when bringing up the sites stack.
created_by_task: Scratch/example-task
created_by_session: REPLACE-WITH-YOUR-SESSION-ID
created_at: 2026-04-22
EOF

echo "→ https://agent.blankenhagen.net/sites/$TOKEN/hello/"
```

That's it. Any folder under `~/sites/` is live at `/sites/<token>/<folder>/`. Content changes are instant — no reload, no restart.

## `.site.yaml` — site metadata (required for new sites)

Every site folder under `~/sites/` MUST contain a `.site.yaml` describing what it is and who made it. Fields:

| Field | Required | Notes |
|-------|----------|-------|
| `summary` | yes | ≤10 words. Human-readable one-liner — shown in the Live Sites widget. |
| `description` | yes | Exactly 3 sentences. What the site is, who it's for, why it exists. |
| `created_by_task` | yes | Vault-relative path to the task folder that created this site (e.g. `Scratch/my-task` or `projects/X/1_2/1_2_5`). |
| `created_by_session` | yes | Session ID of the creating agent (UUID). |
| `created_at` | yes | ISO date (`YYYY-MM-DD`). |

**When editing an existing site:**
1. Read `.site.yaml` first to understand intent.
2. If the site's purpose or description changes meaningfully after your edits, UPDATE `summary` and `description` to match.
3. Never blank these fields. If unsure, keep the existing values.

**If you inherit a site without `.site.yaml`:** search the vault for the task/session that created it (grep `Scratch/`, `projects/`, `State/session_cards/` for the folder name), read the creating task, then backfill `.site.yaml` as part of your edit.

## Recipes

**Static site** — just drop files + `.site.yaml`:
```bash
cp -r /path/to/build/* ~/sites/my-site/
# write ~/sites/my-site/.site.yaml (see Quick start)
```

**Dynamic app (recommended — coexists with static sites and other dynamic apps)** — give each app its own port and its own nginx `location` block under a sub-path. The default `sites-server.py` keeps running; static sites under the same token keep working; you can repeat the pattern for a second, third, … dynamic app.

```bash
# 1. Run your app on a fresh port (pick anything free — 8081, 8092, 9000…),
#    bound to 0.0.0.0 (nginx reaches it via the docker bridge, not loopback).
#    Configure its base path to /sites/<your-token>/<app>/ so absolute links resolve.
```

Then add a `location ^~ /sites/<TOKEN>/<app>/` block to `/workspace/nginx/nginx.conf` with `proxy_pass http://<UPSTREAM>` (inner: `user-NN:<PORT>`, outer: `172.18.0.1:<PORT>`). Use `^~` so the longest prefix wins over the catch-all `/sites/<TOKEN>/` block. For SSE / WebSocket apps, also set `proxy_buffering off`, `proxy_cache off`, and `proxy_read_timeout 3600s`. Apply with `docker exec workspace-nginx-1 nginx -t && docker restart workspace-nginx-1`. Full template + wiring details: `/home/agent/vault/_system/guides/sites-operator.md`.

**Dynamic app (simple shortcut — takes over the whole token)** — if this app is the only thing you need under the token and you're OK with the tradeoff, stop the default server and bind yours to its port:
```bash
pkill -f '.sites-server.py'
# then: run your app on port 8080 (inner) or 8091 (outer), bound to 0.0.0.0
# app is now reachable at /sites/<your-token>/   (no sub-path)
```
Tradeoff: **every other `~/sites/<folder>/` static site under this token stops responding** until the default server is restarted. Don't pick this if other routes under the same token are in use. If you replace the default server, **disable directory listings** yourself (`--browse=false` on caddy, equivalent on others) — listings would let a visitor with the token enumerate every folder.

**Update / delete** — just edit or `rm -rf` the folder. No reload. If you rename or retire a site, delete its `.site.yaml` along with the folder.

**Restart the default server** if it's not responding or you've upgraded the script:
```bash
pkill -f '.sites-server.py' 2>/dev/null
nohup python3 ~/.sites-server.py > /tmp/sites-server.log 2>&1 &
```

## Visitor logging

The default server at `~/.sites-server.py` logs every GET to `~/.sites-hits.jsonl` as one JSON line per request:

```json
{"ts": 1713780000.42, "folder": "hello", "ip": "203.0.113.7", "path": "/hello/index.html"}
```

The Live Sites widget reads this file to compute unique-visitor and total-hit counts per site. Real client IPs come from headers in priority order: `CF-Connecting-IP` (cloudflared), `X-Real-IP`, `X-Forwarded-For` (first entry). Falls back to the socket peer if none are set.

**If you replace the default server** with your own process, either re-implement this logging or accept that visitor counts will stop for the whole token. The widget auto-detects when the counting script isn't in place and shows a warning.

**Reset counts:** delete `~/.sites-hits.jsonl`. Starts accumulating again on the next request.

## Gotchas

- **URL prefix is secret-ish**, not auth. Treat `~/.site-token` like a password. Don't paste it in public docs, screenshots, or commits.
- **No secrets in `~/sites/`.** Anyone with your token can read every file in there.
- **Relative paths only.** `<img src="/foo.jpg">` escapes the token prefix and 404s. Use `src="foo.jpg"` or `./foo.jpg`. Same for CSS/JS/links. Frameworks: set the base path to `/sites/<your-token>/<site>/`.
- **Trailing slash matters.** `/sites/<token>/my-site/` works; `/sites/<token>/my-site` forces a 301 round-trip. Link to the slash form.
- **Bare `/sites/<token>/` returns 404.** That's the no-listings feature, not a bug. Name your folders and link to them directly.
- **Don't rebind the server to 127.0.0.1.** Nginx reaches it over the docker bridge, not loopback.
- **`.site.yaml` is mandatory.** The Live Sites widget shows "(no summary yet)" for folders missing it, and any agent asked to edit such a site will pause to go find/backfill the metadata before touching files. Save everyone the detour.

## Verify before you declare it live

```bash
TOKEN=$(cat ~/.site-token)
curl -s -o /dev/null -w "%{http_code}\n" "https://agent.blankenhagen.net/sites/$TOKEN/<folder>/"   # expect 200  (static site or coexist dynamic app)
curl -s -o /dev/null -w "%{http_code}\n" "https://agent.blankenhagen.net/sites/$TOKEN/"            # expect 404  (no listings — or 200 if you picked the "takes over the whole token" shortcut)
test -f ~/sites/<folder>/.site.yaml && echo "metadata ok" || echo "MISSING .site.yaml — fix before declaring live"
```

Then open it in an incognito window. If the page redirects to the login page, your app is sending absolute-path links — fix the base path (see Gotchas).

## If something's broken

- **502** at the public URL → the server isn't running. `pgrep -af '.sites-server.py'`; if empty, restart it (see Recipes).
- **404** with files in place → wrong path, typo, or missing trailing slash. Double-check with a local curl from the same host.
- **Page loads but styles/images break** → absolute paths in your HTML. Switch to relative.
- **Visitor counts stuck at 0** → server is running the OLD version without logging. Overwrite `~/.sites-server.py` with the current template (this file) and restart it (see Recipes).
- **Anything else** → operator guide at `/home/agent/vault/_system/guides/sites-operator.md` covers nginx, tokens, adding new containers.
