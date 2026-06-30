# Sites — Operator Guide

How the `agent.blankenhagen.net/sites/<token>/` namespace is wired. Read this when adding a new user container, rotating a token, or debugging the plumbing. Agents publishing sites use `/home/agent/vault/_system/skills/serve-website/SKILL.md` instead — this file is for the person maintaining the infra.

## What lives where

| File | Role |
|---|---|
| `/workspace/sites-server.py` | The server. Parametric on `SITE_PORT` (default 8080) and `SITE_DIR` (default `~/sites`). Threaded, refuses directory listings. Bind-mounted into every user container at `/home/agent/.sites-server.py:ro`. Also run directly on the outer host at :8091. |
| `/workspace/site-tokens.json` | Source of truth: `{ "user-01": "<16-hex>", …, "outer": "<16-hex>" }`. Created/extended by `gen-compose.sh`. |
| `/workspace/nginx/nginx.conf` | One `location ^~ /sites/<token>/` block per entry in `site-tokens.json`. |
| `/workspace/entrypoint.sh` | On container boot: writes `$SITE_TOKEN` → `~/.site-token` and launches `~/.sites-server.py`. |
| `/workspace/gen-compose.sh` | Generates `docker-compose.yml`. Auto-creates a token for each new user, emits `SITE_TOKEN` env var and the bind mount for `sites-server.py`. |
| `~/.site-token` (inner) | Per-container token. Written by entrypoint from `$SITE_TOKEN`. |
| `~/.site-token` (outer) | Operator-written (the `outer` key from `site-tokens.json`). Not touched by entrypoint. |

## How traffic flows

```
Browser → Cloudflare Tunnel → nginx (openresty) → { user-NN:8080  OR  172.18.0.1:8091 }
```

The outer host is reachable from nginx via the docker bridge gateway (`172.18.0.1`). Each user container is reachable by hostname (`user-NN`) on its isolated bridge (`user-NN-net`); nginx is multi-homed across all user bridges + `agent-net`.

Port choice:
- **Inner**: 8080 (container-local, isolated per bridge — no conflicts between users).
- **Outer**: 8091 (8080 is the nginx host port, 8090 is `files.blankenhagen.net`).

## nginx block template

Inside the `server_name _;` block, near the other `/sites/<token>/` blocks:

```nginx
location ^~ /sites/<TOKEN>/ {
    access_by_lua_block { }
    rewrite ^/sites/<TOKEN>/(.*)$ /$1 break;
    proxy_pass http://<UPSTREAM>;              # user-NN:8080  or  172.18.0.1:8091
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    # Without this, python's http.server auto-redirect (/foo → /foo/)
    # escapes the /sites/<TOKEN>/ namespace and lands on the auth-gated
    # catch-all (the dashboard login).
    proxy_redirect ~^/(.*)$ https://$host/sites/<TOKEN>/$1;
}
```

Apply:
```bash
docker exec workspace-nginx-1 nginx -t && docker restart workspace-nginx-1
```

Use `docker restart`, **not** `nginx -s reload` — the Edit tool replaces nginx.conf's inode, and the bind mount still points at the old one until the container restarts.

## Procedures

### Add a new user container (user-06 etc.)

```bash
cd /workspace
bash gen-compose.sh 6            # extends site-tokens.json + compose
docker compose up -d             # creates user-06 (and refreshes others if changed)
```

Then edit `nginx.conf`: append a `/sites/<token-for-user-06>/` block with `proxy_pass http://user-06:8080`. Restart nginx. Done — entrypoint.sh inside user-06 writes the token and launches the server on first boot.

### Rotate a user's token

```bash
NEW=$(python3 -c "import secrets; print(secrets.token_hex(8))")
python3 -c "
import json
t = json.load(open('/workspace/site-tokens.json'))
t['user-02'] = '$NEW'
json.dump(t, open('/workspace/site-tokens.json','w'), indent=2); open('/workspace/site-tokens.json','a').write('\n')
"
# update nginx block (edit both the location path and the proxy_redirect) → restart nginx
# push the new token into the running container without recreating it:
docker exec -u agent workspace-user-02-1 bash -c "echo '$NEW' > /home/agent/.site-token"
```

Next container recreate will pick it up from the env var.

### Add a dynamic app alongside the default sites-server (coexistence)

Use this when an agent wants to run a Next.js / FastAPI / Hermes-style app under a token without displacing the default `sites-server.py` (which would kill every other `~/sites/<folder>/` route under the same token).

