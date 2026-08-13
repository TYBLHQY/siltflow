---
name: siltflow-db
description: 读取 Siltflow 的 SQLite vault 数据库（data.db）时使用。触发场景：写/改 Obsidian siltflow-importer 或其他读取 data.db 的脚本/工具；处理 annotations / ai_results / fsrs_cards / summaries 表；排查"读到的数据和 App 不一致"；用户提到 data.db、卡片 JOIN、AI 结果 blob、SCHEMA_VERSION / AI_DATA_VERSION、documentContext 迁移时——即使没明说是 skill 也触发。
version: 1.0.0
---

# Siltflow data.db — 外部读取契约

Siltflow（Electron 语言学习 App）每个 vault 目录下有一个 SQLite 库
`<vault>/.siltflow/data.db`（WAL 模式，`foreign_keys = ON`）。外部消费者——Obsidian
importer、脚本、其他工具——直接读它。本 skill 给出读取契约，保证外部读到的和 App
渲染的一致。

完整 schema / blob / 迁移 / 写入规范见 `references/database-external.md`，需要表级
细节时读它。本文件只保留必须牢记的关键事实与工作流。

## 心智模型：一张"卡片"是三行

卡片 ≠ 一行。它由三张表经 `(annotation_id, document_id)` 关联：

- `annotations` 必有：卡片本体（text / page_number / kind / embed_data / context）
- `ai_results` 可选（0..1 行）：翻译结果；**没有行 = 未翻译**
- `fsrs_cards` 可选（0..1 行）：复习状态；与翻译状态**正交**（有 fsrs 卡 ≠ 已翻译）

**`id` 不全局唯一**——主键是复合 `(id, document_id)`，所有 JOIN 都必须带
`document_id`，漏了会串行。

## 读取协议

1. **只读打开，绝不写**：
   ```ts
   const db = new Database(`${vault}/.siltflow/data.db`, {
     readonly: true,
     fileMustExist: true,
   });
   db.pragma("query_only = ON");
   ```
2. App 开着也能读（WAL 并发读安全），不必等 App 关闭；读后 `close()`，别长持连接。
3. **JSON blob 一律 try/catch 解析**，坏行跳过而不是让整个读取失败。
4. 时间戳是 ISO 字符串（字典序可比）；`page_number` 从 1 起。
5. 卡片状态由 `ai_version` 决定（**不是**靠 `ai_data` 是否非空）：
   - `NULL`（无 ai_results 行）→ UNTRANSLATED 空白卡
   - `1` → 旧版 V1（只读 legacy，别按 V2 解析）
   - `2` → V2 卡（当前 schema）

## 标准查询（照抄即与 App 一致）

App 内部就是这条 LEFT JOIN（`electron/ipc/annotations.ipc.ts` 的 `LIST_ALL_SQL`），
外部直接复用：

```sql
SELECT
  a.id, a.document_id, a.type, a.text, a.page_number, a.embed_data,
  a.kind, a.context, a.created_at, a.updated_at,
  ar.data AS ai_data, ar.version AS ai_version,
  fc.data AS fsrs_data
FROM annotations a
LEFT JOIN ai_results ar ON ar.annotation_id = a.id AND ar.document_id = a.document_id
LEFT JOIN fsrs_cards fc ON fc.annotation_id = a.id AND fc.document_id = a.document_id
WHERE a.document_id = ? AND a.kind != 'highlight'
ORDER BY a.created_at ASC
```

- `kind='highlight'` 是纯视觉高亮，**不是卡片**，读取时过滤（App 的 Annotations 列表
  就是这么做的）。
- 渲染器映射（`src/components/layout/CenterPanel.tsx`）：
  `aiResult = ai_data ? JSON.parse(ai_data) : undefined`，`fsrsCard` / `embedData`
  同理，`pageNumber = page_number ?? 1`。

## 最大的坑：`documentContext` vs `context`

`ai_results.data` blob 顶层字段是 **`documentContext`**（自动抽取的文档上下文），
**不是** `context`。v6 之前的老库 blob 里是 `context`。外部读取必须做 legacy alias：

```ts
const docContext = parsed.documentContext ?? parsed.context;
```

- `annotations.context`（用户手写的上下文笔记）与它无关。
- 改名时 App **没有** bump `ai_results.version`（`AI_DATA_VERSION` 仍是 2），所以
  **不能靠 version 判断用哪个键名**——必须双键兼容。
- `SCHEMA_VERSION`（`PRAGMA user_version`，当前 6）与 `AI_DATA_VERSION`（=2）是两回事。

## 版本检查与防御

- 读库前可 `PRAGMA user_version;` 确认新旧。
- `user_version > 6` 或 `ai_version > 2`：告警并按"降级渲染"处理，别静默假设。
- 数据可能损坏（写入中途崩溃）：全部 `JSON.parse` 用 try/catch，坏行跳过。

## 排查"读到的和 App 不一致"

按顺序核对：

1. JOIN 是否带了 `document_id`（复合主键，漏了会串行）
2. 是否过滤了 `kind='highlight'`
3. `ai_version` 分支是否正确（null/1/2）
4. blob 键名是否用了 `documentContext`（不是 `context`）
5. JSON 解析失败是否被静默吞掉（坏行跳过，但别中断整体）

## 参考文档

需要表级细节时读 `references/database-external.md`：

- 全部 7 张表列级 schema（PK/FK/类型）
- `embed_data`（react-pdf-highlighter-plus `ScaledPosition`）结构
- `ai_results.data` V2 完整 blob schema（word / phrase / sentence 三态 + 判别逻辑）
- `fsrs_cards` / `review_logs`（ts-fsrs `Card` / `ReviewLog` 序列化，state 枚举）
- v1→v6 迁移史与外部防御
- 写入规范（外部确需写库时：INSERT OR REPLACE 语义、created_at 保留、不要写
  `aiResult: null`、删卡需连带删三张关联表、FSRS 事务）
- 常用 SQL 示例

本 skill 是唯一规范源：`references/database-external.md` 为权威副本（随包分发，供异地
使用）。改 schema / blob 结构时同步更新该文件。
