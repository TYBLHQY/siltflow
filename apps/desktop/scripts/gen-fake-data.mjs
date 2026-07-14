import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

// --- Seeded PRNG ---
class Rng {
  constructor(seed) { this._seed = seed; this._state = seed; }
  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  approx(val, spread = 0.15) { return val * (1 + (this.next() - 0.5) * 2 * spread); }
}

const rng = new Rng(42);

// --- Read existing annotations ---
const annLines = readFileSync("/tmp/existing-annotations.txt", "utf-8").trim().split("\n");
const annotations = annLines.map((l) => {
  const [id, docId] = l.split(",");
  return { id, documentId: docId };
});
console.error(`Read ${annotations.length} existing annotations`);

function isoTs(dateStr) {
  return `${dateStr}T${String(rng.int(0, 23)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}.${String(rng.int(100, 999)).padStart(3, "0")}Z`;
}

function daysAgo(n) {
  const d = new Date("2026-07-14T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// --- Generate fsrs_cards (25 cards) ---
const cardAnnotations = annotations.slice(0, 25);
const cards = [];
const GRADE_POOL = [1, 1, 1, 2, 2, 3, 3, 3, 3, 4];

for (let i = 0; i < cardAnnotations.length; i++) {
  const ann = cardAnnotations[i];
  const state = i < 3 ? 0 : i < 8 ? 1 : i < 18 ? 2 : 3;
  const createdDaysAgo = rng.int(1, 60);
  const createdDate = daysAgo(createdDaysAgo);

  let stability, difficulty, reps, lapses, scheduled_days, due, last_review;

  if (state === 0) {
    due = isoTs(daysAgo(rng.int(0, 5)));
    stability = 0; difficulty = 0; reps = 0; lapses = 0; scheduled_days = 0;
    last_review = null;
  } else {
    reps = rng.int(1, 20);
    lapses = rng.int(0, Math.min(reps, 5));
    difficulty = Math.round(Math.min(Math.max(rng.approx(0.3 + rng.next() * 0.6, 0.1), 0.15), 0.95) * 100) / 100;
    scheduled_days = state === 2 ? rng.int(1, 365) : rng.int(0, 7);

    if (state === 2) {
      if (i < 12) stability = rng.int(1, 20) + rng.next();
      else if (i < 15) stability = rng.int(21, 90) + rng.next();
      else stability = rng.int(91, 400) + rng.next();
    } else if (state === 1) stability = 1 + rng.next() * 3;
    else stability = rng.int(1, 30) + rng.next();

    stability = Math.round(stability * 10000) / 10000;
    const lastReviewDaysAgo = rng.int(0, Math.min(createdDaysAgo, 14));
    last_review = daysAgo(lastReviewDaysAgo);
    due = isoTs(daysAgo(Math.max(0, lastReviewDaysAgo - scheduled_days)));
  }

  const cardData = { due, stability, difficulty, elapsed_days: state === 0 ? 0 : rng.int(0, 30), scheduled_days, reps, lapses, state };
  if (last_review) cardData.last_review = isoTs(last_review);

  cards.push({
    annotationId: ann.id, documentId: ann.documentId,
    data: JSON.stringify(cardData),
    createdAt: isoTs(createdDate), updatedAt: isoTs(createdDate),
  });
}

console.error(`Generated ${cards.length} fsrs_cards`);

// --- Generate review_logs (spanning 60 days) ---
const logs = [];
let totalLogs = 0;

for (const card of cards) {
  const cardData = JSON.parse(card.data);
  if (cardData.state === 0) continue;

  const numReviews = rng.int(5, 25);
  let currStab = 0.5 + rng.next() * 2;
  let currDiff = 0.3 + rng.next() * 0.5;
  let currState = 0;
  let totLapses = 0;

  for (let r = 0; r < numReviews; r++) {
    const daysBack = rng.int(1, 60);
    const reviewDate = daysAgo(daysBack);
    const grade = rng.pick(GRADE_POOL);

    if (currState === 0) currState = 1;

    if (grade === 1) {
      currStab = Math.max(0.5, currStab * 0.3);
      if (currState === 2) currState = 3;
      totLapses++;
    } else if (grade === 2) {
      currStab *= 1.2;
      if (currState === 1) currState = 2;
    } else if (grade === 3) {
      currStab *= 2.0;
      if (currState === 1) currState = 2;
    } else {
      currStab *= 2.8;
      if (currState === 1) currState = 2;
    }

    currDiff = Math.min(Math.max(currDiff + (grade >= 3 ? -0.02 : 0.05), 0.1), 0.9);
    currStab = Math.round(currStab * 10000) / 10000;
    currDiff = Math.round(currDiff * 100) / 100;

    const reviewTs = isoTs(reviewDate);

    const logData = {
      grade,
      log: { rating: grade, state: currState, due: reviewTs, stability: currStab, difficulty: currDiff, scheduled_days: Math.round(currStab), review: reviewTs },
      card: { due: reviewTs, stability: currStab, difficulty: currDiff, scheduled_days: Math.round(currStab), reps: r + 1, lapses: totLapses, state: currState },
    };

    logs.push({
      id: randomUUID(), annotationId: card.annotationId, documentId: card.documentId,
      data: JSON.stringify(logData), createdAt: reviewTs,
    });
    totalLogs++;
  }
}

console.error(`Generated ${totalLogs} review_logs`);

// --- INSERT into SQLite ---
const db = new Database("/data/workspace/siltflow-repo/.siltflow/data.db");
db.exec("DELETE FROM review_logs");
db.exec("DELETE FROM fsrs_cards");

const insertCard = db.prepare(
  "INSERT INTO fsrs_cards (annotation_id, document_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
);
const insertManyCards = db.transaction((items) => {
  for (const c of items) insertCard.run(c.annotationId, c.documentId, c.data, c.createdAt, c.updatedAt);
});
insertManyCards(cards);

const insertLog = db.prepare(
  "INSERT INTO review_logs (id, annotation_id, document_id, data, created_at) VALUES (?, ?, ?, ?, ?)"
);
const insertManyLogs = db.transaction((items) => {
  for (const l of items) insertLog.run(l.id, l.annotationId, l.documentId, l.data, l.createdAt);
});
insertManyLogs(logs);

// Verify
const dc = db.prepare("SELECT count(*) as c FROM review_logs").get();
const cc = db.prepare("SELECT count(*) as c FROM fsrs_cards").get();
const dd = db.prepare("SELECT DISTINCT substr(created_at,1,10) as d FROM review_logs ORDER BY d").all();
const ss = db.prepare("SELECT json_extract(data,'$.state') as s, count(*) as c FROM fsrs_cards GROUP BY s ORDER BY s").all();
db.close();

console.log(`Done: ${cc.c} cards, ${dc.c} logs, ${dd.length} distinct dates`);
console.log(`Card states: ${JSON.stringify(ss)}`);
console.log(`Date range: ${dd[0]?.d} to ${dd[dd.length - 1]?.d}`);
