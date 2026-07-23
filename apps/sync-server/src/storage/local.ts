/**
 * LocalFileStorage — stores PDFs on disk under {dataDir}/files/.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "./interface";

export class LocalFileStorage implements FileStorage {
  private filesDir: string;

  constructor(dataDir: string) {
    this.filesDir = path.join(dataDir, "files");
  }

  private async ensureDir() {
    await fs.mkdir(this.filesDir, { recursive: true });
  }

  private filePath(documentId: string): string {
    return path.join(this.filesDir, `${documentId}.pdf`);
  }

  async upload(documentId: string, buffer: Buffer): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.filePath(documentId), buffer);
  }

  async download(documentId: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.filePath(documentId));
    } catch {
      return null;
    }
  }

  async delete(documentId: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(documentId));
    } catch {
      // already deleted — noop
    }
  }

  async exists(documentId: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(documentId));
      return true;
    } catch {
      return false;
    }
  }
}
