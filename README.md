# next-start

一个全栈 Next.js 项目模板：App Router + HeroUI + Drizzle/SQLite + Auth.js + next-intl，包管理和运行时用 Bun。

开箱即用的部分：中英双语路由、明暗主题、手机号+验证码登录（带路由守卫）、一条完整的
「建表 → service → Server Action → 界面」示例（`/notes`，含分页、事务和 LIKE 转义），一套 Server Action 和 Route Handler
共用的错误契约（含错误边界），请求 id 贯穿的结构化日志（带脱敏）+ `/api/health`，
一套实测过不误伤应用的安全响应头（nonce CSP / HSTS / …）和登录限流，
canonical / hreflang / robots / sitemap，一个单实例的生产 `Dockerfile`，
以及 lint / typecheck / 单测（带覆盖率阈值）/ 组件测试 / E2E（含 axe 无障碍扫描）五条流水线
＋ Git 钩子和 Renovate 分组策略。

> **动手前先读 [DEVELOPMENT.md](DEVELOPMENT.md)** —— 分层规则、命名约定和一堆踩过的坑都在那里。
> 另外看一眼 [AGENTS.md](AGENTS.md)：这个仓库用的 Next.js 版本有 breaking changes。

## 快速开始

```bash
bun install
cp .env.example .env.local        # 然后填上 AUTH_SECRET
openssl rand -base64 32           # 生成一个 AUTH_SECRET
bun run db:migrate && bun run db:seed
bun run dev
```

打开 http://localhost:3000，用 seed 出来的手机号登录（验证码是固定的演示码，不会真的发短信——
见 [DEVELOPMENT.md 的认证一节](DEVELOPMENT.md#认证)）：

```
手机号 13800000000，验证码 123456
```

**开发不需要 Docker，也不需要数据库服务。** SQLite 就是 `./data/dev.db` 这一个文件，第一次运行时
自己建。上生产有一个单实例的 `Dockerfile`（standalone 产物 + 挂载卷上的 SQLite），
见 [DEVELOPMENT.md 的部署一节](DEVELOPMENT.md#部署)——那里也写明了哪些环节验证过、哪些没有。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 / 包管理 | Bun 1.3 |
| 框架 | Next.js 16（App Router，Server Components 默认） |
| UI | HeroUI 3 + Tailwind CSS 4（底层是 react-aria-components） |
| 图标 | lucide-react |
| 数据库 / ORM | SQLite（`@libsql/client`）+ Drizzle 0.45 |
| 认证 | Auth.js（next-auth 5 beta）+ `@auth/drizzle-adapter`；cookie 与 Bearer 两种传输共用一个验证核心 |
| 国际化 | next-intl 4（中英双语） |
| 表单 / 校验 | react-hook-form + Zod 4 |
| 客户端数据 | SWR 2 |
| 代码质量 | Biome 2 |
| 测试 | `bun test` + happy-dom；Playwright |

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` / `build` / `start` | 开发 / 构建 / 生产启动 |
| `bun run lint:fix` | 修 lint + 格式化 + 排 import |
| `bun run typecheck` | `next typegen && tsc --noEmit` |
| `bun run test` | 单测 + 组件测试 |
| `bun run test:coverage` | 单测 + 覆盖率（阈值只在这里强制） |
| `bun run test:e2e` | Playwright（用 `./data/e2e.db`，不碰开发库） |
| `bun run db:generate` | 改完 `src/core/db/schema.ts` 后生成迁移 SQL |
| `bun run db:migrate` | 应用迁移 |
| `bun run db:seed` / `db:studio` | 插入 demo 数据 / 打开可视化库浏览器 |
| `bun run db:reset` | ⚠️ 删库文件 + 重放迁移 + seed |

完整列表和每条命令的坑见 [DEVELOPMENT.md](DEVELOPMENT.md#常用命令)。

## 拿它开新项目

1. 改 `package.json` 的 `name`、`src/i18n/messages/*.json` 里的 `Meta`。
2. 不需要示例业务就删掉 `src/features/notes/`、`src/core/services/notes-service*.ts`、
   `src/app/api/notes/`、`src/app/api/v1/notes/`、`src/app/[locale]/(app)/notes/`，以及
   `NavLinks.ts` 里那一条、`e2e/notes.e2e.ts` 和 `e2e/api-errors.e2e.ts`。
   不做微信小程序的话再删 `src/core/auth/wechat.ts`（含测试）、`src/app/api/v1/`、
   `src/features/auth/schema.ts` 和 `e2e/api-v1.e2e.ts`；`core/auth/verify.ts` 留着，
   cookie 那条传输在用。
   > `src/core/` 下的 `errors.ts` / `action.ts` / `http.ts` / `validation.ts` /
   > `request-id.ts` / `security-headers.ts` / `rate-limit.ts` / `zod-config.ts`、
   > `src/instrumentation.ts`、`src/app/api/health/`，以及它们的 `*.test.ts` 和
   > `e2e/observability.e2e.ts` / `e2e/security.e2e.ts` **都不要删**——那是错误契约、
   > 可观测性和安全的地基，不属于示例业务。
3. `src/app/[locale]/(app)/dashboard/page.tsx` 是主题展示页，真业务落地后整页删掉。
4. 加自己的业务：照 [DEVELOPMENT.md 的标准流程](DEVELOPMENT.md#新增业务的标准流程)走。
