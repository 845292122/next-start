# 项目技术文档

一个全栈 Next.js 模板：App Router + HeroUI + Drizzle/SQLite + Auth.js + next-intl，包管理和运行时都用 Bun。

> ⚠️ 动手之前先看 [AGENTS.md](AGENTS.md)：这个仓库用的 Next.js 版本有 breaking changes，API 和约定
> 可能和你记忆里的不一样。写代码前查 `node_modules/next/dist/docs/` 里对应的文档。

## 目录

- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [分层与依赖方向](#分层与依赖方向)
- [数据层](#数据层)
- [错误处理](#错误处理)
- [可观测性](#可观测性)
- [安全](#安全)
- [UI 与主题](#ui-与主题)
  - [什么该写进 globals.css](#什么该写进-globalscss)
- [认证](#认证)
- [国际化](#国际化)
- [编码规范](#编码规范)
- [测试](#测试)
- [新增业务的标准流程](#新增业务的标准流程)
- [常用命令](#常用命令)
- [环境变量](#环境变量)
- [已知遗留与缺口](#已知遗留与缺口)

---

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 运行时 / 包管理 | Bun 1.3.3 | `bun install` / `bun run`，测试也用 Bun 自带的 runner |
| 框架 | Next.js 16.3.1 | App Router，Server Components 默认 |
| UI | HeroUI 3.2.4 | 底层是 react-aria-components，样式是 Tailwind v4 + CSS 变量 |
| 样式 | Tailwind CSS 4.3 | 没有 `tailwind.config.js`，配置全在 CSS 里 |
| 图标 | `lucide-react` | HeroUI 只自带十几个内部图标，不是图标库 |
| 数据库 | SQLite | 单文件，无需服务或容器；驱动是 `@libsql/client` |
| ORM / 迁移 | Drizzle 0.45 + drizzle-kit 0.31 | schema 就是 TS，迁移 SQL 进版本库 |
| 认证 | Auth.js（next-auth 5 beta） | Credentials provider + JWT session + `@auth/drizzle-adapter` |
| 国际化 | next-intl 4.13 | 中英双语，`[locale]` 路由段 + `src/proxy.ts` |
| 表单 | react-hook-form + `@hookform/resolvers` | 配 Zod schema |
| 校验 | Zod 4 | 表单、Route Handler、Server Action 共用同一份 schema |
| 客户端数据 | SWR 2.5 | 需要客户端搜索/轮询/乐观更新时用 |
| 明暗主题 | next-themes | 注入阻塞脚本，首屏不闪 |
| 邮件 | Resend + `@react-email/components` | 模板是 tsx |
| 日志 | pino（开发环境 pino-pretty） | |
| 环境变量 | `@t3-oss/env-nextjs` | 启动时用 Zod 校验，缺变量直接报错 |
| 代码质量 | Biome 2.5 | lint + format 一体，替代 ESLint + Prettier |
| 测试 | `bun test`（+ happy-dom）；Playwright | 前者单元/组件，后者 E2E |

## 目录结构

应用代码全部在 `src/` 下，仓库根目录只放配置文件、`drizzle/`、`e2e/`、`test/`。

### `src/app/` — 只放路由和页面

```
src/app/
├── [locale]/           # 所有渲染 HTML 的路由都在这一段下
│   ├── layout.tsx      # 根布局（没有 src/app/layout.tsx）
│   ├── error.tsx       # (app) 之外的错误边界（登录页、404 兜底……）
│   ├── (app)/          # 已登录区：带左侧导航栏（rail），layout 里有登录拦截
│   │   ├── layout.tsx  # 校验 session + 套一层 <AppShell>
│   │   ├── error.tsx   # 错误边界，渲染在 rail 里面
│   │   ├── loading.tsx # Suspense fallback，同样在 rail 里面
│   │   ├── page.tsx    # 即 "/"，307 跳到 /dashboard
│   │   ├── dashboard/  # 设计系统的活文档页
│   │   ├── notes/      # 完整业务示例
│   │   ├── settings/   # 占位页，新页面可以拷这个开头
│   │   └── 403/        # 无权限页
│   ├── (auth)/         # 全屏区：不带 rail，也不要求登录
│   │   └── login/
│   ├── not-found.tsx   # 本段抛 notFound() 时渲染
│   └── [...rest]/      # 未匹配 URL 的兜底，只调 notFound()
├── api/                # Route Handlers —— 注意在 [locale] 之外
│   ├── auth/[...nextauth]/
│   ├── health/         # 健康检查（不鉴权），见[可观测性](#可观测性)
│   └── notes/          # 外部消费者路径的示例，应用自己不调
├── global-error.tsx    # 根布局自己炸掉时的最后兜底，零 import
├── favicon.ico
└── globals.css         # 唯一的样式入口
```

约定与注意：

- **括号目录是路由组，不进 URL。** `[locale]/(app)/dashboard/page.tsx` 对应 `/dashboard`（中文）
  或 `/en/dashboard`（英文）。分组的意义是让两组页面用不同的 layout——`(app)` 有 rail 且要求登录，
  `(auth)` 都没有。
- **`api/` 必须留在 `[locale]` 外面。** Route Handler 不需要布局也不需要语言前缀，
  `src/proxy.ts` 的 matcher 也把 `/api` 排除掉了。
- **根布局是 [src/app/\[locale\]/layout.tsx](src/app/%5Blocale%5D/layout.tsx)，仓库里没有
  `src/app/layout.tsx`。** 它干四件事：校验 `params.locale`（非法值走 `notFound()`）、
  `setRequestLocale()`、`await auth()` 拿 session 传给 Provider、给 `<html>` 加
  `suppressHydrationWarning`（next-themes 要求，见 [UI 与主题](#ui-与主题)）。
  它是动态渲染的（读了 session），别指望这一层有静态优化。
- **`[...rest]/page.tsx` 不能删。** 没有它，未匹配的路径会去找（不存在的）根 `not-found`，
  渲染出 Next 内置的 404 而不是我们自己的页面。
- **`not-found.tsx` 故意不套 `AppShell`。** 套了就要有 session，而 404 对未登录访客也得能渲染。
- **三个错误边界是三个不同的位置，不是重复。** `error.tsx` 永远不包住**自己那一段的
  layout**，所以：`(app)/error.tsx` 渲染在 `AppShell` 里面（rail 还在，用户能导航走）；
  `[locale]/error.tsx` 接住 (app) 之外的页面，以及 `(app)/layout.tsx` 自己抛的错；
  `global-error.tsx` 接住 `[locale]/layout.tsx` 自己抛的错，此时连 `<html>` 都得它自己渲染。
  详见[错误处理](#错误处理)。
- Route Handler 里**每个 handler 自己校验会话**——`(app)/layout.tsx` 的守卫管不到它们，
  见[认证](#认证)。
- **Route Handler 默认只写给 Next.js 应用之外的消费者**（第三方调用方、移动端、webhook、或框架
  强制要求的回调如 `api/auth/[...nextauth]`）。应用内部的数据交互——表单、增删改、甚至客户端的
  搜索/乐观更新——优先用 Server Action，见[分层与依赖方向](#分层与依赖方向)的暴露方式优先级。

### `src/components/` — 跨业务复用的展示层

```
src/components/
├── layout/     # 应用外壳：AppShell.tsx + NavLinks.ts
├── providers/  # 全局 Provider（AppProviders.tsx）
└── ui/         # 通用小部件：BlackHoleMark / ErrorState / LoginHero / color-mode / locale-switch / sign-out-button
```

规则：**这里不写业务逻辑，也不碰数据库。** 只依赖 props、HeroUI 和 session。要用到某个业务域的
东西，说明它该放 `features/`。

- [src/components/layout/NavLinks.ts](src/components/layout/NavLinks.ts)：rail 的导航项清单，
  加页面要来这里加一条。注意 `labelKey` 是消息 key 而不是文案——这个模块不是组件，调不了 hook。
- [src/components/ui/color-mode.tsx](src/components/ui/color-mode.tsx)：`useColorMode()` 的
  公开 API（`colorMode` / `mode` / `setMode` / `toggleColorMode`）和姊妹模板保持一致，
  内部换成了 next-themes，所以调用方的代码可以互搬。

### `src/features/<域>/` — 单个业务域的前端组织

```
src/features/notes/
├── schema.ts      # zod schema，表单和接口共用
├── actions.ts     # Server Actions
├── swr-keys.ts    # 客户端缓存 key 的唯一来源
├── dto.ts         # 过网络的形状，见「DTO 为什么必需」
└── components/    # 只属于这个域的组件

src/features/auth/
└── components/LoginForm.tsx   # 登录表单（+ 同目录的组件测试）
```

`notes` 是模板自带的**完整**示例：从建表一路到界面，全部走 Server Action——包括
`NoteList` 的输入即搜和乐观更新（`listNotesAction` 当 SWR 的 fetcher）。不需要就整个删掉，
删除清单见 [README](README.md#拿它开新项目)。

### `src/core/` — 服务端能力，唯一允许碰 IO 的地方

```
src/core/
├── env.ts              # 全项目唯一读 process.env 的地方，Zod 校验
├── logger.ts           # pino 实例 + 脱敏 + loggablePath()
├── request-id.ts       # x-request-id 的来源与读取，见[可观测性](#可观测性)
├── security-headers.ts # CSP 与固定安全响应头的值，见[安全](#安全)
├── rate-limit.ts       # 内存限流器（单实例够用，多实例要换 Redis）
├── zod-config.ts       # 浏览器里关掉 zod 的 JIT（CSP 会把它当 eval）
├── errors.ts           # 错误词表：AppError 及子类，每个带一个 code
├── action-result.ts    # ActionResult 类型。types-only，客户端可以 import
├── action.ts           # runAction / runPublicAction —— Server Action 的运行器
├── http.ts             # withHandler / readJson / readParams —— Route Handler 的运行器
├── validation.ts       # parseOrThrow：safeParse → ValidationError
├── db/
│   ├── schema.ts       # 建表（就是它，没有 .prisma 文件）
│   ├── client.ts       # drizzle 实例单例（globalThis 缓存）
│   ├── migrate.ts      # 程序化迁移，脚本和单测共用
│   ├── seed.ts         # demo 用户（手机号 13800000000）+ 两条笔记
│   └── reset.ts        # db:reset 的实现
├── auth/
│   ├── config.ts       # Auth.js 配置：adapter、providers、callbacks
│   ├── index.ts        # 导出 handlers / auth / signIn / signOut
│   ├── schema.ts       # phoneOtpSchema + 固定演示码常量，config 和登录表单共用
│   ├── session.ts      # getRequiredSession()，没登录抛 UnauthorizedError
│   └── otp.ts          # 手机验证码的 stub，见"认证"一节
├── services/           # 业务逻辑 + 对应的 .test.ts
├── mailer/             # Resend 封装 + templates/*.tsx
└── storage/            # StorageAdapter 接口 + 本地磁盘占位实现
```

几个已经踩过坑、别再踩回去的点（代码里都有注释）：

- `src/core/db/client.ts` 把 drizzle 实例挂在 `globalThis` 上：Next 每次 dev HMR 和每个并行
  build worker 都会重新求值这个模块，不缓存就会每次新开一个数据库文件句柄。
- `src/core/logger.ts` 的 pino transport 会起 worker 线程，**不要在 `src/proxy.ts` 或 edge
  runtime 的文件里 import 它**。（Next 16 起 proxy 默认跑 Node runtime，所以它可能真的能跑，
  但 proxy 有可能被部署到 CDN，文档明确要求别依赖共享模块，所以 proxy 里一行日志都不打。）
- **`src/core/env.ts` 在模块作用域就把 `process.env` 快照成校验后的 `env` 对象**，消费方读的是
  这个冻结的对象（`db/client.ts` 打开的是 `env.DATABASE_URL`，不是 `process.env.DATABASE_URL`）。
  所以进程里**第一个** import 到 `@/core/env` 的模块（间接地：任何 import `core/logger.ts` 的
  东西，也就是 `core/` 里的大多数文件）就决定了此后所有代码看到的 `DATABASE_URL`。单测靠
  `test/unit-setup.ts` 的 `--preload` 处理这件事，见[测试](#测试)。
- `src/core/env.ts` 打开了 `emptyStringAsUndefined`：`.env.example` 里的可选变量都写成
  `RESEND_API_KEY=`，那到了 `process.env` 是空字符串而不是 undefined，
  `z.string().min(1).optional()` 会判它"太短"而不是"没填"。**关掉这个开关，照 `.env.example`
  拷一份就启动不了。**
- `drizzle.config.ts` 直接读 `process.env.DATABASE_URL` 而不走 `core/env`：drizzle-kit CLI 是
  独立进程，不需要 `AUTH_SECRET`，走 `core/env` 会因为缺变量报错。

### 其余目录

| 目录/文件 | 作用 |
| --- | --- |
| `drizzle/` | `drizzle-kit generate` 生成的迁移 SQL 和 `meta/` 快照。**进版本库，不手改** |
| `drizzle.config.ts` | drizzle-kit 的配置：dialect、schema 路径、输出目录、连接串 |
| `src/i18n/` | next-intl 的配置与文案，见[国际化](#国际化) |
| `src/proxy.ts` | Next 16 的中间件（旧名 `middleware.ts`）。**做 locale 解析 + 注入 `x-request-id` + 每请求 CSP nonce，不管登录态**。Next 16 起默认跑 Node runtime |
| `src/instrumentation.ts` | `onRequestError`：接住渲染期异常，把 digest 和真实堆栈写在一起，见[可观测性](#可观测性) |
| `src/lib/` | 不属于某个业务域的通用工具：目前只有 `action-error.ts`（把 `ActionResult` 的 `code` 翻成文案，见[错误处理](#错误处理)） |
| `src/types/messages.d.ts` | 把 `zh.json` 的形状喂给 next-intl 的 `AppConfig`，让 `t('key')` 受类型检查 |
| `e2e/` | Playwright 用例，文件名必须是 `*.e2e.ts`；`auth.setup.ts` 是登录态的来源 |
| `test/setup.ts` | happy-dom + jest-dom 注册。**只由 `test:dom` 脚本 `--preload`**，见[测试](#测试) |
| `test/unit-setup.ts` | 把 `DATABASE_URL` 顶成 `:memory:`。**只由 `test:unit` 脚本 `--preload`**，见[测试](#测试) |
| `biome.json` | 格式化 + lint + import 排序规则 |
| `playwright.config.ts` | E2E 配置：setup project + `webServer` 跑 db:reset → build → start |
| `postcss.config.mjs` | 只有 `@tailwindcss/postcss` 一个插件 |
| `next.config.ts` | next-intl 插件 + `serverExternalPackages`（libsql 的原生模块不能打包）+ 固定安全响应头 |
| `AGENTS.md` / `CLAUDE.md` | 给 AI 助手的项目说明。那段 Next.js 提示是 `next dev` 自动写入的，别手删 |

## 分层与依赖方向

```
src/app/ (路由、页面)
  ├─→ src/features/<域>/   业务域的 schema / actions / dto / 专属组件
  │      └─→ src/core/     服务端能力
  ├─→ src/components/      通用展示层（不依赖 core）
  ├─→ src/core/            页面也可以直接调 service
  └─→ src/i18n/            文案与 locale 感知的导航
                src/lib/   两边都能用
```

硬规则：

1. **页面、Route Handler、Server Action 里都不写 SQL。** 所有数据访问收在
   `src/core/services/`，三者都只调函数，不直接碰 db client。
2. **`src/components/` 不许 import `src/core/`。** 它一旦需要业务数据，就该搬到 `src/features/`。
3. **只有 `src/core/env.ts` 读 `process.env`。** 别的地方要用配置就 `import { env }`。
4. **越权防线在 service 层。** service 的第一个参数一律是 `userId`，所有 `where` 都带上它，
   见 [src/core/services/notes-service.ts](src/core/services/notes-service.ts)。这样即使某个
   handler 忘了校验，也拿不到别人的数据。`notes-service.test.ts` 里有一条用例专门守这件事。
5. **`core/` 不许 import `features/`。** 所以登录表单和 Credentials provider 共用的
   `phoneOtpSchema` 放在 `src/core/auth/schema.ts`，不在 `features/auth/` 里。
6. **暴露方式有优先级，不是按场景随便选一条：**
   - **默认用 Server Action。** 表单提交、增删改，以及绝大部分客户端交互（搜索、勾选、乐观更新……）
     都走 `src/features/<域>/actions.ts`。Server Action 不是只能配 `<form action>`——Client
     Component 里也能直接 `await someAction(...)`（配 `useTransition` 拿 pending 状态），甚至可以
     直接当 SWR 的 fetcher 用。需要输入即搜、乐观更新，不代表就必须写 Route Handler。
   - **Route Handler 只留给 Next.js 应用之外的消费者**：第三方调用方、移动端、webhook 接收端，
     或框架强制要求的回调（如 `api/auth/[...nextauth]`）。"页面里想在客户端调一下"不算理由。
   - **应用内部没有第二条路径。** `notes` 域的 `NoteList` 就是证明：它做输入即搜和乐观更新，
     全部走 Server Action——`listNotesAction` 直接当 SWR 的 fetcher 用。
     `src/app/api/notes/` 保留着，但那是**外部消费者路径的示例**，应用自己一行都不调它。

不管走哪条，只要数据跨了服务端/客户端边界（Server Action 的返回值，或 Route Handler 的
`Response.json()`），都要过一遍 DTO，见 [DTO 为什么必需](#dto-为什么必需)。SWR 的 key 统一放
`src/features/<域>/swr-keys.ts`，别在组件里拼字符串——**即使 key 已经不是 URL 了**，它现在是
`['notes', query]` 这样的元组。

### DTO 为什么必需

同一批行会用两种方式到客户端：`/notes` 页面把 service 的结果直接传给 Client Component，
而 SWR 是从 `/api/notes` 拿的——`Response.json()` 会把 `createdAt` 从 `Date` 变成字符串。
两条路的形状必须一致，否则 `fallbackData` 和拉回来的数据类型不同。
所以**凡是跨服务端/客户端边界的行，都过一遍 [src/features/notes/dto.ts](src/features/notes/dto.ts)
的 `toNoteDTO()`**。

## 数据层

Drizzle + SQLite。表定义在 [src/core/db/schema.ts](src/core/db/schema.ts)（它就是 schema，
不生成任何客户端代码），迁移 SQL 在仓库根的 `drizzle/`。

```
drizzle/                   # 迁移 SQL + meta/ 快照，进版本库，不手改
drizzle.config.ts          # dialect / schema 路径 / out 目录 / 连接串
src/core/db/
├── schema.ts              # 五张表：user / account / session / verificationToken / note
├── client.ts              # drizzle 实例单例
├── migrate.ts             # runMigrations()
├── seed.ts
└── reset.ts
```

### 为什么是 `@libsql/client` 而不是 `better-sqlite3`

`better-sqlite3` 是 Node 生态的默认选择，在 Node 25 上装得也很顺——但它的 N-API 插件会让
**Bun 直接崩掉**（`panic: NAPI FATAL ERROR`）。而这个项目两个运行时都要用：Next 跑在 Node 上，
`db:seed` / `db:migrate` / `bun test` 跑在 Bun 上。`@libsql/client` 是两边都能用的那个。
附带好处是 `file:` URL 和 Turso 连接串可以直接替换本地路径。

### SQLite 的几个坑

- **`DATABASE_URL` 是文件路径，不是 URL。** 写成 `./data/dev.db`，这样 drizzle-kit 和运行时
  能共用一个值。libsql 需要 scheme，`client.ts` 里的 `toLibsqlUrl()` 负责补 `file:`；
  `:memory:` 原样透传。`src/core/env.ts` 因此用 `z.string()` 校验它，不是 `z.url()`。
- **外键默认是开的——但只是因为用了 libsql。** 裸 SQLite（和 `better-sqlite3`）默认关闭外键，
  而且这个设置是**每个连接**一次的。`client.ts` 里没写 `PRAGMA foreign_keys = ON` 是验证过的
  结论，不是漏了。换驱动的话必须加回来，否则 `onDelete: 'cascade'` 全部静默失效。
- **没有 `ilike`。** SQLite 的裸 `LIKE` 只对 ASCII 大小写无关，还受列 collation 影响。
  大小写无关搜索要显式套 `lower()`：

  ```ts
  like(sql`lower(${notesTable.title})`, `%${query.toLowerCase()}%`)
  ```

  `notes-service.test.ts` 和 `e2e/notes.e2e.ts` 各有一条用例守这个。
- **时间戳有两种单位，别混。** auth 那三张表的 `emailVerified` / `expires` 必须是
  `integer({ mode: 'timestamp_ms' })`——`@auth/drizzle-adapter` 写死了毫秒。我们自己的
  `note.createdAt` 用 `integer({ mode: 'timestamp' })`（秒），配 `default(sql\`(unixepoch())\`)`。
  单位搞错不会报错，只会把时间算到 1970 年。
- **`.returning()` 要配 `await`。** 不 await 拿到的是查询构造器，
  `const [x] = db.insert(...).returning()` 会抛 "not iterable"。

### Drizzle 相对 Prisma 的两个便利

1. **`where` 不限唯一字段。** 所以硬规则第 4 条（写操作也要带 `userId`）直接就能写，
   不需要 Prisma 那种 `updateManyAndReturn` 变通。
2. **有程序化迁移 API。** `drizzle-orm/libsql/migrator` 的 `migrate()` 让单测能直接在
   `:memory:` 上建表，不用起子进程跑 CLI，见[测试](#测试)。

### 行类型从 schema 推

```ts
import type { Note } from '@/core/db/schema'   // = typeof notesTable.$inferSelect
```

不要手写行类型，也**没有需要 `bun install` 才能 typecheck 的生成物**——克隆下来直接
`bun run typecheck` 就行。

## 错误处理

一句话：**service 抛类型化的错误，暴露层把它翻译成契约。** 业务代码里不写
`try/catch`，也不写 `if (!session) return 401`。

### 错误词表

[src/core/errors.ts](src/core/errors.ts) 定义了全部错误类型。每个都带一个 `code`，
这个 code 是整套机制的枢轴：

| 类 | `code` | HTTP | 语义 |
| --- | --- | --- | --- |
| `ValidationError` | `VALIDATION` | 400 | 入参不符合 schema |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | 没有有效会话 |
| `ForbiddenError` | `FORBIDDEN` | 403 | 登录了但没权限 |
| `NotFoundError` | `NOT_FOUND` | 404 | 不存在，**或不属于当前用户** |
| `ConflictError` | `CONFLICT` | 409 | 唯一约束之类的冲突 |
| `RateLimitedError` | `RATE_LIMITED` | 429 | 触发限流（还没有地方抛，留给限流器） |
| —— 其它任何 throw —— | `INTERNAL` | 500 | bug |

两条规则值得单独记：

- **`NOT_FOUND` 同时覆盖"不存在"和"是别人的"。** service 的每个 `where` 都带 `userId`
  （见[分层与依赖方向](#分层与依赖方向)第 4 条），所以两种情况天然落到同一个分支。
  刻意不区分——区分了就等于告诉调用方哪些 id 是真实存在的。
- **`INTERNAL` 只暴露 code，别的什么都不给。** 原始异常挂在 `cause` 上，只进日志。
  `core/http.test.ts` 里有一条用例专门断言 `SQLITE_BUSY` 和文件路径不会出现在响应体里。

`fields` 字段带的是**出错的字段名，不带文案**。项目里的 schema 一律不写 locale 相关的
消息（原因见 [core/auth/schema.ts](src/core/auth/schema.ts)），zod 自带的消息又是英文，
所以客户端拿字段名自己去翻译。空数组会被基类归一化成 `undefined`，因此"`fields` 存在"
永远意味着"确实能归到这些字段"。

### Server Action：返回值，不是异常

**生产构建下 Next 会把 Server Action 里所有未捕获的异常替换成一句通用文案加一个
digest**，所以异常根本没法告诉客户端任何事——"没登录"、"标题超长"、"数据库挂了"抵达
客户端时长得一模一样。因此预期内的失败一律走返回值，这也是 Next 官方对 expected
errors 的建议（`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`）。

契约在 [src/core/action-result.ts](src/core/action-result.ts)：

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; fields?: string[] }
```

写法固定成这样（[src/features/notes/actions.ts](src/features/notes/actions.ts) 是参考实现）：

```ts
'use server'

export async function createNoteAction(
  input: CreateNoteValues,
): Promise<ActionResult<NoteDTO>> {
  return runAction({
    name: 'createNote',              // 只用于日志关联
    schema: createNoteSchema,
    input,
    handler: async (parsed, session) => {
      const note = await createNote(session.user.id, parsed)
      revalidatePath('/[locale]/notes', 'page')
      return toNoteDTO(note)
    },
  })
}
```

`runAction` 包掉四件事：会话校验、schema 解析、错误 → code 映射、日志。三个细节：

- **必须是 `export async function`，不能是 `export const x = wrapper(...)`。**
  `'use server'` 模块只允许导出 async 函数。
- **会话在解析入参之前校验。** 未登录的调用方不该能通过"收到的是 UNAUTHORIZED 还是
  VALIDATION"来试探 schema。`core/action.test.ts` 有用例守这个顺序。
- **不需要会话的 action 用 `runPublicAction`**（比如将来的"发送验证码"）。故意做成两个
  函数而不是一个 `auth: false` 选项——"哪些 action 是任何人都能调的"要能一条 grep 查出来，
  不能藏在选项对象里。

### Route Handler：`withHandler`

[src/core/http.ts](src/core/http.ts) 是对应的另一半。Route Handler 只服务这个 Next.js
应用之外的消费者（见[分层与依赖方向](#分层与依赖方向)），所以它们的错误契约格外重要——
那些调用方没法读我们的源码来推断"这个 500 其实是说你的 JSON 格式不对"。

```ts
export const GET = withHandler(async (request) => {
  const session = await getRequiredSession()      // 抛 → 401
  const notes = await listNotes(session.user.id)
  return Response.json(notes.map(toNoteDTO))
})

export const PATCH = withHandler<RouteContext<'/api/notes/[id]'>>(
  async (_request, { params }) => {
    const session = await getRequiredSession()
    const { id } = await readParams(params, noteParamsSchema)   // 非 uuid → 400
    return Response.json(toNoteDTO(await toggleNoteDone(session.user.id, id)))
  },
)
```

- **`RouteContext<'/api/...'>` 是 Next 生成的全局类型**，`params` 的类型直接跟着路由路径走，
  不用手写一份会漂移的副本。和 layout 里的 `LayoutProps<'/[locale]'>` 是同一套东西。
- **body 用 `readJson(request, schema)`，不要 `schema.parse(await request.json())`。**
  后者有两条都会变成 500 的路径：body 不是合法 JSON（`request.json()` 抛 `SyntaxError`，
  空 body 就够了）、以及 schema 不匹配（裸 `ZodError` 逃出去）。
- **动态段用 `readParams(params, schema)`。** 路由参数是任意字符串。

### 千万别在包装器里漏掉 `unstable_rethrow`

`runAction` 和 `withHandler` 都是大范围 try/catch，而 **`redirect()` / `notFound()` /
`permanentRedirect()` 是靠抛内部异常工作的**——被 catch 住就等于被吞掉。所以两个包装器的
catch **第一句**都是：

```ts
unstable_rethrow(error)
```

这个 bug 的症状是静默的：跳转不发生，而调用方只看到一个 `{ ok: false, code: 'INTERNAL' }`。
`core/action.test.ts` 和 `core/http.test.ts` 各有一条用例守它。将来自己写别的包装器，
第一句照抄。参考
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`。

### 日志级别按 code 分

`isClientError(code)`（`INTERNAL` 之外全是 `true`）决定用 `warn` 还是 `error`：调用方
造成的失败是 `warn` 且不打堆栈，只有真正的故障是 `error`。**把校验失败打成 error 级别，
是让错误日志失去价值的最快方式。**

### 客户端怎么消费这个契约

`code` 到文案的映射是 UI 的事，而且必须按语言走，所以它在客户端：
[src/lib/action-error.ts](src/lib/action-error.ts) 的 `useActionErrorMessage()` 把一个
`ActionFailure` 变成一句翻译好的话，文案在 `Errors.code.*`。

那张 `Record<AppErrorCode, ...>` 是**故意写全**的，没用 `t(\`code.${code}\`)`：写全了，
往 `core/errors.ts` 加一个 code 却忘了加文案，`bun run typecheck` 会在那里挂掉；用模板字符串
的话只会在运行时静默渲染出 key 名。

[NoteForm](src/features/notes/components/NoteForm.tsx) 是参考实现，规则是**带字段名的失败
落到字段上，其余进 toast**：

```tsx
if (!result.ok) {
  if (result.fields?.length) {
    for (const field of result.fields) {
      if (field === 'title' || field === 'body') {
        setError(field, { message: t(`${field}Invalid`) })
      }
    }
    return
  }
  toast.danger(errorMessage(result))
  return
}
```

两点值得说明：

- **服务端的 `VALIDATION` 是纵深防御，不是日常路径。** 同一份 schema 已经在客户端由
  `zodResolver` 跑过了，所以走到这里意味着请求被改过或者 schema 漂移了。
- **字段文案是 `t('titleInvalid')`，不是 `errors.title?.message`。** 后者是 zod 自带的英文串。
  按"哪个字段错了"取文案，和 `LoginForm` 一致。

### 三个错误边界

| 文件 | 接住什么 | 渲染在哪 |
| --- | --- | --- |
| `app/[locale]/(app)/error.tsx` | (app) 组里页面抛的错 | `AppShell` **里面**——rail 还在，用户能导航走 |
| `app/[locale]/error.tsx` | (app) 之外的页面，**以及 `(app)/layout.tsx` 自己抛的错** | 整个 `<body>` 内 |
| `app/global-error.tsx` | `[locale]/layout.tsx` 自己抛的错 | 它自己的 `<html>` / `<body>` |

规则来自 Next：**`error.tsx` 不包住自己那一段的 layout**，所以每往上一层就少一层可用的东西。

- **签名是 `{ error, retry }`。** Next 16 改的名，`retry` 从 16.3 起稳定。`retry()` 会重新
  取数据并重渲染边界的 children；老的 `reset()` 只清错误状态，不重新取。
- **`[locale]/error.tsx` 和 `(app)/error.tsx` 里 `useTranslations` 是可用的**——它们都在
  `[locale]/layout.tsx` 的 `NextIntlClientProvider` 之内。可见部分共用
  [ErrorState](src/components/ui/ErrorState.tsx)，两个文件的差别只是它渲染在哪。
- **`global-error.tsx` 什么都 import 不了，这是刻意的。** 它替换掉根布局，所以：得自己渲染
  `<html>`/`<body>`；不能 `export metadata`（错误边界是 Client Component，用 React 的
  `<title>` 代替）；**拿不到全局样式**，因为 next-themes 的脚本和它写的 `class="light|dark"`
  都属于刚刚炸掉的那个 layout。更重要的是，这是应用坏掉时唯一还要工作的页面——每一个
  import 都是它跟着一起坏掉的途径，所以它用内联 `<style>` 和硬编码文案，一个 import 都没有。
  文案是中英双语硬编码的：翻译在 `NextIntlClientProvider` 后面，而那个 provider 已经没了。
- **`digest` 值得露出来。** 生产环境下真实消息只在服务端日志里，客户端只有这个 hash——它是
  用户能拿来报障的唯一线索。

### `loading.tsx` 带来的一条无害日志

`app/[locale]/(app)/loading.tsx` 给这一组加了 Suspense 边界，于是这些页面变成**流式响应**。
代价是：客户端在响应还没发完时就离开（语言切换是 `window.location.assign()` 的硬跳转，
最容易触发），服务端会打一条

```
⨯ Error: The destination stream closed early.
```

**这是无害的**——它说的是客户端主动断开了，不是渲染失败。加 `loading.tsx` 之前
（`bun run test:e2e` 跑 30 个用例）一次都不出现，之后偶发出现一到两次，取决于时序。
知道它是什么就行，别去追。

## 可观测性

三件事：日志能不能关联、错误能不能查、探针能不能探。

### 请求 id 从哪来，为什么不是 AsyncLocalStorage

一条 `x-request-id` 贯穿一次请求。没有它，一个 Server Action 的失败日志和同一次请求的
`onRequestError` 日志根本连不起来，用户报"它坏了"也没有东西可 grep。

来源有三个，按优先级（见 [src/core/request-id.ts](src/core/request-id.ts)）：

1. **外部传入的 `x-request-id`**——前面的负载均衡 / CDN / 反代通常会带一个，沿用它我们的
   日志才能和它们的接上。所以是先读后生成。
2. **`src/proxy.ts`**，页面请求走这条：外部没带就生成一个，并**向上游转发**给渲染层。
3. **`core/http.ts` 的 `withHandler`**，Route Handler 走这条。它必须自己生成，因为
   **proxy 的 matcher 排除了 `/api`**——Route Handler 永远看不到 proxy 注入的 id。

**为什么不用 AsyncLocalStorage：** Next 的 proxy 文档写得很直接——proxy "可以跑在应用主
运行时之外"、可能被部署到 CDN，所以"不要指望依赖共享模块或全局变量"，跨 proxy→应用只能走
header / cookie / URL。ALS 在这里根本不成立。应用内部理论上可以用 ALS，但没有一个能安装
per-request 包装器的位置，而实际会打日志的地方只有 `runAction` / `withHandler` /
`instrumentation.ts` 三处，显式传递更简单。

页面侧读 id 用 `currentRequestId()`（内部是 `headers()`）。它在没有请求上下文时返回
`undefined` 而不是抛错——这样 `runAction` 在单测里也能用；但注意里面有 `unstable_rethrow`：
`headers()` 也会抛 Next 自己的"你在静态渲染里用了动态 API"信号，把**那个**吞掉会让一个
构建期诊断变成静默渲染错的页面。

> proxy 里的写法有个关键点：**在调 next-intl 之前改 `request.headers`**。next-intl 内部用
> `new Headers(request.headers)` 建转发头再交给 `NextResponse.next({ request: { headers } })`
> （见 `node_modules/next-intl/dist/esm/development/middleware/middleware.js`），所以那时候
> 设的东西会被带下去。反过来先让 next-intl 出响应、再往响应上加**请求**头是做不到的，除非
> 动 Next 内部的 `x-middleware-override-headers` 协议。这条链路有 e2e 守着
> （`e2e/observability.e2e.ts`）。

### 日志脱敏，以及它保证不了什么

`core/logger.ts` 配了 pino 的 `redact`。`phone` 排第一位有原因：它是本项目的**登录身份**
（`core/auth/otp.ts`），是最容易到处乱跑的那条 PII。每个 key 都列两遍（裸的和 `*.` 一层），
因为 fast-redact 匹配的是字面路径而 `*` 只覆盖一层，而调用点写出来的正是一层嵌套。

**两条它管不到的，都用测试钉住了（`core/logger.test.ts`）：**

- **字符串里的敏感数据。** 把手机号插进异常 message（`Error: no user for 138...`）之后，
  它就是一串字符而不是带 key 的值，脱敏看不见。**由此得出的规矩：别把用户数据写进异常消息。**
- **URL 里的凭据。** 所以日志里的路径一律过
  [`loggablePath()`](src/core/logger.ts)，而不是直接记 `request.url` / `request.path`。这不是
  假想风险：OAuth 会回调到 `/api/auth/callback/...?code=...&state=...`，那个 `code` 能换出一个
  会话，而 `onRequestError` 看得到**每一条**路由。它只替换危险的参数值，保留其余 query——
  query 往往是"到底哪个请求炸了"的唯一线索。

邮件收件人是掩码而不是脱敏（`core/mailer/send.ts` 的 `maskEmail()`）：那条日志是用来解释
"为什么没发信"的，域名是真正有诊断价值的部分，本地部分不落盘。`[redacted]` 在这里严格更差。

### `instrumentation.ts`：digest 到堆栈的唯一桥

[src/instrumentation.ts](src/instrumentation.ts) 导出 `onRequestError`，接住两个包装器管不到
的东西——**首先是 Server Component 渲染期间抛的异常**，那是应用代码没有位置去拦的。

它也是生产环境下错误的两半唯一相遇的地方。Next 把送到浏览器的消息换成了 hash，所以错误页
只能显示那个 `digest`（见[错误处理](#错误处理)）。**没有一个钩子把 digest 和真实堆栈写在
一起，用户报上来的 digest 就是死路。** 这个文件的意义就在这。

两个细节：

- `error` 的类型是 `unknown`，因为 Server Components 渲染时 React 可能换掉原始异常对象。
  `digest` 才是可靠的标识，所以是防御性读取而不是强转。
- **id 缺失时不兜底生成。** 缺失意味着 proxy 没跑，编一个只出现在这一行的值只会看起来像
  关联，实际不是。
- 真上生产就把这里的 `logger.error` 换成 Sentry / OTel，钩子形状不用变。没有导出
  `register()`，因为暂时没有 tracer 要初始化。

### `/api/health`

[src/app/api/health/route.ts](src/app/api/health/route.ts)。容器编排、负载均衡、拨测都要它。
也是本模板最小的**外部消费者** Route Handler 示例。

- **真跑一条 `select 1`**，不只是"进程活着"——这是 readiness 和 liveness 的区别。数据库死了
  却报健康，比没有探针更糟。
- **`export const dynamic = 'force-dynamic'`。** 没有它，一个没有请求期输入的路由可能被缓存
  应答，那就等于探了个假。
- **故意不鉴权**，所以返回体形状是固定的：只有 `status`，没有版本、没有路径、没有失败原因。
  失败原因进日志。`e2e/observability.e2e.ts` 有一条用例专门断言"不需要 session"——将来改
  鉴权时它会挡住"健康检查悄悄变成 401"，那在负载均衡看来就是把实例踢出轮转。

## 安全

### 响应头分两处下发

| 放哪 | 下发什么 | 为什么 |
| --- | --- | --- |
| `next.config.ts` 的 `headers()` | 所有**固定值**的头 | 它作用于**每一个**响应，包括 `/api/*` 和静态资源——而 proxy 的 matcher 把这些排除了。JSON 接口上的 `nosniff` 正是最需要它的场合 |
| `src/proxy.ts` | `Content-Security-Policy` | 它需要每请求一个新 nonce，而只有 proxy 能生成 |

值都在 [src/core/security-headers.ts](src/core/security-headers.ts)，这样它们能被单测，而不是
埋在配置文件里靠肉眼看。

两个不是随手写的默认值：

- **HSTS 只在生产下发。** 把 `localhost` 钉成 https 是**单向操作**，之后 `bun run dev` 会一直
  坏掉，直到手动去浏览器设置里清掉。而浏览器在 http 上本来就忽略 HSTS，所以开发环境不发它
  一点损失都没有，却避开一个真实的坑。
- **HSTS 不带 `preload`。** 那意味着把域名提交到浏览器内置列表里，撤销极其麻烦。这应该是个
  深思熟虑的决定，不该从模板里继承。

### CSP：脚本严，样式松，这是权衡不是偷懒

`script-src` 是 nonce + `'strict-dynamic'`——真正阻止注入脚本执行的就是这一条。
`style-src` 只做到 `'unsafe-inline'`。原因值得完整记下来，因为它反直觉：

**react-aria（HeroUI 的底座）会在运行时注入自己的 `<style>` 元素**
（`[data-react-aria-pressable] { touch-action: ... }`），它没有 nonce，react-aria 也没有提供
传 nonce 的入口。

而 CSP 规范堵死了那个显而易见的绕法：**一个 directive 里只要出现 nonce 或 hash，
`'unsafe-inline'` 就会被忽略。** 所以 `style-src` 做不到"我们的样式用 nonce、它的用
unsafe-inline"——只能二选一。

于是只有三条路，本项目选了第三条：

1. **只用 nonce** → react-aria 那张样式表被拒。实测过：规则被丢掉，唯一症状是触摸设备上的
   触摸行为退化。安静，而且恰好坏在最不容易被测到的环境里。
2. **nonce + react-aria CSS 的 `'sha256-...'`** → 能跑的最严方案，但哈希钉在第三方的内部
   样式表上，一次 patch 升级就失效。而哈希失效时最顺手的"修法"是把它删掉——那就退回第 1 条
   的静默故障。
3. **样式放开 `'unsafe-inline'`** → 现在的做法。注入的 CSS 能污染页面、能通过选择器外泄一些
   属性值，但**不能执行脚本**。在 `script-src` 保持严格的前提下，这是更小的风险，而且不会腐烂。

`e2e/security.e2e.ts` 断言生产策略下**零** CSP 违规，所以哪天需要重新审视，测试会先说话。

### 两个必须手工接线的 nonce 消费者

Next 会自动把 nonce 打到它**自己**生成的东西上（框架脚本、页面 chunk、它自己的内联样式）。
它不认识的就得自己接：

- **next-themes 的阻塞脚本。** `app/[locale]/layout.tsx` 读 `x-nonce` 传给
  `AppProviders` → `ThemeProvider` 的 `nonce` prop。接错了的症状恰恰是 next-themes 被选进来
  要解决的那个问题：hydration 之前闪一帧浅色。`e2e/security.e2e.ts` 有一条用例断言
  `<html>` 上有 `light|dark` class，就是守这个。
- **CSP header 必须同时设在请求和响应上。** 响应那份是浏览器执行的；**请求那份是 Next 用来
  解析出 nonce 并打到自己脚本上的**——只设响应，Next 自己的脚本就全部没有 nonce。

### zod 的 JIT 会被当成 eval

zod 4 用 `new Function` 把 object schema 编译成快速校验器，严格 CSP 视其为 `eval`。
浏览器里每次 `zodResolver` 校验都会撞 `script-src`——这就是 `e2e/security.e2e.ts` 在登录页
抓到的 `script-src: eval` 违规。

[src/core/zod-config.ts](src/core/zod-config.ts) 在**浏览器里**关掉 JIT。另一条路是给生产
`script-src` 加 `'unsafe-eval'`，那会把唯一真正拦住注入脚本的 directive 废掉。表单校验少一次
JIT 完全无感——一个表单几个字段，不是热循环。**服务端的 JIT 保留**：服务端没有 CSP，而校验量
其实都在那边。

> `globalConfig.jitless` 是在 schema **parse 时**读的，不是构造时，所以只要在第一次 parse
> 之前跑到就行。它由 `core/auth/schema.ts` 和 `features/notes/schema.ts` 以副作用 import 引入，
> 这样任何能 parse 的客户端代码必然先加载了它。**客户端要用的新 schema 模块也得 import 它。**

### 限流

[src/core/rate-limit.ts](src/core/rate-limit.ts)，挂在 `authorize()` 上，**按手机号**限流，
5 次 / 10 分钟。没有它，6 位验证码是可以被走完的——这里没有任何东西让攻击者每次尝试付出代价。

- **在比对验证码之前限流**，否则限流本身就没意义。
- **拒绝时返回 `null`，和验证码错误长得一模一样。** 告诉攻击者"你被限流了"，等于把节奏信息
  交给他。Auth.js 在这里也没有单独的 code 通道。
- **按手机号而不是按 IP。** 威胁是"猜*这个号*的码"，而换 IP 很容易、换目标号就没意义了。
  按 IP 还会把一个 NAT 后面的所有用户误判成同一个客户端。生产环境应该两者都做，IP 取自
  **你自己的反代设置的头**，绝不能信客户端传的 `X-Forwarded-For`。
- ⚠️ **状态在进程内存里。** 两个实例各放行一份配额；Serverless 上按请求起实例的话等于没有
  限流。它对本模板面向的单实例部署是真实防线，对更大的部署是**占位**——保留 `RateLimiter`
  接口，换成 Redis/Upstash 实现即可，所有调用点都是写在接口上的。

### `trustHost` 与反向代理

`trustHost: true` 是开着的，否则自托管部署下 Auth.js 会用 UntrustedHost 拒掉每一个请求，
零配置的 `bun run start` 根本跑不起来。

代价是真实的：开着它且 `AUTH_URL` 未设时，Auth.js 从进来的 `Host` 头推导回调和跳转 URL，
而那个头是应用前面任何一环都能设的。**所以生产要设 `AUTH_URL`**——设了之后规范化的 origin
来自配置，Host 头就不再要紧。`src/instrumentation.ts` 的 `register()` 会在生产环境缺
`AUTH_URL` 时打一条启动告警（告警而不是拒绝启动：把一条加固建议变成升级即停机不合适）。

反代那一侧也要做对：把 `Host` 固定成规范域名，别原样透传客户端传来的值。

### Route Handler 为什么没有 CSRF token

`/api/notes/[id]` 的 PATCH / DELETE 靠 cookie 鉴权，没有 CSRF token。这是**安全的**，但理由
必须写清楚，否则下一个人加个接口就出事：

- Auth.js 的会话 cookie 是 `SameSite=Lax`，跨站发起的请求带不上它。
- PATCH / DELETE 不是 CSP 意义上的"简单请求"，会触发 CORS 预检，而我们没有放行任何跨源。

**所以这两条前提哪条被打破，就必须补 CSRF 防护**：把 cookie 改成 `SameSite=None`（比如为了
嵌入第三方页面），或者加了宽松的 CORS 头，或者新增一个用 `POST` + 表单编码的接口
（那种是简单请求，不触发预检）。

Server Action 不在此列——它自带 origin 校验。

## UI 与主题

### 样式入口只有一个

[src/app/globals.css](src/app/globals.css)：

```css
@import '@heroui/react/styles';   /* 内含 @import "tailwindcss" */
:root, .light { --accent: ...; }  /* 单色主题覆盖，故意不包 @layer */
@source '../';                    /* 让 Tailwind 扫 src/ */
@theme { --font-sans: ...; --animate-page-enter: ...; }
@keyframes pageEnter / blackholeSpin
@layer components { ... }         /* 见下面「什么该写进 globals.css」 */
```

前两条都是必需的，各有原因：

- **不要再单独 `@import "tailwindcss"`。** HeroUI 的入口
  （`node_modules/@heroui/styles/dist/index.css`）已经引过了，再引一次每个 utility 都会出现两遍。
- **`@source '../'` 不能省。** Tailwind 的自动内容探测以"引入 tailwindcss 的那个文件所在目录"
  为根，而按上一条那是在 `node_modules` 里，而 `node_modules` 永远不会被扫。少了这行，
  `src/` 里用到的 utility 一个都不会生成——页面会渲染成完全没样式。

**没有 `tailwind.config.js`。** 主题令牌（字体栈、动画）写在 CSS 的 `@theme` 块里。

### 什么该写进 globals.css

优先级永远是 **Tailwind utility → HeroUI 语义变量 → `globals.css`**。只有下面这几类东西
才值得进 `globals.css`，其余一律用 utility 表达在组件里：

| 类别 | 现有例子 | 为什么不能用 utility |
| --- | --- | --- |
| 主题变量覆盖 | 单色主题那两个 `:root` / `.dark` 块 | 就是变量声明本身 |
| `@theme` 令牌 | `--font-sans` / `--animate-page-enter` | Tailwind 靠它生成 utility |
| `@keyframes` | `pageEnter`、`blackholeSpin` | 关键帧没有 utility 形式 |
| 补 HeroUI 缺的样式 | `.button--shadow`、`.menu-item` 抬升 | 要挂到 HeroUI 自己的类名上 |
| 多元素图形 | `.blackhole*` | conic-gradient + 遮罩写成 arbitrary value 没法读 |

**主题覆盖那两块故意不包 `@layer`。** HeroUI 自己的变量在 `@layer base` 里，而按 Cascade
Layers 规范，不在任何 layer 里的规则**无条件**压过所有 layer 里的规则，跟选择器特异性无关。
所以裸放就能覆盖，不用去比特异性。反过来，补 HeroUI 组件样式的那几块**要**放
`@layer components`，这样组件里一个 `shadow-none` utility 还能盖掉它（utilities 层高于
components 层）。

### 补出来的两个 HeroUI 样式

HeroUI 3 有两处缺口，都在 `globals.css` 的 `@layer components` 里补上了：

- **`.button--shadow`** —— v2 有 `variant="shadow"`，v3 砍掉了。补成一个**可叠加的修饰类**
  而不是新 variant：HeroUI 每个颜色 variant 只是设 `--button-bg` 这几个变量，所以阴影颜色直接
  从同一个变量 `color-mix()` 出来，能和任意 variant 组合，不用给每种颜色写一份。用法是手写
  `className="button--shadow"`。在 `outline` / `ghost` 上几乎看不见——它们的 `--button-bg`
  是透明的，这是预期结果。
- **`.menu-item` 悬停抬升** —— HeroUI 的 `.menu-item` 已经声明了 `transition: box-shadow`
  却从没设过任何阴影，钩子留着效果没实现。补的时候有三个坑，注释里都写了，改之前先读：
  阴影要有 padding 容身之处（外层 popover 是滚动容器，按列表盒子裁剪）；白底浮层上的白卡片
  必须给列表加底色才有图底关系；以及**那条 padding 覆盖必须打得过
  `.dropdown__popover [data-slot="dropdown-menu"]` 的 (0,2,0) 特异性**——输了的话同一条规则
  里其它声明照样生效，只有 padding 被吃掉，看起来完全不像特异性问题。

### 侧边栏 rail 的两个取舍

[AppShell.tsx](src/components/layout/AppShell.tsx)：

- **导航项只有图标，文字进 `aria-label`。** 可访问名和从前有可见文字时一样，所以
  `getByRole('link', { name: '设置' })` 那些 e2e 断言不受影响——改这里时别把 `aria-label` 弄丢。
- **`Tooltip.Trigger` 包着 `Link`，而不是让 `Link` 当 trigger。** react-aria 只把 trigger
  的事件交给它自己的可聚焦组件，而这里必须是 `next/link` 才有预取和 `useLinkStatus`。
  代价是**悬停会出 tooltip，键盘聚焦不会**（实测确认）。屏幕阅读器读的是 `aria-label`，
  所以无障碍名字没丢，缺的是"只用键盘的视力正常用户看不到文字标签"。要补齐就得把 tooltip
  改成受控（`isOpen` + 自己管 hover/focus 和延迟），代价不小，目前选择不补。

### HeroUI 3 和 Mantine 的心智模型差异

如果你从 Mantine 那套过来，几件事要重新习惯：

- **没有 `HeroUIProvider`。** HeroUI 3 建在 react-aria-components 上，各关注点是独立
  provider（routing / locale / toast queue），全在
  [AppProviders.tsx](src/components/providers/AppProviders.tsx) 里。
- **主题就是 CSS 变量，没有 JS 主题对象。** 语义角色（`accent` / `default` / `success` /
  `warning` / `danger`，各自带 `-foreground` 和 `-soft`）和表面层级（`surface` /
  `surface-secondary` / `surface-tertiary`）都是变量，`/dashboard` 那页把它们全摆出来了。
  改主题 = 改变量，不改组件。
- **组件普遍是复合组件，且没有尺寸 props。** 没有 `p="md"` 这种，排版一律 Tailwind 类。
  `<Switch>` 要写 `<Switch.Control><Switch.Thumb/></Switch.Control><Switch.Content/>`。
- **`Badge` 不是状态标签。** HeroUI 的 `Badge` 是带 `placement` 的角标；Mantine `Badge`
  的对应物是 **`Chip`**。
- **`Button` 是 `<button>`，不吃 `href`。** 要一个长得像按钮的链接，用 `buttonVariants()`
  把类名给 `Link`：见 [(app)/403/page.tsx](src/app/%5Blocale%5D/%28app%29/403/page.tsx)。
- **`Dropdown.Trigger` 包的是 react-aria 的裸 `Button`**，没有 `variant` / `isIconOnly`。
  要带样式的触发器就直接把 HeroUI 的 `<Button>` 放进 `<Dropdown>` ——它建在同一个 primitive 上，
  Dropdown 通过 context 照样找得到，见 [locale-switch.tsx](src/components/ui/locale-switch.tsx)。
- **事件是 `onPress` 不是 `onClick`**（react-aria 的约定，覆盖鼠标/触摸/键盘）。
- **`RouterProvider` 是接线点。** 没有它，HeroUI/react-aria 组件上的 `href` 就是普通 `<a>`，
  点一下整页刷新。

### 表单：`validationBehavior="aria"` 是必需的

react-aria 的 `<Form>` 默认 `validationBehavior="native"`，于是**浏览器会先拦下提交**——
一个格式不对的 `<input type="email">` 根本不会触发 submit，react-hook-form 的 resolver 不跑，
zod 的报错也就永远不出现。用 react-hook-form 管校验时，在 `<Form>` 上写一次
`validationBehavior="aria"`，下面的字段都会继承：

```tsx
<Form onSubmit={handleSubmit(onSubmit)} validationBehavior="aria">
  <TextField isInvalid={!!errors.email}>
    <Label>…</Label>
    <InputGroup>
      <InputGroup.Prefix><Mail /></InputGroup.Prefix>
      <InputGroup.Input {...register('email')} />
    </InputGroup>
    <FieldError>{errors.email?.message}</FieldError>
  </TextField>
</Form>
```

字段里塞图标用 `InputGroup`（它自己管聚焦环），不要绝对定位一个 icon 上去。

### 明暗主题

`<html class="light|dark">`，由 **next-themes** 的阻塞脚本在首屏 paint 前写好。

- 为什么不用 HeroUI 自带的 `useTheme()`：它在 layout effect 里才应用主题，
  偏好深色的用户会先看到一帧浅色。next-themes 往 `<head>` 注入同步脚本，没有这个问题。
- `class` 而不是 `data-theme`：HeroUI 的变量块选择器正好是 `.light` / `.dark`。
- **`<html>` 上的 `suppressHydrationWarning` 不能删。** 那个脚本在 React hydrate 之前就
  改了 class，服务端标记和 DOM 本来就不一致。
- 三态（跟随系统 / 浅色 / 深色）走 `useColorMode()`，`/settings` 页是用法示例。

#### next-themes 打了一个 patch

`package.json` 的 `patchedDependencies` 里给 `next-themes@0.4.6` 打了
[patches/next-themes@0.4.6.patch](patches/next-themes@0.4.6.patch)。**这是本仓库唯一的
依赖 patch**，改动很小，但没有文档没人敢删，所以记在这里。

上游 issue：[pacocoursey/next-themes#397](https://github.com/pacocoursey/next-themes/issues/397)
（2026-08-18 提，**截至写下这行时仍是 open**）。那个 issue 描述的场景和本项目一模一样：
next-intl 要求根 layout 落在 `[locale]` 动态段里，切换 locale 的客户端导航会让
`ThemeProvider` 子树在客户端 remount，React 19.2 于是报错。

patch 做的事（`dist/index.js` 和 `dist/index.mjs` 各改一处，改的是压缩产物）：给内部那个
memo 化的 `ThemeScript` 组件加一个模块级标志 `themeScriptHasMounted`，在它的 `useEffect`
里置为 `true`；此后的每次渲染返回 `null` 而不是 `<script>` 元素。

- 服务端渲染时 `useEffect` 不执行，标志恒为 `false`，所以 SSR 输出里**照样有**那段阻塞脚本
  ——首屏不闪的效果不受影响。
- 客户端首次渲染（hydration）时标志还是 `false`，渲染出的 `<script>` 和 SSR 标记一致，
  hydration 不会 mismatch。
- 之后标志变成 `true`，任何**客户端重新渲染**都不再产出 script 元素。

为什么需要它：`app/[locale]/layout.tsx` 是根 layout，`<head>` 在它手里。任何在客户端重新
渲染到根 layout 的操作（比如 `LoginForm` 登录成功后的 `router.refresh()`）都会让 React
重新渲染 `ThemeScript`。**React 不会执行自己在客户端创建的 `<script>`**，只会在控制台打一条
`Encountered a script tag while rendering React component`。这条警告是 dev-only，且脚本此时
不执行也无害（主题已经由 `ThemeProvider` 的 effect 接管了），但它会稳定地污染开发时的控制台，
而且信息是误导性的——看到的人会以为主题脚本坏了。

同一个机制也是 [`locale-switch.tsx`](src/components/ui/locale-switch.tsx) 里注释的那件事，
不过语言切换用整页刷新绕开了它，见[语言切换为什么是整页刷新](#语言切换为什么是整页刷新)。

**什么时候可以删掉这个 patch：** 先看
[#397](https://github.com/pacocoursey/next-themes/issues/397) 是否已关闭并发版。升级
next-themes 之后，把 `patchedDependencies` 那一条和 `patches/` 目录删掉，`bun install`，
然后 `bun run dev` 登录一次（`router.refresh()` 那条路径），看控制台还有没有
`Encountered a script tag` 这条警告。没有就说明上游修了，patch 可以永久移除。

> patch 改的是压缩后的 `dist/`，所以 **next-themes 一升级 patch 必然失效**（`bun install`
> 会直接报 patch 应用失败）。这是好事——它强制你在升级时重新走一遍上面那个验证步骤，而不是
> 让一个陈旧的 patch 静默留在树里。

## 认证

Auth.js（next-auth 5 beta）+ `@auth/drizzle-adapter`，一个 id 为 `phone-otp` 的 Credentials
provider + JWT session。手机号+验证码登录本身就是注册——第一次验证通过的号码会当场建号
（[src/core/auth/otp.ts](src/core/auth/otp.ts) 的 `findOrCreateUserByPhone()`），没有单独的
注册页。

- **表是自己定义后传给 adapter 的**，因为 `usersTable` 多一个 `phone` 列；不传的话
  adapter 会自己造一份和我们冲突的 `user` 定义。`email` 列留着（虽然 phone-otp 不用它）——
  adapter 的 `DefaultSQLiteUsersTable` 契约需要它，将来接 OAuth（比如登录页上那个还没接的
  微信按钮）也用得上。
- `session.strategy` 必须是 `'jwt'`：Credentials provider 只支持 JWT session。别动。
- **验证码是写死的演示常量，不是真的短信验证。** `src/core/auth/otp.ts` 没有接任何短信厂商，
  `authorize()` 直接把提交的验证码和 `src/core/auth/schema.ts` 里的 `DEMO_VERIFICATION_CODE`
  （`123456`）比对。这和 `core/mailer/send.ts`（没配 `RESEND_API_KEY` 就 `logger.warn` 不发信）、
  `core/storage/local-stub.ts`（写本地磁盘的占位实现）是同一套"诚实的 stub"约定——能跑、
  文档里写清楚是占位、留一个明确的替换点，不是伪装成真的。真要接短信厂商：把 `otp.ts` 换成
  真的随机码生成 + 存进一张新表（带过期时间）+ 真的发短信,同时把 `LoginForm.tsx` 里
  "获取验证码"按钮从纯客户端倒计时换成调一个 Server Action。
- `DEMO_VERIFICATION_CODE` 单独放在 `core/auth/schema.ts` 而不是 `otp.ts`：`otp.ts` 会
  `import { db }`,而 `LoginForm.tsx` 是 Client Component,要在按下"获取验证码"时把这个常量
  显示在 toast 里。Client Component 导入任何一条最终会 `import` 到 `core/db/client.ts`
  的链路,都会把 `@libsql/client`（连着 `node:fs`）一起打进浏览器 bundle,Turbopack 会直接
  报 `does not support external modules (request: node:fs)` 构建失败。`schema.ts` 只有
  `zod`,没有这个问题。
- 加一种登录方式：只改 `src/core/auth/config.ts` 的 `providers`，OAuth 的账号关联由 adapter 处理。

### 路由守卫在哪，管到哪

**唯一的守卫在 [(app)/layout.tsx](src/app/%5Blocale%5D/%28app%29/layout.tsx)**：`await auth()`，
没 session 就 `redirect({ href: '/login', locale })`。

- **`src/proxy.ts` 故意不管登录态**：把 `auth()` 拉进 proxy 会把数据库驱动和 Auth.js adapter
  一起拖进那个 bundle。
- **layout 守卫覆盖不到 `src/app/api/`** —— Route Handler 不跑 layout。所以那里**每个 handler
  仍然自己 `await auth()` 判 401**。`e2e/auth.e2e.ts` 对这两道防线分别有断言。
- 登录成功后 `router.refresh()` 要在 `router.push()` **之前**：守卫是在服务端读 session 的，
  不先刷新就可能落到一个"还没登录"的旧渲染上，被弹回 `/login`。

## 国际化

中英双语，`zh` 是默认语言也是文案的**源语言**（`en.json` 是它的翻译）。

```
src/i18n/
├── routing.ts          # locales / defaultLocale / localePrefix
├── request.ts          # 按 locale 加载 messages，校验非法 locale
├── navigation.ts       # locale 感知的 Link / redirect / usePathname / useRouter
└── messages/
    ├── zh.json         # 源语言
    ├── zh.d.json.ts    # 自动生成，进版本库，别手改
    └── en.json
```

**URL 策略是 `as-needed`**：默认语言不带前缀，其他语言带。

| 页面 | 中文 | 英文 |
| --- | --- | --- |
| 概览 | `/dashboard` | `/en/dashboard` |
| 笔记 | `/notes` | `/en/notes` |

`/zh/dashboard` 会 307 重定向到 `/dashboard`。`localeDetection` 是开启的，所以英文浏览器
首次访问 `/` 会被送去 `/en`——不想要这个行为就在 `routing.ts` 里设 `localeDetection: false`。
SEO 的 `alternateLinks` 响应头由 next-intl 默认开启，不用手写 `alternates.languages`。

几条规矩：

- **`Link` / `usePathname` / `useRouter` / `redirect` 一律从 `@/i18n/navigation` 导入**，
  不要从 `next/link` 或 `next/navigation` 拿——那两个不认语言前缀。例外是 `useLinkStatus`，
  它没有 locale 概念，继续从 `next/link` 导入（`AppShell.tsx` 就是这么混用的）。
  next-intl 的 `usePathname()` 返回的是**不带前缀**的路径，所以拿它和 `/dashboard` 这种
  常量比较是对的。
- **Server Component 用 `getTranslations()`，Client Component 用 `useTranslations()`。**
  前者要 await。
- **文案里的 `<code>` 之类标签用 `t.rich()`**，不要拼 HTML 字符串，
  见 `[locale]/(app)/dashboard/page.tsx` 的 `description`。
- **数字参数写成 `{value, number}`** 而不是 `{value}`：后者的类型会被推成 `string`，
  传 number 进去过不了 typecheck，而且也拿不到本地化的数字格式。
- **`t()` 的 key 是类型安全的。** `next.config.ts` 里的 `createMessagesDeclaration` 会由
  `zh.json` 生成 `zh.d.json.ts`，`src/types/messages.d.ts` 把它接到 `AppConfig.Messages` 上，
  写错 key 会在 `bun run typecheck` 挂掉。生成的文件**必须提交**——它只在 `next dev` / `next build`
  时写出来，CI 的 typecheck 不触发生成，忽略掉就会让 CI 挂。

加一条文案：改 `zh.json` → 同步 `en.json` → 跑一次 `bun run build`（或 `dev`）让声明文件更新
→ 在组件里 `t('...')`。

### 语言切换为什么是整页刷新

[locale-switch.tsx](src/components/ui/locale-switch.tsx) 用 `window.location.assign()` 而不是
next-intl 的 `router.replace()`，有两个原因，改回软导航就会各自复现：

1. **切换语言是全应用唯一跨 `[locale]` 段的导航。** 软导航会让 `app/[locale]/layout.tsx` 在客户端
   重新渲染，而它持有 `<html>` 和 `<head>`——里面有 next-themes 注入的主题脚本。React 不会执行
   自己在客户端创建的 `<script>`，只在控制台打一条
   *"Encountered a script tag while rendering React component"*（仅开发构建，但脚本确实被跳过了），
   于是明暗主题会一直没设置到下一次硬加载。
2. **必须带 `forcePrefix`。** `localePrefix` 是 `as-needed`，所以裸的 `/settings` 是有歧义的，proxy
   会拿 `NEXT_LOCALE` cookie 去判断——而那时 cookie 还是**旧** locale，于是又被弹回去。导航到显式的
   `/zh/settings` 能让 proxy 改写 cookie 并自己把 URL 规范化成 `/settings`。next-intl 的 router 是靠
   导航前先写 cookie 做到这件事的；交给 proxy 可以不重复一个在 `routing.ts` 里可配置的 cookie 名。

代价是切换后要重新 hydrate，那一小段时间里 rail 是不可交互的——`e2e/i18n.e2e.ts` 里对应的那次点击
因此包了一层 `toPass()` 重试。

普通页面跳转不受影响：`Link` 默认沿用当前 locale，不跨段，仍然是软导航。

## 编码规范

### 格式化和 lint 全部交给 Biome

tab 缩进、单引号、JSX 用双引号、分号按需。**不要手动调格式**，写完跑：

```bash
bun run lint:fix     # 修 lint + 格式化 + 排 import
```

⚠️ `biome.json` 是标准 JSON，**不支持注释**。加了注释配置会静默解析失败并退回 Biome 默认设置
（双引号、带分号），`--write` 一跑就会把全项目格式反着改一遍。

`biome.json` 里 `css.parser.tailwindDirectives: true` 不能删：没有它，Biome 的 CSS 解析器
不认 `@source` / `@theme`，`globals.css` 会报解析错误而且不被格式化。

import 顺序也是 Biome 自动排的，分组顺序：`bun:`/`node:` → 第三方包 → `@/` 别名 → 相对路径 → 样式。
项目内引用**统一用 `@/` 绝对路径**（`@/*` 映射到 `src/`）。

### 命名

跟着现有文件走，不要另起一套：

- 组件文件 PascalCase：`AppShell.tsx`、`LoginHero.tsx`、`LoginForm.tsx`
- hooks / 工具 / 非组件模块 kebab-case：`color-mode.tsx`、`locale-switch.tsx`、`notes-service.ts`
- 数据库表变量带 `Table` 后缀：`usersTable`、`notesTable`

### TypeScript

- `strict: true`，不要 `any`。
- 类型尽量**推导而不是手写**：入参类型从 Zod schema 推、表行类型用 `$inferSelect`
  （`import type { Note } from '@/core/db/schema'`），service 的返回值让它自己推。
- **Zod 的 `.default()` 会让 input / output 类型不一样**，react-hook-form 要写三个泛型参数：
  `useForm<CreateNoteValues, unknown, CreateNoteInput>`。`src/features/notes/schema.ts` 把两个
  类型都导出了就是为这件事。
- 页面/布局的 props 用 Next 生成的 `PageProps<'/路径'>` / `LayoutProps<'/路径'>`，注意路径要带
  locale 段，例如 `LayoutProps<'/[locale]'>`。改了路由结构记得重跑 `bun run typecheck`
  （它会先 `next typegen`）。

### Server / Client 组件

- `'use client'` 只加在真正需要 state、事件、浏览器 API 的**叶子组件**上，别往上蔓延到页面。
  `login/page.tsx` 是范例：页面是 Server Component，`'use client'` 只在 `LoginForm` 上。

### 样式

优先级：**Tailwind utility → HeroUI 语义变量 → `globals.css`**。

- 颜色一律走语义 token（`bg-surface` / `text-muted` / `border-border` / `bg-accent-soft` …），
  **不要写死 `#fff` / `#000`**，也不要用 Tailwind 的调色板（`bg-gray-100`）——那些不跟明暗切换。
- `globals.css` 里该写什么，见[什么该写进 globals.css](#什么该写进-globalscss)——
  能用 Tailwind utility 表达的就不要写进去。
- 字体栈里必须带中文回退（`PingFang SC` / `Microsoft YaHei` / `Songti SC` / `Noto Serif SC`），
  Roboto、Georgia 这些都没有 CJK 字形——`@theme` 里的 `--font-sans` / `--font-serif` 就是为这件事。

### 注释

写**为什么**，不写是什么。仓库里现有的注释都是这个风格——记录踩过的坑、选了这个方案的原因、
以及"看起来可以简化但不能简化"的地方。别写 `// 设置标题` 这种复述代码的注释。

## 测试

三层，分三个脚本：

| 脚本 | 跑什么 | 有没有 DOM |
| --- | --- | --- |
| `bun run test:unit` | `src/core` 下的 `*.test.ts`（错误契约、service、数据层） | 没有（`--preload ./test/unit-setup.ts`） |
| `bun run test:dom` | `src/components` / `src/features` 下的组件测试 | 有（`--preload ./test/setup.ts`） |
| `bun run test` | 上面两个依次跑 | |
| `bun run test:e2e` | Playwright | 真浏览器 |

### 为什么必须拆成两个脚本

**happy-dom 一注册，全局就有了 `window`，`@t3-oss/env-nextjs` 于是认为自己在客户端，
访问服务端变量直接抛错。** 所以 DOM 只能给需要它的那批测试开，不能放在 `bunfig.toml` 的全局
`preload` 里（试过，`src/core` 的测试立刻全挂）。

约定因此是**按目录分**：碰 `@/core/env` 的测试放 `src/core/`，需要 DOM 的测试放在组件旁边
（`src/components/` 或 `src/features/`）。

### 组件测试

`test/setup.ts` 里有两个坑，都踩过：

1. **`GlobalRegistrator.register()` 在 happy-dom 20 里是异步的。** 不 `await` 就等于没注册，
   所有查询报 "a global document has to be available"。
2. **`@testing-library/jest-dom` 必须在注册之后再 import**，所以那里用的是动态 `import()`。

还有一个：**这个文件只能靠 `--preload` 加载，不能在测试文件里 import。**
`@testing-library/dom` 在自己被 import 的那一刻就抓住了 `document.body`，静态 import 的顺序
保证不了它在注册之后。

[LoginForm.test.tsx](src/features/auth/components/LoginForm.test.tsx) 是范例：用
`mock.module()` 换掉 `next-auth/react` 和 `@/i18n/navigation`，但**文案用真的 `zh.json`
配 `NextIntlClientProvider`**——这样改错 message key 会让测试挂，而不是静默渲染出 key 名。

### 单测（`src/core/`）

在 `:memory:` 上跑，所以没有建库/删库的开销。**`DATABASE_URL` 由
[test/unit-setup.ts](test/unit-setup.ts) 通过 `--preload` 设置**，不要指望在测试文件里设：

```ts
// test/unit-setup.ts —— test:unit 脚本 --preload 它
process.env.DATABASE_URL = ':memory:'
```

为什么只有 preload 才行，这个坑值得完整记一次：

`core/env.ts` 在**模块作用域**校验 `process.env`，消费方读的是那个冻结的 `env` 对象——
`core/db/client.ts` 打开的是 `env.DATABASE_URL`。于是**进程里第一个 import 到
`@/core/env` 的模块就替所有后续测试定了 `DATABASE_URL`**。而 `core/logger.ts` 就 import
它，`core/action.ts`、`core/http.ts` 又 import logger……也就是说一个压根不碰数据库的测试
文件（比如 `core/http.test.ts`）也会顺手把 env 冻住。`bun test` 又是**所有文件跑在一个
进程里**，谁先谁后取决于目录遍历顺序。

所以在某个测试文件顶部写 `process.env.DATABASE_URL = ':memory:'` 是不够的：只要**别的**
文件先加载了 `core/logger.ts`，这句就已经晚了。**症状还特别阴**——那一轮测试跑在
`./data/dev.db` 上，看起来全绿，然后**下一轮**因为上一轮留下的数据撞 UNIQUE 约束而失败。
（这就是本项目真实发生过的事，加 `core/http.test.ts` 的时候暴露出来的。）

preload 在任何测试文件求值之前运行，是唯一有保证的时机。`otp.test.ts` 和
`notes-service.test.ts` 顶部仍然各留了一句同样的赋值 + 动态 import，那是为了**单独跑
这一个文件**（不带 preload）时也不会碰到开发库的兜底，不是主机制。

跑完可以验一下开发库确实没被动过：

```bash
stat -f %m data/dev.db && bun run test:unit && stat -f %m data/dev.db   # 两个 mtime 应该相同
```

### E2E

`(app)` 组要求登录，所以用 Playwright 的 setup project 模式：

- `e2e/auth.setup.ts` 用 seed 账号登录一次，把 storageState 存到 `e2e/.auth/user.json`（gitignore）
- `desktop` project `dependencies: ['setup']` 并复用那个 storageState，所以业务用例不用各自登录
- 要测未登录状态就在 describe 上 `test.use({ storageState: { cookies: [], origins: [] } })`，
  见 `e2e/auth.e2e.ts`
- 文件名必须 `*.e2e.ts`（Bun 的 test runner 会 glob `*.spec.ts`，两个 runner 的 `test()`
  全局变量会打架，所以约定用这个后缀区分）
- **接口的错误契约在 `e2e/api-errors.e2e.ts` 里断言**，用 Playwright 的 `request` fixture 直接
  打接口。`core/http.test.ts` 只能证明 `withHandler` 本身对，证明不了
  `app/api/notes/` 真的接上了它——那里面每一个状态码在包装器出现之前都是 500
- **`e2e/observability.e2e.ts` 守请求 id 链路和健康检查。** 这两样没法单测：整件事的前提是
  `src/proxy.ts` 真的在跑，而 proxy 只存在于一个运行中的 Next 服务里
- **`e2e/security.e2e.ts` 守 CSP 和限流。** 单测只能断言 header 的**值**，断言不了浏览器在这个
  策略下还愿不愿意跑这个应用——而 CSP 失败是安静的：页面照样加载，某个脚本或样式悄悄没生效，
  什么都不抛。所以那里有专门收集控制台 CSP 违规、并断言为空的用例
- 浏览器语言在 `playwright.config.ts` 里锁成了 `zh-CN`，所以不带前缀的 URL 断言拿到的是中文；
  要测英文就显式访问 `/en/...`

两个 react-aria 相关的断言技巧：

- **checkbox / switch 的点击要落在可见元素上。** react-aria 把真正的 `<input>` 放在它自己的
  装饰下面，Playwright 会报 "control intercepts pointer events"。断言用
  `getByRole('checkbox')`，点击用 `[data-slot="checkbox-content"]`，见 `e2e/notes.e2e.ts`。
- **`getByRole('alert')` 会撞上 Next 自己的 route announcer**（它也是 `role="alert"`），
  按文案断言。

## 新增业务的标准流程

以加一个 `tasks` 域为例，按顺序走：

### 1. 建表

在 `src/core/db/schema.ts` 里加一个 `tasksTable`，照 `notesTable` 的形状（`text('id').primaryKey()`
配 `$defaultFn(crypto.randomUUID)`、`references(() => usersTable.id, { onDelete: 'cascade' })`、
时间戳用 `integer({ mode: 'timestamp' })`、按 `userId` 建 `index`）。

> 注意 auth 那几张表的时间戳是 `timestamp_ms`——那是 adapter 写死的，别去"统一"它。

```bash
bun run db:generate    # 生成迁移 SQL 到 drizzle/
bun run db:migrate     # 应用
```

生成的 SQL **要进版本库**，不要手改。开发早期想省掉迁移文件可以用 `bun run db:push` 直接同步。

### 2. 写 service

`src/core/services/tasks-service.ts`。第一个参数一律 `userId`，每个语句的 `where` 都带上它。
这一层是纯函数集合，不碰 `Request` / `cookies()` / session——那些是调用方的事。

**要报错就抛 `core/errors.ts` 里的类型化错误**，不要 `throw new Error('...')`：找不到行抛
`NotFoundError`，撞唯一约束抛 `ConflictError`（带上 `fields`）。暴露层靠 `code` 把它翻译成
`ActionResult` 或 HTTP 状态码，见[错误处理](#错误处理)。

### 3. 补单测

`src/core/services/tasks-service.test.ts`，照 `notes-service.test.ts` 的套路：**动态
`await import()`** 业务模块，然后 `runMigrations()`。`DATABASE_URL` 已经由
`test/unit-setup.ts` 的 preload 顶成 `:memory:` 了，见[单测](#单测srccore)。别忘了那条越权用例。

### 4. 定义校验 schema

`src/features/tasks/schema.ts`，一份 Zod schema 给表单和接口共用。用了 `.default()` 就把
input / output 两个类型都导出（见 [TypeScript](#typescript)）。

### 5. 选一条暴露方式

默认只要 Server Action：`src/features/tasks/actions.ts` 里一个 `export async function`，
函数体就一个 `runAction({ name, schema, input, handler })`。会话校验、schema 解析、错误映射、
日志都在 `runAction` 里，handler 只写"创建一个 task"这件事本身。表单提交、增删改、客户端搜索、
乐观更新——只要消费者是这个 Next.js 应用自己，都走这条。完整写法和三个细节见
[错误处理](#错误处理)。

要在客户端做输入即搜或乐观更新，**读也走 Server Action**：把 `listTasksAction` 直接当 SWR 的
fetcher，在 fetcher 里把 `ActionResult` 拆开（失败就 `throw`，这样 SWR 自己的错误处理和
`rollbackOnError` 才有东西可用）。`NoteList` 是完整范例。

只有真的要给应用之外的消费者用（第三方调用方、移动端、webhook 接收端）才另外写 Route Handler：
`src/app/api/tasks/route.ts`，用 `withHandler` 包起来，body 走 `readJson`、动态段走
`readParams`；key 加到 `src/features/tasks/swr-keys.ts`。

两者可以同时存在，但不要仅仅因为"要在客户端触发"就选第二条——那种场景第一条也能做到，见
[分层与依赖方向](#分层与依赖方向)的暴露方式优先级。要过网络就加一个 `dto.ts`，见
[DTO 为什么必需](#dto-为什么必需)。

> `revalidatePath()` 要传**路由模式**而不是具体 URL：页面在 `[locale]` 下，所以是
> `revalidatePath('/[locale]/tasks', 'page')`。写成 `'/tasks'` 不会命中任何路由。

### 6. 加页面

`src/app/[locale]/(app)/tasks/page.tsx`（要 rail 和登录拦截就放 `(app)` 组，公开的全屏页放
`(auth)` 组或自己新建一组）。拷 `settings/page.tsx` 当起点最省事，要带表单和列表就拷 `notes/`。
需要在 rail 上露出入口，就去 `src/components/layout/NavLinks.ts` 加一条
`{ href, labelKey, icon }`，并在 `zh.json` / `en.json` 的 `Nav` namespace 里补上对应 key。

### 7. 加 E2E

`e2e/tasks.e2e.ts`。登录态已经由 setup project 给好了，直接 `page.goto('/tasks')`。

### 几个更短的路径

- **只加一个静态页面**：第 6 步 + 第 7 步就够了。
- **只加/改文案**：改 `zh.json` + `en.json`，跑一次 build 让声明文件更新。
- **加一门语言**：`src/i18n/routing.ts` 的 `locales` 加一项、加 `messages/<locale>.json`、
  在 `src/types/messages.d.ts` 的 `Locale` 联合类型里加上、`Locale` namespace 里补语言名。
- **加一种登录方式**：只改 `src/core/auth/config.ts` 的 `providers`。
- **加环境变量**：必须同时改三处——`.env.example`、`src/core/env.ts` 的 `server` 和 `runtimeEnv`
  （两个都要写，漏一个读到 undefined）、必要时 `.github/workflows/ci.yml` 的 `env`。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 开发服务器（3000 端口） |
| `bun run build` / `start` | 生产构建 / 启动 |
| `bun run lint` | Biome 检查（CI 跑这个） |
| `bun run lint:fix` | 自动修 + 格式化 + 排 import |
| `bun run typecheck` | `next typegen && tsc --noEmit` |
| `bun run test` | `test:unit` + `test:dom` |
| `bun run test:unit` / `test:dom` | `src/core` 单测 / 组件测试，见[测试](#测试) |
| `bun run test:e2e` | Playwright |
| `bun run db:generate` | `drizzle-kit generate` —— **生成迁移 SQL** |
| `bun run db:migrate` | 应用迁移 |
| `bun run db:push` | 不留迁移文件，直接把 schema 同步到库（开发期用） |
| `bun run db:reset` | ⚠️ 删库文件 + 重放迁移 + seed |
| `bun run db:seed` | 插入 demo 数据 |
| `bun run db:studio` | Drizzle 的可视化库浏览器 |

三个坑：

- **`bun run db:reset` 会删掉 `DATABASE_URL` 指向的那个文件**，没有二次确认，也没有 Prisma
  那种针对 AI agent 的危险操作防护。
- **`bun run test:e2e` 第一步就是 `db:reset`**，但 `playwright.config.ts` 的 `webServer.env`
  把 `DATABASE_URL` 指到了 `./data/e2e.db`，所以它**不会**碰你的开发库。
  改那个配置的时候留意这一点。
- 改了路由目录结构后 `typecheck` 可能报找不到旧路径的模块——那是 `.next/` 里的旧 typegen 缓存，
  `rm -rf .next` 再跑。

## 环境变量

本地把 `.env.example` 拷成 `.env.local`，填上 `AUTH_SECRET`（`openssl rand -base64 32`）。

| 变量 | 必填 | 默认 | 用途 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 否 | `./data/dev.db` | SQLite **文件路径**（不是 URL）。`:memory:` 也认 |
| `AUTH_SECRET` | **是** | — | Auth.js 签 JWT，缺了直接启动失败 |
| `AUTH_URL` | 否（**生产应设**） | — | 本部署的规范 origin。不设时 Auth.js 从 `Host` 头推导回调 URL，见[安全](#安全)。缺失时 `register()` 会打启动告警 |
| `LOG_LEVEL` | 否 | `info` | pino 级别 |
| `RESEND_API_KEY` | 否 | — | 不填时 `sendEmail()` 只打 warn 不发信 |
| `EMAIL_FROM` | 否 | `onboarding@resend.dev` | 发件地址。默认是 Resend 的共享测试发件人，**只能发给 API key 所属的那个邮箱**，上线前换成自有已验证域名的地址 |

`NODE_ENV` 在 `src/core/env.ts` 的 schema 里（决定 pino 是否启用 pretty 输出），但**不在
`.env.example` 里**：这个变量该由框架和运行环境决定（`next dev` 给 `development`、
`next build` / `next start` 给 `production`），手写进 `.env.local` 只会带来把
`NODE_ENV=development` 一路 copy 到生产的风险。

运行时版本：包管理和脚本用 Bun（`packageManager` 已 pin 到 `bun@1.3.3`），但 `next start`
跑在 **Node** 上，所以 `engines` 和 `.nvmrc` 另外声明了 Node 版本（Next 16 要求
`>=20.9.0`）。

CI（`.github/workflows/ci.yml`）四个并行 job：`lint` / `typecheck` / `test` / `e2e`。
**没有数据库 service**——单测跑在 `:memory:`，e2e 自己建文件库。

## 已知遗留与缺口

按需要处理的优先级排：

1. **手机验证码是固定演示码，没有接真实短信厂商。** `src/core/auth/otp.ts` 不生成、不存储、
   不发送任何验证码——`authorize()` 直接比对 `DEMO_VERIFICATION_CODE`（`123456`）。真要上线
   之前必须换掉，见[认证](#认证)一节。
2. **限流器的状态在进程内存里。** 登录已经限流了（见[安全](#安全)），但两个实例各放行一份
   配额，Serverless 上等于没限流。单实例部署够用，更大的部署要保留 `RateLimiter` 接口换成
   Redis/Upstash。另外**只有登录被限流**——换成真 OTP 后，发码接口也必须限，否则被刷等于
   直接的短信账单。
3. **`onRequestError` 只写日志，没有接错误上报服务。** 形状是对的，但生产环境应该换成
   Sentry / OTel，见[可观测性](#可观测性)。`register()` 目前只做 `AUTH_URL` 启动检查，
   没有 tracing。
4. **错误边界没有常驻的自动化测试。** 渲染出来的部分由
   [ErrorState.test.tsx](src/components/ui/ErrorState.test.tsx) 覆盖，但"边界有没有真的接上"
   要靠一条故意抛错的路由，模板里不想常留这种东西。改完 `error.tsx` 之后照下面这样验一次
   （两个 `error.tsx` 都是这么验过的）：

   ```bash
   # 1. 目录名不能以下划线开头——那是 Next 的 private folder 约定，整个目录不进路由
   mkdir -p 'src/app/[locale]/boomprobe' 'src/app/[locale]/(app)/boomprobeapp'
   for d in 'src/app/[locale]/boomprobe' 'src/app/[locale]/(app)/boomprobeapp'; do
   echo 'export default async function Boom() { throw new Error("probe") }' > "$d/page.tsx"
   done
   # 2. 用 /en/ 前缀访问。顶层就是 [locale] 动态段，所以 /boomprobe 会被当成
   #    locale="boomprobe"，被 layout 的 hasLocale() 判成 404；localePrefix 是
   #    'as-needed'，只有非默认语言会保留前缀。
   bun run dev   # 然后开 /en/boomprobe 和 /en/boomprobeapp
   # 3. 验完删掉这两个目录
   ```

   要确认的四件事：错误 UI 出来了；`(app)` 那条**左侧 rail 还在**（嵌套边界的意义就在这）；
   生产构建（`bun run build && bun run start`）下**真实的错误消息不出现在页面上**，只有
   `digest`；点"重试"能重新渲染。

   `global-error.tsx` 要触发得让 `[locale]/layout.tsx` 自己抛错，代价比较大，一般改完它
   肉眼过一遍就行。
5. **`src/core/storage/local-stub.ts` 只是占位**，写本地磁盘。真要用文件存储就照 `StorageAdapter`
   接口换成 S3/R2 实现。
6. **403 页没有任何地方会跳转过去。** 登录拦截解决的是"未登录"（弹到 `/login`），而项目里还没有
   角色模型，所以没有"已登录但无权限"这种情况。加了角色判断之后，service 抛 `ForbiddenError`
   （`core/errors.ts` 里已经有了），让页面 `redirect('/403')`。
   > 另一条路是 Next 的 `forbidden()` / `unauthorized()` 加 `forbidden.tsx` /
   > `unauthorized.tsx`，能顺手填掉这个缺口。**本项目刻意没走这条**：它需要打开
   > `experimental.authInterrupts`，模板不想依赖实验性 API；而且它靠抛中断工作，会被
   > `runAction` / `withHandler` 的 try/catch 影响（要靠 `unstable_rethrow` 放行）。
7. **`listNotes` 没有分页。** 一个 `select *` 全表返回。`notes` 是[标准流程](#新增业务的标准流程)
   会被照抄的模板，所以这条会传染到真实业务表上。另外搜索用的
   `like(lower(title), '%q%')` 没有转义用户输入里的 `%` / `_`（搜 `%` 匹配全部），
   而 `lower()` 也让索引失效。
8. **`notesTable` 只有 `createdAt`，没有 `updatedAt`**，也没有软删除。多数生产表需要前者
   （Drizzle 的 `$onUpdate`）。
9. **一个 `db.transaction()` 示例都没有**，[标准流程](#新增业务的标准流程)里也没提。真实业务
   （下单、扣库存）少不了它。
10. **登录页的微信按钮是禁用的占位。** 后端没有对应 provider，接法见
    `src/core/auth/config.ts` 的 `providers`。
11. **没有 `authenticator` 表。** `@auth/drizzle-adapter` 的 WebAuthn 方法会去查它，
    表不存在时那些方法运行时会炸。本模板不用 WebAuthn，所以没建；要用的话往
    `src/core/db/schema.ts` 里补一个，并把它传给 `DrizzleAdapter`。
12. **英文文案是从中文翻译来的占位内容**，dashboard 和登录页左侧插画那些都是展示用的样例文字，
    不是真实业务文案。
13. **`/dashboard` 和 `/notes` 都是给你删的。** 前者是设计系统活文档，后者是业务示例。

### 主动放弃的东西（不是缺口）

- **多主题切换器和 Material ripple**。姊妹模板 `next-template` 有 Notion / Material 2 /
  Material 3 三套主题可以运行时切换，那建立在 Mantine 的 JS 主题对象和 per-component `styles`
  API 上。HeroUI 3 的主题是 CSS 变量，做法完全不同，这里只保留默认主题 + 明暗两色。
  要加第二套主题：在 `globals.css` 里写一组 `[data-theme='x']:not(.dark)` /
  `[data-theme='x'].dark` 变量块（`:not(.dark)` / `.dark` 是为了压过 HeroUI 自己那份，
  两者特异性相同、靠源码顺序分不出胜负），再自己管一个 cookie。
- **SQLite 的并发写入能力**。单文件数据库适合单实例部署；要多实例或高写入量，
  把 `DATABASE_URL` 换成 Turso 连接串（libsql 驱动本来就支持），或者换回 Postgres
  （改 `schema.ts` 的 import、`drizzle.config.ts` 的 dialect、以及 client 的驱动）。
