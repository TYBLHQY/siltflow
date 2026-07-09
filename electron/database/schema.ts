import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  totalPages: integer("total_pages"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const annotations = sqliteTable("annotations", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'highlight', 'underline', 'note'
  text: text("text"),
  pageNumber: integer("page_number"),
  embedData: text("embed_data").notNull(), // JSON: AnnotationTransferItem[]
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})
