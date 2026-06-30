# Launch Checklist — 2026-04-22

- [x] DNS TTL lowered to 60s 24h before cutover
- [x] Vercel deploy promoted to production
- [x] WordPress robots.txt updated to `noindex` 24h before cutover
- [x] 301 redirects deployed (47 paths in `redirects.csv`)
- [x] Search Console: submit new sitemap, request re-crawl of old paths
- [x] Plausible analytics swapped from WP plugin → Vercel function
- [x] Email DNS (SPF/DKIM/DMARC) verified — Postmark unchanged
- [x] Status banner removed from staging
- [x] WordPress instance shut down + backup → S3 cold storage
- [x] All-hands announcement sent
