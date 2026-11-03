/**
 * ARCHIVED / DELEGATED ENDPOINT ROUTER
 * 
 * WHY THIS IS DONE:
 * Cloudflare Pages Function file-system routing gives explicit file paths precedence over dynamic 
 * catch-all routes (`[[path]].js`). Keeping standalone endpoint logic here caused requests like 
 * `/api/send-dvir-email` to collide with `dvir.js` and fail with "Unknown table: send-dvir-email".
 * 
 * WHAT THIS FILE ORIGINALLY DID:
 * Handled 49 CFR Part 396 DVIR inspection submissions (GET/POST), regional unit metric calculations 
 * (US, CA, AU, EU), prior inspection log queries for Section 396.13, and D1 (`dvir_inspections`) / KV persistence.
 * 
 * CURRENT STATUS:
 * 100% of this logic has been merged into `functions/api/[[path]].js` (lines 464–678).
 * This stub safely delegates all traffic to `[[path]].js` without deleting the file.
 * To restore original logic, view Git commit history for this file.
 */

import { onRequest as catchAllOnRequest } from './[[path]].js';

export async function onRequest(context) {
  return catchAllOnRequest(context);
}
