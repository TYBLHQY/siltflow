# Siltflow `data.db` 外部使用说明书

> 面向**读** Siltflow 数据的外部消费者：Obsidian importer、脚本、其他工具。Siltflow 本体（Electron 主进程 + 渲染器）不在本文档范围——这里只讲数据文件本身，以及如何安全地读它。
>
> 本文档随代码演进，改 schema / blob 结构时必须同步更新（见 [版本与迁移](#9-版本与迁移)）。

---

## 1. 概述

- 应用：Siltflow（Electron + React 语言学习工具）
- 存储：SQLite 单文件，位于每个 vault 目录下的 `.siltflow/data.db`
- 引擎：`better-sqlite3`（WAL 模式，`foreign_keys = ON`）
- 数据流：渲染器 → preload IPC → 主进程 better-sqlite3 → `data.db`
- 已接入的外部消费者：`obsidian-siltflow-importer`（读 `data.db` 渲染卡片）

**最重要的一件事**：一个"卡片"不是一行，而是 **`annotations` 一行 + 可选 `ai_results` 一行 + 可选 `fsrs_cards` 一行**，通过 `(annotation_id, document_id)` 关联。见 [§5 卡片重建](#5-重建一张卡片)。

---

## 2. 数据库位置与文件

```
<vault>/
├── .siltflow/
│   ├── data.db          # SQLite 主库（本文档对象）
│   ├── data.db-wal      # WAL 日志（应用运行时存在）
│   ├── data.db-shm      # WAL 共享内存（应用运行时存在）
│   └── config.json      # AI profile / 快捷键 / 设置 —— 不在 DB 里！
└── documents/
    └── <document_id>.pdf   # 每个 documents 行对应的 PDF 文件
```

- **WAL 文件**：应用开着时 `data.db-wal` / `data.db-shm` 可能很大。**只读打开即可读到已提交数据**，不必等 app 关闭。
- `documents.id` 就是文件名（`<id>.pdf`），无扩展名存列、`id` 列与文件同名。
- vault 路径由应用在 `--user-data-dir/vault-path.json` 里记录；外部工具通常由用户直接指定 vault 目录。

---

## 3. 连接与读取规范

SQLite 并发读（WAL 下）是安全的，应用开着也能读。**默认用只读打开**：

```ts
// better-sqlite3 只读
import Database from "better-sqlite3";
const db = new Database(path.join(vault, ".siltflow", "data.db"), {
  readonly: true,
  fileMustExist: true,
});
db.pragma("query_only = ON"); // 双保险：绝不让外部工具写
```

- 不要用独占锁 / `immutable`（WAL 需要 shm）。
- 应用可能在写（保存卡片、FSRS 评分），读侧无需任何处理。
- 若确实需要**写**，见 [§10 写入规范](#10-写入规范)。
- 每次读取后 `db.close()`，不要长持连接（尤其 importer 在进程内反复跑）。

---

## 4. 表结构（SCHEMA_VERSION = 6）

通用约定：

- 所有 `*_id` 是 UUID 文本。
- 时间戳一律 **ISO 8601 字符串**（`new Date().toISOString()`，如 `2026-08-13T06:20:39.000Z`），不是 unix 时间戳；按字符串字典序可直接排序。
- 所有 JSON blob 存 **TEXT 列**，读取后自行 `JSON.parse`，解析失败要跳过（容忍脏数据）。

### 4.1 documents — 文档（每行一个 PDF）

| 列                          | 类型          | 说明                                    |
| --------------------------- | ------------- | --------------------------------------- |
| `id`                        | TEXT PK       | UUID，等于 `<vault>/documents/<id>.pdf` |
| `title`                     | TEXT NOT NULL | 显示标题                                |
| `original_name`             | TEXT          | 导入时的原始文件名                      |
| `total_pages`               | INTEGER       | PDF 页数（打开时写入）                  |
| `metadata`                  | TEXT          | PDF 元数据 JSON（内部用，无对外契约）   |
| `folder_id`                 | TEXT          | 所属文件夹（→ folders.id），根级为 NULL |
| `sort_order`                | INTEGER       | 排序                                    |
| `created_at` / `updated_at` | TEXT          | ISO                                     |

### 4.2 folders — 文件夹树

`id PK`、`name NOT NULL`、`parent_id`（→ folders.id，NULL=根）、`sort_order`、时间戳。

### 4.3 summaries — 每文档一条 AI/手动摘要

`document_id` PK → `documents(id) ON DELETE CASCADE`、`text NOT NULL`、`is_ai_generated` INTEGER 0/1、`source_lang`、时间戳。

### 4.4 annotations — 卡片本体

| 列                          | 类型                                 | 说明                                            |
| --------------------------- | ------------------------------------ | ----------------------------------------------- |
| `id`                        | TEXT，PK 一部分                      | 卡片 ID                                         |
| `document_id`               | TEXT，PK 一部分，→ documents CASCADE | 卡片所属文档                                    |
| `type`                      | TEXT NOT NULL                        | 文本标注为 `"text"`；**不是**判别字段           |
| `text`                      | TEXT                                 | 源文本（高亮选中的原文 / 手动输入）             |
| `page_number`               | INTEGER                              | **1 起始**页码                                  |
| `embed_data`                | TEXT NOT NULL                        | JSON blob：高亮位置 + 内容（见 §6）             |
| `kind`                      | TEXT NOT NULL                        | `annotation` \| `highlight` \| `manual`（见下） |
| `context`                   | TEXT                                 | 用户自写的上下文笔记（可空）                    |
| `created_at` / `updated_at` | TEXT                                 | ISO；`created_at` 兼作 z-order 平局裁决         |

**复合主键 `(id, document_id)`** —— `id` 本身**不保证全局唯一**，所有关联都必须带上 `document_id`。

`kind` 语义：

| kind         | 含义                   | 渲染                                                                               |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| `annotation` | 高亮转成的卡片         | 正常卡片                                                                           |
| `highlight`  | 纯视觉高亮，无卡片     | **Annotations 列表不显示**（按 `kind !== 'highlight'` 过滤），外部读取通常也应过滤 |
| `manual`     | 用户手动添加（无位置） | 卡片，`embed_data.position` 全零                                                   |

### 4.5 ai_results — AI 翻译结果（每卡片 0..1 行）

| 列              | 类型                                 | 说明                                           |
| --------------- | ------------------------------------ | ---------------------------------------------- |
| `annotation_id` | TEXT，PK 一部分                      | → annotations.id（**无 FK 约束**，应用层维护） |
| `document_id`   | TEXT，PK 一部分，→ documents CASCADE |                                                |
| `data`          | TEXT NOT NULL                        | AI 结果 JSON blob（见 §7，**核心契约**）       |
| `version`       | INTEGER NOT NULL                     | **AI 数据版本**，当前 2（见 §9）               |
| 时间戳          | TEXT                                 |                                                |

### 4.6 fsrs_cards — FSRS 间隔重复状态（每卡片 0..1 行）

`annotation_id` + `document_id` 复合 PK、`data` TEXT（ts-fsrs `Card` 的 JSON 序列化，见 §8）、时间戳。

### 4.7 review_logs — FSRS 复习日志（每评分一条）

`id` + `annotation_id` + `document_id` 复合 PK、`data` TEXT（ts-fsrs `ReviewLog` JSON）、`created_at`。只增不删。

---

## 5. 重建一张卡片

应用内部就是下面这条 LEFT JOIN（`electron/ipc/annotations.ipc.ts` 的 `LIST_ALL_SQL`），**外部消费者照抄即可得到与渲染器一致的数据**：

```sql
SELECT
  a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
  a.kind, a.context, a.created_at, a.updated_at,
  ar.data AS ai_data, ar.version AS ai_version,
  fc.data AS fsrs_data
FROM annotations a
LEFT JOIN ai_results ar
  ON ar.annotation_id = a.id AND ar.document_id = a.document_id
LEFT JOIN fsrs_cards fc
  ON fc.annotation_id = a.id AND fc.document_id = a.document_id
WHERE a.document_id = ?
ORDER BY a.created_at ASC
```

渲染器侧映射（`CenterPanel.tsx`）——外部工具照此拼出「卡片对象」：

```
pageNumber   = row.page_number ?? 1
embedData    = JSON.parse(row.embed_data)         // ScaledPosition + content
kind         = row.kind ?? "annotation"
aiResult     = row.ai_data ? JSON.parse(row.ai_data) : undefined
aiVersion    = row.ai_version ?? undefined
fsrsCard     = row.fsrs_data ? JSON.parse(row.fsrs_data) : undefined
context      = row.context ?? undefined
createdAt    = row.created_at ?? undefined
```

**`ai_version` 三态决定卡片怎么渲染**：

| ai_version                 | 卡片状态                       |
| -------------------------- | ------------------------------ |
| `NULL`（无 ai_results 行） | **UNTRANSLATED**，空白卡片     |
| `1`                        | 旧版 V1 数据（只读，提示重翻） |
| `2`                        | V2 卡片（当前 schema）         |

**卡片状态判定靠 `ai_version`（渲染器 switch），不是靠 `ai_data` 是否非空**——外部工具同样应按 `ai_version` 分支。

---

## 6. `embed_data` blob

`react-pdf-highlighter-plus` 的 `ScaledPosition` 序列化：

```jsonc
{
  "position": {
    "boundingRect": {
      "x1": 50,
      "y1": 100,
      "x2": 300,
      "y2": 120,
      "width": 612,
      "height": 792,
      "pageNumber": 3,
    },
    "rects": [/* 每段文字的独立矩形，结构同 boundingRect */],
    "usePdfCoordinates": false,
  },
  "content": { "text": "高亮选中的原文" },
}
```

- 坐标为 **PDF 用户空间**（fixture 是 US Letter 612×792）；`pageNumber` 1 起始。
- `content` 通常只有 `text`；库也支持 `image` / `strokes` / `shape`，当前 Siltflow 主要写 `text`。
- `manual` 卡片：`position.boundingRect` 全零、`rects: []`（`annotations-tab.tsx` 的 `handleCreateManual`），外部读取时按空位置处理。

---

## 7. `ai_results.data` —— V2 AI 结果（核心契约）

这是 importer 渲染卡片内容的字段，**改动任何键名都要同步 importer 并考虑迁移**（见 §9）。

```jsonc
{
  "input": {
    "text": "ran", // 用户原文
    "normalized": "ran", // 归一化（unicode NFC）
    "source_lang": "en-US", // BCP 47
    "type": "word", // "word" | "phrase" | "sentence"
    "lemma": "run", // 词元；短语/句子为 null
  },
  "documentContext": "自动抽取的文档上下文（≤5000 字符），可 null",
  "output": {/* 按 input.type 取三种之一，见下 */},
}
```

> ⚠️ 顶层键是 **`documentContext`**，**不是 `context`**。v6 之前的老库 blob 里是 `context`——外部读取必须做 `legacy alias`（见 §9.3）。`annotations.context`（用户笔记）与此无关。

**output 三态**（按 `input.type` 判别）：

```jsonc
// word —— 完整词条
{
  "meanings":      [{ "pos": "VERB", "translation": "忍受" }],   // 按频率排序 1-5 条
  "definitions":   [{ "pos": "VERB",
                      "definition": { "source": "to suffer", "target": "忍受" } }],
  "examples":      [{ "sentence": "She endured.", "translation": "她忍受了。" }],
  "collocations":  [{ "phrase": "endure pain", "translation": "忍受痛苦" }],
  "synonyms":      ["withstand", "bear", "tolerate"],
  "cefr":          "B2"          // A1-A2 / B1-B2 / C1-C2
}

// phrase —— 短语
{ "translation": "…", "examples": [{ "sentence": "…", "translation": "…" }] }

// sentence —— 整句（只有 translation，没有 examples）
{ "translation": "…" }
```

判别逻辑（渲染器 `v2.tsx` 的辅助函数，外部照抄）：

- 有 `meanings` → word
- 有 `translation` **且** 有 `examples` → phrase
- 只有 `translation` → sentence

类型定义源：`src/types/annotation.ts`（`AIAnnotationDataV2` 及其子类型）。

---

## 8. `fsrs_cards.data` / `review_logs.data`

两个都是 **ts-fsrs** 库的直接 `JSON.stringify`，外部工具按 ts-fsrs 类型解析即可（包 `ts-fsrs`）：

```jsonc
// fsrs_cards.data —— Card
{
  "due": "2026-08-15T06:20:39.000Z",
  "stability": 2.4,
  "difficulty": 5.1,
  "elapsed_days": 1,
  "scheduled_days": 3,
  "reps": 2,
  "lapses": 0,
  "state": 2,
  "last_review": "2026-08-12T...",
}
```

- `state`：`0=New`、`1=Learning`、`2=Review`、`3=Relearning`。
- `review_logs.data` 是 `ReviewLog`（含 rating、scheduled_days、elapsed_days 等），只读场景一般用不到。
- 注意：**有 `fsrs_cards` 行 ≠ 已翻译**；FSRS 状态和翻译状态是两个正交维度。

---

## 9. 版本与迁移

### 9.1 两个版本号，别搞混

| 版本                | 存哪                         | 含义                        | 当前值 |
| ------------------- | ---------------------------- | --------------------------- | ------ |
| **SCHEMA_VERSION**  | `PRAGMA user_version`        | 库结构版本，破坏性迁移时 +1 | **6**  |
| **AI_DATA_VERSION** | `ai_results.version`（每行） | AI 数据 blob 的 schema 版本 | **2**  |

- 库结构变了 → `SCHEMA_VERSION` +1，加一个 `migrateVxToVy`。
- **blob 字段改名不一定需要动 `AI_DATA_VERSION`**：若 V2 渲染器不读被改的字段，bump 反而会让存量卡落入渲染器的 default 空白分支（渲染器靠 `ai_version` 的 `switch` 选组件）。`context → documentContext` 这次改名就没 bump AI_DATA_VERSION。
- 只有「AI 数据结构变化、渲染逻辑要区分新旧」时才 bump `AI_DATA_VERSION`。

### 9.2 迁移史（v1→v6）

| 步骤      | 内容                                                                |
| --------- | ------------------------------------------------------------------- |
| v1→v2     | `ai_results` 加 `version` 列                                        |
| v2→v3     | `annotations` 加 `kind` 列                                          |
| v3→v4     | 无 DDL（保险检查 kind）                                             |
| v4→v5     | `annotations` 加 `context` 列                                       |
| **v5→v6** | **改写 `ai_results.data` blob：顶层 `context` → `documentContext`** |

外部消费者读库时：

```sql
PRAGMA user_version;  -- 期望 6；<6 表示迁移未跑或库较老
```

### 9.3 外部消费者必须做的防御

1. **`documentContext` / `context` 双键兼容**：解析 `ai_results.data` 时，`parsed.documentContext ?? parsed.context`。老库未跑 v6 迁移时仍只有 `context`。
2. **`ai_version` 分支**：`1` 的 blob 是已移除的 V1 schema，别按 V2 解析（当作 legacy，按只读卡片处理）。
3. **JSON.parse 全 try/catch**：数据可能损坏（应用写入中途崩溃等），坏行跳过而不是让整个读取挂掉。
4. **新版本出现时不要静默假设**：`PRAGMA user_version > 6` 或 `ai_version > 2` 时，日志告警并按"尽量降级渲染"处理。

---

## 10. 写入规范（仅当外部工具需要写库）

> Siltflow 本体通过 IPC 写库；外部工具**默认只读**。确需写时遵守以下契约，否则可能破坏应用。

- **打开方式**：`new Database(path, { fileMustExist: true })` + `PRAGMA foreign_keys = ON`。应用可能在跑，靠 SQLite 锁即可，但事务要短。
- **INSERT OR REPLACE 语义**：应用用 `INSERT OR REPLACE`（靠复合主键覆盖），外部写同键行 = 覆盖。
- **`created_at` 保留**：编辑时应用保留原 `created_at`（`COALESCE((SELECT created_at …), ?)`），不要把它当更新时间覆盖。
- **`annotations` 与 `ai_results` 分两行写**：应用先存 annotation，再 `aiResults.save`。外部写卡片时两步都要做，保证 JOIN 后一致。
- **不要写 `aiResult: null`**：渲染器用 `null` 表示"翻译中"，且**明确跳过持久化**（`annotation.store.ts` 的 `skipPersist`）。未翻译 = **没有 `ai_results` 行**，而不是 `data = NULL`。
- **删除 annotation 必须连带删关联行**：`ai_results` / `fsrs_cards` / `review_logs` 对 `annotations` **没有 FK**（FK 都在 `document_id` 上），应用在 `annotations:delete` 里显式 `DELETE` 三张关联表。外部删卡片照做，否则留孤儿行。
- **FSRS 评分是事务**：应用用 `BEGIN IMMEDIATE … COMMIT` 同时写 `fsrs_cards` + `review_logs`（`review.ipc.ts`），外部保持同样原子性。
- 时间戳一律 `new Date().toISOString()`。

---

## 11. 常见坑速查

| 坑                             | 说明                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `id` 不全局唯一                | 复合主键 `(id, document_id)`；**所有 JOIN 都带 document_id**                           |
| 删 annotation 不级联           | FK 级联在 `document_id → documents`，删文档才级联；删卡片要手动删 ai_results/fsrs/logs |
| `kind='highlight'` 不是卡片    | Annotations 列表过滤掉它，外部读取同样过滤                                             |
| `page_number` 从 1 起          | 别当 0 起始                                                                            |
| 时间是 ISO 字符串              | 不是 unix；字典序即可比较                                                              |
| `documentContext` vs `context` | blob 顶层是 documentContext（老库是 context）；`annotations.context` 是另一回事        |
| 有 fsrs_cards ≠ 已翻译         | 两个维度独立                                                                           |
| JSON 可能坏                    | 全部 try/catch 解析，坏行跳过                                                          |
| WAL 文件                       | app 开着时 `-wal`/`-shm` 正常存在；只读打开读到已提交数据                              |
| `config.json` 不在 DB          | AI profile / 设置走 `.siltflow/config.json`                                            |

---

## 12. 常用查询示例

```sql
-- 版本检查
PRAGMA user_version;

-- 所有文档
SELECT id, title, total_pages, folder_id FROM documents ORDER BY title;

-- 某文档全部卡片（含 AI 与 FSRS，按时间序）
-- 见 §5 的 LIST_ALL_SQL

-- 某文档未翻译卡片（无 ai_results 行）
SELECT a.id, a.text, a.page_number
FROM annotations a
LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
WHERE a.document_id = ? AND a.kind != 'highlight' AND ar.annotation_id IS NULL;

-- 某文档到期待复习卡片（FSRS due <= now；state 0=新卡也到期）
SELECT a.id, a.text, fc.data
FROM fsrs_cards fc
JOIN annotations a ON a.id = fc.annotation_id AND a.document_id = fc.document_id
WHERE fc.document_id = ?
  AND (json_extract(fc.data, '$.due') <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       OR json_extract(fc.data, '$.state') = 0);

-- 每文档卡片数（供 importer 目录）
SELECT document_id, COUNT(*) FROM annotations
WHERE kind != 'highlight' GROUP BY document_id;
```

---

## 13. 变更时同步清单

改 DB 时（给开发者的核对表）：

- [ ] `SCHEMA_VERSION` 是否要 +1？（破坏性表变更 → 加迁移）
- [ ] 同步 importer 的 `src/types.ts` `ParsedAIResult`（保留旧键作为 legacy alias）
- [ ] blob 字段改名：决定是否加 `migrateVxToVy` 改写存量数据（如 v5→v6）
- [ ] `AI_DATA_VERSION` 是否要 bump？（仅当渲染逻辑需区分新旧）
- [ ] 更新本文档的对应章节
