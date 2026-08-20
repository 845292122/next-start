# next-start

一个全栈 Next.js 项目模板：App Router + HeroUI + Drizzle/SQLite + Auth.js + next-intl，包管理和运行时用 Bun。

开箱即用的部分：中英双语路由、明暗主题、邮箱密码登录（带路由守卫）、一条完整的
「建表 → service → 接口 → 界面」示例（`/notes`），以及 lint / typecheck / 单测 / 组件测试 / E2E 五条流水线。

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

打开 http://localhost:3000，用 seed 出来的账号登录：

```
demo@example.com / demo1234
```

**不需要 Docker，也不需要数据库服务。** SQLite 就是 `./data/dev.db` 这一个文件，第一次运行时自己建。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 运行时 / 包管理 | Bun 1.3 |
| 框架 | Next.js 16（App Router，Server Components 默认） |
| UI | HeroUI 3 + Tailwind CSS 4（底层是 react-aria-components） |
| 图标 | lucide-react |
| 数据库 / ORM | SQLite（`@libsql/client`）+ Drizzle 0.45 |
| 认证 | Auth.js（next-auth 5 beta）+ `@auth/drizzle-adapter` |
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
| `bun run test:e2e` | Playwright（用 `./data/e2e.db`，不碰开发库） |
| `bun run db:generate` | 改完 `src/core/db/schema.ts` 后生成迁移 SQL |
| `bun run db:migrate` | 应用迁移 |
| `bun run db:seed` / `db:studio` | 插入 demo 数据 / 打开可视化库浏览器 |
| `bun run db:reset` | ⚠️ 删库文件 + 重放迁移 + seed |

完整列表和每条命令的坑见 [DEVELOPMENT.md](DEVELOPMENT.md#常用命令)。

## 拿它开新项目

1. 改 `package.json` 的 `name`、`src/i18n/messages/*.json` 里的 `Meta`。
2. 不需要示例业务就删掉 `src/features/notes/`、`src/core/services/notes-service*.ts`、
   `src/app/api/notes/`、`src/app/[locale]/(app)/notes/`，以及 `NavLinks.ts` 里那一条和
   `e2e/notes.e2e.ts`。
3. `src/app/[locale]/(app)/dashboard/page.tsx` 是主题展示页，真业务落地后整页删掉。
4. 加自己的业务：照 [DEVELOPMENT.md 的标准流程](DEVELOPMENT.md#新增业务的标准流程)走。
