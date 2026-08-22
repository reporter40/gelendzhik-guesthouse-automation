# Production Verification — D3.1

**Date:** 2026-05-20 (initial) · **Updated:** 2026-05-16 (D3.1C-local documented; gate frozen at PARTIAL_PASS)  
**Verifier:** Cursor agent (automated + API smoke; UI partial)  
**Canonical repo:** `gelendzhik-guesthouse-automation`  
**Reference:** [HANDOFF.md](../HANDOFF.md)

**Current:** **D3.1 = PARTIAL_PASS** — awaiting manual sign-off only. No further code/workflow/DB changes until user reply.

---

## D3.1A — WF10 deploy (2026-05-20 23:15 UTC)

| Item | Result |
|------|--------|
| Backup (VPS) | **PASS** — `/root/backups/wf_deploy_20260520_231531/workflow_entity.json` |
| Backup (local copy) | **PASS** — `infrastructure/backups/wf10_d3_1a_20260520/workflow_entity_pre_deploy.json` |
| Import | **PASS** — `workflows/10_admin_api.json` (135 nodes) via `deploy_workflow_safe.sh` |
| WF ID | `82575887-be9e-4267-8e8e-2d760de2a986` |
| Version after deploy | `ef1e633b-9989-4446-9f8c-fae05927b17b` |
| Active | **true** (restored post-import) |
| Webhook | `adminapi1234/admin` POST — recreated in `webhook_entity` |
| n8n restart | **PASS** |

**Pre-deploy version:** `93f378ee-61d3-4475-b719-f999486004c5`

---

## D3.1B — PCS system_vars seed + re-verification (2026-05-20)

**User approvals:** DB seed ✓ · PCS save smoke ✓ · MRL write smoke ✓

### Schema check (pre-seed)

| Column | Type | Nullable |
|--------|------|----------|
| `key` | varchar(100) | NOT NULL, **PRIMARY KEY** |
| `value` | text | NOT NULL |
| `description` | text | nullable |
| `updated_at` | timestamptz | default `now()` |

`ON CONFLICT (key) DO NOTHING` — supported via PK on `key`.

### SQL executed (production `n8n_gelendzhik`)

```sql
INSERT INTO system_vars (key, value, description) VALUES
  ('property_context_map', '{}', 'JSON map: apartment_id -> property_context for direct offers'),
  ('default_property_context', '', 'Fallback property context for direct offers')
ON CONFLICT (key) DO NOTHING;
```

**Result:** `INSERT 0 2` — keys created.

### API smoke (post-seed)

| Test | Result | Response |
|------|--------|----------|
| `property_context_settings` get | **PASS** | `{"ok":true,"property_context_map":{},"default_property_context":null}` |
| `property_context_settings` save (empty map) | **PASS** | `ok: true`, `audit_recorded: true` |
| `manual_referral_lead` write | **PASS** | `audit_recorded: true`, `audit_id` returned |
| `pricing_action_audit_log` | **PASS** | 6 rows; all have `metadata` |
| `property_context_settings_save` in audit | **PASS** | 1 row, `metadata.event_type` = `property_context_settings_save` |
| `manual_referral_lead_logged` in audit | **PASS** | 1 row, `notes`: `D3.1 verification test` |

**Note:** empty `default_property_context` in DB (`''`) is returned as `null` in get — expected WF10 `PCS Format Get` behavior.

### UI checklist (logged-in)

| Check | Status |
|-------|--------|
| All HANDOFF `/revenue` items | **MANUAL_REQUIRED** — confirm in browser as admin |

### Vercel

| Check | Status |
|-------|--------|
| Production deploy / env vars | **MANUAL_REQUIRED** — confirm in Vercel dashboard |

---

## D3.1C — Manual UI + Vercel confirmation (pending)

**Gate:** D3.1 → **PASSED** only after explicit user message: **`UI OK, Vercel OK`**.

**Agent actions on user reply (docs only — no code/workflow/DB changes):**

| User message | D3.1C UI | Vercel | Final D3.1 |
|--------------|----------|--------|------------|
| `UI OK, Vercel OK` | PASS | PASS | **PASSED** |
| `UI OK` | PASS | MANUAL_REQUIRED | **PARTIAL_PASS** |
| `Vercel OK` | MANUAL_REQUIRED | PASS | **PARTIAL_PASS** |
| Concrete blocker reported | — | — | **PARTIAL_PASS** + blocker logged; one targeted fix only |

**Backend/API (D3.1A + D3.1B + D3.1C-local):** already **PASS** — no code/DB/workflow changes in D3.1C gate wait.

**Confirmed PASS (automated / documented):**

- WF10 deploy
- PCS seed / API smoke
- MRL write smoke
- Audit metadata
- D3.1C-local Next config ESM fix (documented)

**PENDING (manual only):**

- Production UI checklist (below)
- Vercel dashboard confirmation (below)

### A. UI checklist — https://admin.aquatoring.ru/revenue

