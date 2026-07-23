/**
 * FileStorage interface — abstraction over PDF file persistence.
 *
 * Implementations: LocalFileStorage (fs), S3FileStorage (future).
 */

export interface FileStorage {
  upload(documentId: string, buffer: Buffer): Promise<void>;
  download(documentId: string): Promise<Buffer | null>;
  delete(documentId: string): Promise<void>;
  exists(documentId: string): Promise<boolean>;
}
