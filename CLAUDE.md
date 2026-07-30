# CLAUDE.md — Siltflow

Electron 43 + React 19 + TypeScript 6 桌面应用（语言学习工具），pnpm 包管理器。

## 审计工具链

所有工具均已配置，本地和 CI 均可运行。写代码后跑 `pnpm check:quick` 获得快速反馈。

| 工具                   | 命令                                | 用途                               | 速度 | CI 阻塞 |
| ---------------------- | ----------------------------------- | ---------------------------------- | ---- | ------- |
| **Oxlint**             | `pnpm check:oxlint`                 | 类型感知 lint（120+ 规则）         | <2s  | ✅      |
| **Knip**               | `pnpm check:knip`                   | 死代码检测（未使用导出/文件/依赖） | ~2s  | ✅      |
| **dependency-cruiser** | `pnpm check:deps`                   | 架构规则（循环依赖、跨层引用）     | ~5s  | ✅      |
| **pnpm audit**         | `pnpm audit:deps`                   | CVE 扫描（high/critical）          | ~10s | ✅      |
| **Gitleaks**           | `pnpm audit:secrets`                | Secrets 扫描（git 历史）           | <2s  | ✅      |
| **ESLint**             | `pnpm lint`                         | 传统 lint（React hooks 规则等）    | ~5s  | ✅      |
| **Prettier**           | `pnpm format` / `pnpm format:check` | 代码格式化                         | <2s  | ✅      |

## 常用命令

```bash
# 快速检查（写代码后跑这个，<5s）
pnpm check:quick          # oxlint + knip

# 代码质量
pnpm lint                 # ESLint（--report-unused-disable-directives --max-warnings 0）
pnpm format               # Prettier 格式化全部文件
pnpm format:check         # Prettier 检查（CI 用）
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest run

# 架构检查
pnpm check:deps           # dependency-cruiser

# CI 检查（lint + typecheck + test）
pnpm ci:check

# 安全审计
pnpm audit:deps           # CVE 扫描
pnpm audit:secrets        # secrets 扫描

# 全量审计（发版前跑）
pnpm audit:all            # oxlint + depcruiser + gitleaks + knip + CVE
```

## 发现问题后的处理原则

### Oxlint 报错 → 需要修复

Oxlint 启用了类型感知规则（`--type-aware`），当前项目存在一些已有问题如 `no-floating-promises`（electron/main.ts、DocsTree.tsx 等）。这些是**真正的代码质量问题**，新代码不应引入新的 Oxlint 错误。

### Knip 报未使用 → 需要区分

- **Unused files**（如 `popover.tsx`、`separator.tsx`）：shadcn/ui 通过 `npx shadcn` 动态注册组件，Knip 无法追踪。可能是真正未使用，确认后删除。
- **Unused exports**（如 `buttonVariants`、`DialogPortal`）：通常是 re-export 给外部用的，或 shadcn 模式要求的。不要随意删除。
- **Unused dependencies**：检查是否真的不使用，确认后从 package.json 移除。

### dependency-cruiser 报循环依赖 → 检查是否 type-only

- `PdfViewer.tsx ↔ SiltflowHighlightContainer.tsx`：反向边是 `import type`，运行时安全。当前 `no-circular` 规则报了 error，需要在 `no-circular` 规则中通过 `allowed` 豁免，或重构类型到单独文件。
- `no-inter-folder-circular` 是 warn 级别，仅关注即可。

## 配置文件位置

| 文件                       | 用途                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `.oxlintrc.json`           | Oxlint 规则配置                                            |
| `knip.config.ts`           | Knip 死代码检测配置                                        |
| `.dependency-cruiser.cjs`  | 架构规则（`.cjs` 因为 package.json 有 `"type": "module"`） |
| `eslint.config.mjs`        | ESLint 扁平配置                                            |
| `tsconfig.json`            | TypeScript 配置（strict 模式）                             |
| `.github/workflows/ci.yml` | CI 工作流                                                  |
| `package.json`             | scripts 定义                                               |

## 架构约束

dependency-cruiser 强制以下规则：

1. **`electron/` 不能依赖 `src/`**：主进程不能引用渲染器代码（preload.ts 通过 `pathNot` 豁免）
2. **`src/` 不能 `import 'electron'`**：渲染器只能通过 preload bridge（`window.siltflow`）访问系统能力
3. **`src/` 不能引用 Node.js built-ins**：fs、path、child_process 等必须通过 IPC
4. **禁止循环依赖**：项目范围内禁止
5. **IPC 文件只能被 main.ts 导入**：`electron/ipc/*.ts` 不应被其他主进程模块引用
