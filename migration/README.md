# Stage 1 migration workspace (Base44 → own platform)

Phase 0 artifacts — the insurance snapshot and content inventory taken before any
migration work. **Keep the snapshot forever** (it outlives the Base44 cancellation).

```
migration/
├── GAP-REPORT.md                    # Phase 0 findings + decisions needed (review gate for Phase 1)
├── base44-snapshot-2026-07-10/      # full raw export: 13 entities + media/ + google-refs/ + manifest.json
├── content/                         # live-site copy: <route>.md + assets/ + screenshots/ + inventory.json
└── scripts/
    ├── base44-snapshot.mjs          # re-download:  BASE44_API_KEY=<key> node migration/scripts/base44-snapshot.mjs
    └── crawl-content.mjs            # re-crawl:     node migration/scripts/crawl-content.mjs [/extra-route ...]
```

Security: the Base44 API key is supplied via the `BASE44_API_KEY` env var at run time and
is **never committed** — same rule as the Supabase service keys.

Sources of truth (per the Stage 1 brief): **GoHighLevel** is the system of record for
business/community data (one-way GHL → Supabase sync, Phase 1). This snapshot and the
Google Sheet (a Base44 export artifact) are insurance/verification, not sources of truth.
The Google Calendar feeds the events inbound sync (public ICS; TZ America/Los_Angeles).
