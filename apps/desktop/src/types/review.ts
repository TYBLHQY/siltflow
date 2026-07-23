/** A single review log as stored in SQLite and returned from IPC. */
export interface ReviewLogEntry {
  id: string;
  annotationId: string;
  documentId: string;
  /** Serialized ReviewLog JSON from ts-fsrs */
  data: string;
  createdAt: string;
}

/** Parsed structure of the ReviewLog data field (ts-fsrs ReviewLog w/ Date → ISO string) */
export interface ReviewLogData {
  rating: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
}

/** Card snapshot at the time the log was created, stored alongside the log */
export interface CardSnapshot {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
}

/** Rustered type sent to IPC for saving */
export interface ReviewLogSaveRequest {
  /** The ts-fsrs ReviewLog (Dates serialized to ISO strings) */
  log: ReviewLogData;
  /** Snapshot of the Card state AFTER this review */
  card: CardSnapshot;
  /** Grade that was given */
  grade: number;
}
