# Defect Log

| ID | Area | Symptom | Root Cause | Status | Fix / Notes |
|----|------|---------|------------|--------|-------------|
| D-001 | Chat threads | Conversation page shows “column profiles_1.avatar_url does not exist” and blocks the thread | Supabase profiles table in some envs lacks `avatar_url`, but chat selects requested it | Fixed | Removed `avatar_url` from chat thread selects. Files: `src/app/dashboard/chat/page.tsx`, `src/app/dashboard/chat/[userId]/page.tsx`. No DB migration needed. |
| D-002 | Campus Pulse feed | User’s own message appears twice (self-echo) | Optimistic append plus realtime insert append | Fixed | Rebuilt feed to upsert by `id` only. File: `src/app/dashboard/community/page.tsx`. |
| D-003 | Dashboard promo | Clicking hot-deal banner shows “Product not found.” | Hardcoded `/dashboard/product/1` link | Fixed | Banner now points to a live featured listing (or hides). File: `src/app/dashboard/page.tsx`. |
| D-004 | Product detail | “Product not found” page is a dead end | Missing fallback navigation when id invalid | Fixed | Added recovery UI with return to Marketplace. File: `src/app/dashboard/product/[id]/page.tsx`. |
| D-005 | Listings fetch | Console error `Supabase listings fetch error: {}` in some envs | Profiles join may not exist / schema mismatch | Fixed | Dashboard listings loader now falls back to plain `listings` select and logs structured errors. File: `src/app/dashboard/page.tsx`. |
| D-006 | Product fetch | Product page could fail if profile join missing | Same join mismatch as above | Fixed | Product detail loader now retries without profile join and fetches profile separately when needed. File: `src/app/dashboard/product/[id]/page.tsx`. |
| D-007 | Lint debt (legacy) | Many `any`/unused warnings across dashboard/product | Pre-existing code quality debt | Known | Not changed; lint still reports legacy issues. |