| # | Check | Status |
|---|--------|--------|
| 1 | Login works | **PENDING** |
| 2 | `/revenue` loads with data | **PENDING** |
| 3 | Direct Offer Panel visible (`direct_price > 0`) | **PENDING** |
| 4 | Presets change Telegram / WhatsApp / Short | **PENDING** |
| 5 | Property context settings loads JSON (not empty body) | **PENDING** |
| 6 | PCS save works | **PENDING** |
| 7 | Referral economics preview (valid economics) | **PENDING** |
| 8 | Referral invitation copy panel | **PENDING** |
| 9 | Manual referral lead save works | **PENDING** |
| 10 | Audit filter **Referral leads** shows MRL (incl. D3.1 test) | **PENDING** |
| 11 | CSV / TSV export works | **PENDING** |
| 12 | `/revenue?auditFilter=referral` — filter + scroll to `#audit-log` | **PENDING** |

**Deep link test:** https://admin.aquatoring.ru/revenue?auditFilter=referral

### B. Vercel dashboard

| # | Check | Status |
|---|--------|--------|
| 1 | Latest **Production** deployment — successful | **PENDING** |
| 2 | `ADMIN_API_URL` set | **PENDING** |
| 3 | `ADMIN_API_TOKEN` set | **PENDING** |
| 4 | Deployment matches current `admin/` code on `main` | **PENDING** |

See [admin/VERCEL.md](../admin/VERCEL.md) for project/team context.

### User sign-off (fill when confirmed)

| Sign-off | Date | By |
|----------|------|-----|
| UI OK | _pending_ | _user_ |
| Vercel OK | _pending_ | _user_ |

**Reply format:** `UI OK` · `Vercel OK` · `UI OK, Vercel OK` · or list failed items.

### D3.1C-local — Next config ESM fix (2026-05-16)

**Scope:** local dev/build stabilization only — no pricing, RC export, workflows, DB, or D1/D2 business logic changes.

| Change | Status |
|--------|--------|
| Removed `admin/next.config.ts` | **DONE** |
| Added `admin/next.config.mjs` (pure ESM) | **DONE** |
| `turbopack.root` → `admin/` directory | **DONE** |
| `npm run build` (local) | **PASS** |
| `_tmp_gelendzhik/admin` synced | **DONE** |

**Symptom fixed:** `Failed to load next.config.ts` / `exports is not defined in ES module scope` → blank `/login` or dev crash.

**Local dev (deterministic):**

```bash
kill -9 24802          # or kill -9 $(lsof -t -i :3000)
lsof -i :3000          # expect: empty
cd ~/gelendzhik-guesthouse-automation/admin
git pull               # if fixes applied elsewhere
ls next.config.*       # expect: next.config.mjs only (no .ts)
npm run dev            # open URL from "Local:" line only
```

Then: `http://localhost:PORT/login` → after login → `/revenue`.

**After local dev works:** continue **D3.1C manual checklist** (UI OK + Vercel OK) before marking D3.1 **PASSED**.

---

## Environment

| Component | Endpoint / host |
|-----------|-----------------|
| Admin (Vercel) | https://admin.aquatoring.ru |
| n8n (VPS) | https://owner.aquatoring.ru · `178.105.139.57` |
| Admin API webhook | `https://owner.aquatoring.ru/webhook/adminapi1234/admin` |

---

## Local gate result

| Check | Result |
|-------|--------|
| `cd admin && npm run test` | **PASS** — 161 tests (16 files) |
| `cd admin && npm run build` | **PASS** — Next.js 16.2.6 build OK |

Repo code is release-ready; production blockers are **deploy / WF10**, not local gate.

---

## Vercel / admin app status

