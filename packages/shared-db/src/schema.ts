import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalName: text("original_name"),
  totalPages: integer("total_pages"),
  metadata: text("metadata"),
  folderId: text("folder_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const summaries = sqliteTable(
  "summaries",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isAiGenerated: integer("is_ai_generated", { mode: "boolean" })
      .notNull()
      .default(false),
    sourceLang: text("source_lang"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.documentId] }),
  })
);

export const annotations = sqliteTable(
  "annotations",
  {
    id: text("id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    text: text("text"),
    pageNumber: integer("page_number"),
    embedData: text("embed_data").notNull(),
    kind: text("kind").notNull().default("annotation"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.documentId] }),
  })
);

export const aiResults = sqliteTable(
  "ai_results",
  {
    annotationId: text("annotation_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    version: integer("version").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.annotationId, table.documentId] }),
  })
);

export const reviewLogs = sqliteTable(
  "review_logs",
  {
    id: text("id").notNull(),
    annotationId: text("annotation_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.annotationId, table.documentId] }),
  })
);

export const fsrsCards = sqliteTable(
  "fsrs_cards",
  {
    annotationId: text("annotation_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.annotationId, table.documentId] }),
  })
);
