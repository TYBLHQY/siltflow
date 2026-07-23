/**
 * Stats routes — 5 read-only endpoints using @siltflow/shared-lib pure functions.
 *
 * All endpoints load raw data from SQLite, parse JSON columns,
 * and pass them through shared-lib compute functions.
 *
 * Endpoints:
 *   GET /api/stats/overview
 *   GET /api/stats/daily-reviews
 *   GET /api/stats/grade-distribution
 *   GET /api/stats/stability-histogram
 *   GET /api/stats/review-forecast
 *
 * Additional stats endpoints (calendar heatmap, difficulty histogram, etc.)
 * can be added following the same pattern — see plan Section 5.3.
 */

import { Hono } from "hono";
import { getSqlite } from "../db";
import type { Variables } from "../types";

/** Parse a JSON string or return null. */
function parseJson(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export const statsRoutes = new Hono<{ Variables: Variables }>()
  .get("/stats/overview", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    // Pure computation using ts-fsrs card shapes
    const stats = computeOverviewStats(cards);
    return c.json(stats);
  })
  .get("/stats/daily-reviews", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs = (sql.prepare("SELECT data, created_at FROM review_logs ORDER BY created_at ASC").all() as any[])
      .map((r: { data: string; created_at: string }) => ({
        data: parseJson(r.data),
        createdAt: r.created_at,
      }));

    const days = parseInt(c.req.query("days") ?? "30", 10);
    const result = computeDailyReviews(logs, days);
    return c.json(result);
  })
  .get("/stats/grade-distribution", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs = (sql.prepare("SELECT data FROM review_logs").all() as any[])
      .map((r: { data: string }) => ({ data: parseJson(r.data) }));

    const result = computeGradeDistribution(logs);
    return c.json(result);
  })
  .get("/stats/stability-histogram", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const result = computeStabilityHistogram(cards);
    return c.json(result);
  })
  .get("/stats/review-forecast", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const days = parseInt(c.req.query("days") ?? "14", 10);
    const result = computeReviewForecast(cards, days);
    return c.json(result);
  })

  // ── Chart 3: Calendar Heatmap ──────────────────────────────────────
  .get("/stats/calendar-heatmap", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const logs = (sql.prepare("SELECT created_at FROM review_logs").all() as Array<{ created_at: string }>)
      .map((r) => ({ createdAt: r.created_at }));
    const result = computeCalendarHeatmap(logs);
    return c.json(Object.fromEntries(result));
  })

  // ── Chart 6: Retrievability Histogram ──────────────────────────────
  .get("/stats/retrievability-histogram", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const result = computeRetrievabilityHistogram(cards);
    return c.json(result);
  })

  // ── Chart 7: Difficulty Histogram ──────────────────────────────────
  .get("/stats/difficulty-histogram", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const result = computeDifficultyHistogram(cards);
    return c.json(result);
  })

  // ── Chart 8: Interval Histogram ────────────────────────────────────
  .get("/stats/interval-histogram", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const result = computeIntervalHistogram(cards);
    return c.json(result);
  })

  // ── Chart 9: Knowledge Growth ──────────────────────────────────────
  .get("/stats/knowledge-growth", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    const logs = (sql.prepare(
      "SELECT created_at, data, annotation_id FROM review_logs ORDER BY created_at ASC"
    ).all() as Array<{ created_at: string; data: string; annotation_id: string }>)
      .map((r) => ({
        createdAt: r.created_at,
        data: r.data,
        annotationId: r.annotation_id,
      }));

    const result = computeKnowledgeGrowth(logs);
    return c.json(result);
  })

  // ── Chart 11: Forgetting Curves (theoretical, no data needed) ──────
  .get("/stats/forgetting-curves", (c) => {
    const result = computeForgettingCurves();
    return c.json(result);
  })

  // ── Chart 12: Retention Tradeoff ───────────────────────────────────
  .get("/stats/retention-tradeoff", (c) => {
    const sql = getSqlite();
    if (!sql) return c.json({ error: "database not ready" }, 503);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards = (sql.prepare("SELECT data FROM fsrs_cards").all() as any[])
      .map((r: { data: string }) => parseJson(r.data))
      .filter(Boolean);

    const retention = parseFloat(c.req.query("retention") ?? "0.9");
    const result = computeRetentionTradeoff(cards, retention);
    return c.json(result);
  });

// ── Inline imports from shared-lib (keep server deps clean) ──────────

import {
  computeOverviewStats,
  computeDailyReviews,
  computeGradeDistribution,
  computeStabilityHistogram,
  computeReviewForecast,
  computeCalendarHeatmap,
  computeRetrievabilityHistogram,
  computeDifficultyHistogram,
  computeIntervalHistogram,
  computeKnowledgeGrowth,
  computeForgettingCurves,
  computeRetentionTradeoff,
} from "@siltflow/shared-lib";