| Check | Result | Notes |
|-------|--------|-------|
| `admin.aquatoring.ru/login` | **PASS** | HTTP 200, `server: Vercel`, Next.js |
| `admin.aquatoring.ru/revenue` (unauthenticated) | **PASS** | HTTP 307 → `/login` (auth gate works) |
| Vercel CLI last deployment | **MANUAL_REQUIRED** | `vercel whoami` — invalid/expired token; check [Vercel dashboard](https://vercel.com) |
| Latest deployment build successful | **MANUAL_REQUIRED** | Confirm Production deployment for `admin/` project |
| `ADMIN_API_TOKEN` configured | **LIKELY** | Production Admin API accepts token (health OK); exact env var name/value not verified in dashboard |
| D1/D2 UI bundles on Production | **PARTIAL** | App serves `/revenue` route (`x-matched-path: /revenue`); full UI checklist needs logged-in session |

**Inference:** Vercel admin app is **online** and auth-protected. Cannot confirm deployment SHA vs `main` without dashboard access.

---

## n8n WF10 status

**After D3.1A deploy** — git `workflows/10_admin_api.json` is on production.

| Action / check | Pre-deploy (D3.1) | Post-deploy (D3.1A) |
|--------------|-------------------|---------------------|
| `health` | PASS | **PASS** |
| `property_context_settings` get | `unknown_action` | **PASS** (after D3.1B seed) — JSON body with empty map |
| `manual_referral_lead` save (empty) | `unknown_action` | **PASS** — HTTP 400 `referrer name or contact required` |
| `pricing_action_audit_log` + `metadata` | no `metadata` key | **PASS** — all 4 rows include `metadata` object |
| `property_context_settings_save` in audit | absent | absent (no PCS save run yet) |
| `manual_referral_lead_logged` in audit | absent | absent (write smoke not run) |

**PCS get (pre-D3.1B):** empty body when `system_vars` keys missing — **fixed** by D3.1B seed.

**MRL write smoke:** **PASS** (D3.1B, user-approved).

---

## Revenue UI checklist

Performed without admin session cookie — **logged-in checks MANUAL_REQUIRED**.

| Check | Status |
|-------|--------|
| Login works | **MANUAL_REQUIRED** |
| `/revenue` loads with data | **MANUAL_REQUIRED** (unauthenticated → redirect OK) |
| Direct Offer Panel (`direct_price > 0`) | **MANUAL_REQUIRED** (API: 4 recs with `direct_price > 0` exist — UI should show panels **after** login) |
| Direct Offer Presets change texts | **MANUAL_REQUIRED** |
| Property context settings load/save | **MANUAL_REQUIRED** — API PASS; confirm in UI |
| PCS save → audit | **API PASS** — confirm in UI |
| Referral economics preview | **MANUAL_REQUIRED** (client-side; needs row + login) |
| Referral invitation copy panel | **MANUAL_REQUIRED** |
| Manual referral lead save | **API PASS** — confirm in UI |
| Audit row `manual_referral_lead_logged` | **API PASS** — confirm filter Referral leads in UI |
| Audit filter Referral leads | **MANUAL_REQUIRED** (UI may render; data empty until MRL works) |
| CSV/TSV export | **MANUAL_REQUIRED** |
| `/revenue?auditFilter=referral` filter + scroll | **MANUAL_REQUIRED** |

**Write tests skipped:** No PCS/MRL save executed on production (would fail; avoids audit pollution).

---

## Admin API checklist

| Test | Result |
|------|--------|
| A. `property_context_settings` get | **PASS** (D3.1B) |
| B. `property_context_settings` save | **PASS** (D3.1B) |
| C. `manual_referral_lead` validation (empty save) | **PASS** |
| C. `manual_referral_lead` write smoke | **PASS** (D3.1B) |
| `health` | **PASS** |
| `pricing_recommendations` | **PASS** — 4 rows, 4 with `direct_price > 0` |
| `pricing_action_audit_log` | **PASS** — 4 rows, **all include `metadata`** |

Token auth works; **WF10 deployed**.

---

## Safety boundaries verification

Verified against **repo code** (production behavior for referral/PCS follows deployed WF10).

| Boundary | Verification |
|----------|----------------|
| RC export does not include `property_context` | **PASS** — `RC_EXPORT_AUDIT_META_KEYS` test excludes `property_context` |
| Pricing formulas unchanged in D2 | **PASS** — `referral-direct-economics.ts` isolated; does not write `direct_price` / `rc_net_price` |
| Referral does not recalculate `direct_price` / `rc_net_price` | **PASS** — read-only inputs |
| Referral lead = audit log only | **PASS** (design); **write not exercised** (smoke skipped) |
| No public referral links/codes | **PASS** — no generators in admin |
| No click/booking tracking | **PASS** |
| No payout automation | **PASS** |
| No booking engine / CRM statuses | **PASS** |

Safety **design** intact; D1/D2 **operational** safety on production depends on deploying git WF10 without changing formulas.

---

## Issues found

### Resolved by D3.1A

1. ~~WF10 stale~~ — **fixed** (`unknown_action` gone for PCS/MRL).
2. ~~Audit log without `metadata`~~ — **fixed** (all sampled rows have `metadata`).

### Open (post-D3.1B)

1. **MANUAL:** Logged-in `/revenue` UI checklist — https://admin.aquatoring.ru/revenue
2. **MANUAL:** Vercel Production deploy + `ADMIN_API_URL` + `ADMIN_API_TOKEN`

### Resolved by D3.1B

3. ~~PCS get empty body~~ — **fixed** (system_vars seeded).

---

## Required follow-ups

1. **You:** Logged-in UI walkthrough (checklist in [HANDOFF.md](../HANDOFF.md) Admin verification).
2. **You:** Vercel dashboard — latest Production build + env vars.
3. Reply when UI + Vercel confirmed → agent sets **D3.1 PASSED** in this doc.

---

## Final status

# D3.1 PARTIAL_PASS

| Layer | Status |
|-------|--------|
| **D3.1A WF10 deploy** | **PASS** |
| **D3.1B PCS seed + API smoke** | **PASS** |
| **MRL write smoke** | **PASS** |
| **Audit metadata** | **PASS** |
| **D3.1C-local Next config ESM** | **documented** |
| Local gate (`npm run test` / `build`) | **PASS** |
| **D3.1C Production UI** | **PENDING** |
| **D3.1C Vercel** | **PENDING** |

**D3.1B criterion:** met — `property_context_settings` get returns JSON (not empty HTTP 200).

**D3.1 PASSED:** only after explicit **`UI OK, Vercel OK`** from user.
