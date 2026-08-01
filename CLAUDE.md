# CLAUDE.md — Siltflow

Electron 43 + React 19 + TypeScript 6 桌面应用（语言学习工具），pnpm 包管理器。

## 审计工具链

所有工具均已配置，本地均可运行（部分已接入 CI）。写代码后跑 `pnpm check:quick` 获得快速反馈。

| 工具                   | 命令                                | 用途                                 | 速度 | CI 阻塞        |
| ---------------------- | ----------------------------------- | ------------------------------------ | ---- | -------------- |
| **Oxlint**             | `pnpm check:oxlint`                 | 类型感知 lint（120+ 规则）           | <2s  | ✅             |
| **Knip**               | `pnpm check:knip`                   | 死代码检测（未使用导出/文件/依赖）   | ~2s  | ✅             |
| **dependency-cruiser** | `pnpm check:deps`                   | 架构规则（循环依赖、跨层引用）       | ~5s  | ✅             |
| **pnpm audit**         | `pnpm audit:deps`                   | CVE 扫描（high/critical）            | ~10s | ✅             |
| **Gitleaks**           | `pnpm audit:secrets`                | Secrets 扫描（git 历史）             | <2s  | ✅             |
| **ESLint**             | `pnpm lint`                         | 传统 lint（React hooks 规则等）      | ~5s  | ✅             |
| **Prettier**           | `pnpm format` / `pnpm format:check` | 代码格式化                           | <2s  | ✅             |
| **Playwright E2E**     | `pnpm test:e2e`                     | Electron 端到端（18 测试，2 worker） | ~24s | ✅（CI 用 xvfb-run） |

> E2E AI 测试（`e2e/ai.spec.ts`）通过本地 mock OpenAI-compatible server（`e2e/mock-ai-server.ts`）运行：测试把 vault 里 AI profile 的 `baseUrl` 指向 mock（`seedAIConfig`，走 CSP 允许的 `http://localhost:*`），完整走通「点按钮 → fetch → 解析 → 渲染 → 持久化」链路，无需真实 API 密钥。mock 绑定双栈 `::`（`localhost` 可能解析为 IPv6 `::1`，单绑 IPv4 会导致请求落空）。

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

# Electron E2E（Playwright）
# 先构建再跑：E2E 测的是 dist/ + dist-electron/ 产物，不是 dev server
pnpm exec vite build && pnpm test:e2e

# E2E 前提：需要显示环境（X11/Wayland），无 headless。headless 机器（含 CI）用
# xvfb-run pnpm test:e2e。默认 2 worker（e2e/playwright.config.ts）——4 worker
# 会争抢 CPU 导致远页平滑滚动测试偶发超时。测试每次启动独立 Electron 实例
# （隔离 vault + profile），结束后自动清理临时目录。

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

## 发布流程（commit/tag 策略）

发版遵循固定流程，统一用 **小版本 bump**（除非有破坏性变更才升大版本）。

### 版本号选择

- 功能/修复 → 小版本递增（`3.0.1` → `3.1.0`）
- 破坏性变更（如 schema 不兼容、数据迁移）→ 大版本递增（`3.x` → `4.0.0`）
- 参考 CI：`release` job 会用 **tag 名**（去掉 `v` 前缀）改写 `package.json` 再构建三平台产物，所以 **tag 才是版本真相**，本地 bump commit 只是 git 历史惯例。

### 操作步骤

```bash
# 1. 改版本号（只需改 package.json，"version" 字段；pnpm-lock.yaml 不记录项目自身版本，无需动）
#    用 sed 或编辑器把 "version": "X.Y.Z" 改成新版本号

# 2. bump 提交 + 轻量 tag（先提交、后打 tag，tag 指向 bump 提交）
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z

# 3. 先推 master、再推 tag（tag 触发 release，release 依赖 check，先推 master 让 check 先跑）
git push origin master
git push origin vX.Y.Z

# 4. 验证（可选）：确认 tag 触发的 CI 正常启动
gh run list --repo TYBLHQY/siltflow --limit 3
```

> 注意：CI 工作流（`.github/workflows/ci.yml`）只监听 `tags: ["v*"]` 和 PR 到 master 的事件。check/lint/unit 三个 job 并行（快检查与慢检查互不阻塞），e2e 依赖它们先绿，release 依赖 e2e。对 tag push 全部通过后 Linux/macOS/Windows 三平台并行构建并创建 GitHub Release（Linux job 负责建 release，其余平台等待其就绪后上传产物）。依赖安装通过 `.github/actions/install-deps` 复合 action 共享，`setup-node` 的 pnpm cache 让各 job 秒装。

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

### 两个非显而易见的坑

- **E2E 的 `executablePath` 必须是真实二进制** `node_modules/electron/dist/electron`；`.bin/electron` 是 shell 包装，会挂起 "Waiting for debugger"。
- **`viewport.rawDims` 字段名陷阱**（PdfViewer.tsx fit-width）：字段是 `pageWidth`/`pageHeight`（PDF 单位），不是 `width`/`height`。用错 → scale 变 NaN，页面撑不满。

## 配置文件位置

| 文件                       | 用途                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `.oxlintrc.json`           | Oxlint 规则配置                                            |
| `knip.config.ts`           | Knip 死代码检测配置                                        |
| `.dependency-cruiser.cjs`  | 架构规则（`.cjs` 因为 package.json 有 `"type": "module"`） |
| `eslint.config.mjs`        | ESLint 扁平配置                                            |
| `tsconfig.json`            | TypeScript 配置（strict 模式）                             |
| `e2e/playwright.config.ts` | Playwright Electron 配置（workers: 2，无 headless）        |
| `.github/workflows/ci.yml` | CI 工作流                                                  |
| `package.json`             | scripts 定义                                               |

## 架构约束

dependency-cruiser 强制以下规则：

1. **`electron/` 不能依赖 `src/`**：主进程不能引用渲染器代码（preload.ts 通过 `pathNot` 豁免）
2. **`src/` 不能 `import 'electron'`**：渲染器只能通过 preload bridge（`window.siltflow`）访问系统能力
3. **`src/` 不能引用 Node.js built-ins**：fs、path、child_process 等必须通过 IPC
4. **禁止循环依赖**：项目范围内禁止
5. **IPC 文件只能被 main.ts 导入**：`electron/ipc/*.ts` 不应被其他主进程模块引用