```bash
# 1. Run the dynamic app on its own port, bound to 0.0.0.0.
#    Pick any free port adjacent to the default — inner: 8081/8082/…; outer: 8092/8093/…
#    Configure the app's base path to /sites/<TOKEN>/<app>/.
```

Then append a location block to `/workspace/nginx/nginx.conf`, **before** the generic `/sites/<TOKEN>/` block so longest-prefix-match wins (`^~` handles that):

```nginx
location ^~ /sites/<TOKEN>/<app>/ {
    access_by_lua_block { }
    rewrite ^/sites/<TOKEN>/<app>/(.*)$ /$1 break;
    proxy_pass http://<UPSTREAM>;              # user-NN:<PORT>  or  172.18.0.1:<PORT>
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    # Required for SSE / WebSocket apps; harmless for plain HTTP.
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    # Same auto-redirect escape as the base block.
    proxy_redirect ~^/(.*)$ https://$host/sites/<TOKEN>/<app>/$1;
}
```

Apply with `docker exec workspace-nginx-1 nginx -t && docker restart workspace-nginx-1`. Verify all three layers cohabit:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://agent.blankenhagen.net/sites/<TOKEN>/<app>/"          # → 200 (dynamic app)
curl -s -o /dev/null -w '%{http_code}\n' "https://agent.blankenhagen.net/sites/<TOKEN>/<existing-static>/"  # → 200 (static still works)
curl -s -o /dev/null -w '%{http_code}\n' "https://agent.blankenhagen.net/sites/<TOKEN>/"                # → 404 (no listings, by design)
```

Repeat for a second dynamic app at `/sites/<TOKEN>/<app2>/` on a different port. Agent-facing version of this recipe: `/home/agent/vault/_system/skills/serve-website/SKILL.md` under "Dynamic app (recommended — coexists …)".

### Outer-host server lifecycle

```bash
# check
ss -tlnp 2>/dev/null | grep 8091

# start (backgrounded, survives shell exit)
setsid nohup env SITE_PORT=8091 python3 /workspace/sites-server.py \
    < /dev/null > /tmp/outer-sites-server.log 2>&1 &

# stop
pkill -f '/workspace/sites-server.py'
```

Doesn't currently survive an outer-host reboot. Add a systemd unit if/when that matters.

### Change the script

Edit `/workspace/sites-server.py`. Inner containers pick up the change on next container restart (bind mount is live, but the running python process has the old file cached). Push the new version into a running container without restart:
```bash
for i in 1 2 3 4 5; do
  c="workspace-user-0${i}-1"
  docker exec -u agent "$c" bash -c "pkill -f '.sites-server.py'; sleep 1; nohup python3 /home/agent/.sites-server.py > /tmp/sites-server.log 2>&1 &"
done
```

Outer: `pkill -f '/workspace/sites-server.py'` then relaunch per the lifecycle command above.

## Gotchas

1. **nginx.conf inode trap.** `Edit`/`Write` replaces the file inode; nginx's bind mount still points at the old one. Always `docker restart workspace-nginx-1` — `reload` is silently a no-op. Verify with `docker exec workspace-nginx-1 grep <new-token> /usr/local/openresty/nginx/conf/nginx.conf`.
2. **`/workspace/docker-compose.yml` is auto-generated by `gen-compose.sh`.** Permanent compose changes go in the generator, not the output file.
3. **Tokens are not secrets at rest.** They're in nginx.conf (readable by anyone on the outer host with file access) and in each container's env. The threat model is *random internet visitor guessing*, not insider.
4. **Listings are off in `sites-server.py`, but not in replacement servers.** If an inner user swaps in caddy/next/etc., they inherit the obligation to turn off browsing. The skill warns them; there's no outer enforcement.
5. **Port 8080 on outer is taken by nginx.** Outer sites-server MUST use a different port. Current choice: 8091. Avoid 8090 (files.blankenhagen.net).
6. **Inner containers are isolated.** `user-01` can't reach `user-02:8080`. Shared services (nginx, collabora, gemini-gateway) are multi-homed across all user bridges.

## Isolation model

- `agent-net` — shared services only (nginx, collabora, cloudflared, gemini-gateway).
- `user-NN-net` — one bridge per user, subnet `10.100.NN.0/24`.
- Each user container attaches **only** to its own `user-NN-net`.
- `nginx` and `collabora` are multi-homed across `agent-net` + every `user-NN-net`.
- Network layer is private between users; the `/sites/<token>/` namespace is the only cross-user surface, and only nginx can traverse it.
