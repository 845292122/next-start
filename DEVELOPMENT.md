# 项目技术文档

一个全栈 Next.js 模板：App Router + Mantine + Drizzle/SQLite + Auth.js，包管理和运行时都用 Bun。

> ⚠️ 动手之前先看 [AGENTS.md](AGENTS.md)：这个仓库用的 Next.js 版本有 breaking changes，API 和约定
> 可能和你记忆里的不一样。写代码前查 `node_modules/next/dist/docs/` 里对应的文档。

## 目录

- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [分层与依赖方向](#分层与依赖方向)
- [数据层](#数据层)
  - [查询一律有界，读写不变量用事务](#查询一律有界读写不变量用事务)
- [错误处理](#错误处理)
- [可观测性](#可观测性)
- [安全](#安全)
- [UI 与主题](#ui-与主题)
  - [什么该写进 globals.css](#什么该写进-globalscss)
- [认证](#认证)
  - [多端认证:一个验证核心,两种传输](#多端认证一个验证核心两种传输)
- [SEO 与元数据](#seo-与元数据)
  - [两个实际踩到的坑](#两个实际踩到的坑)
- [编码规范](#编码规范)
- [测试](#测试)
- [新增业务的标准流程](#新增业务的标准流程)
- [常用命令](#常用命令)
- [工程化关卡](#工程化关卡)
- [部署](#部署)
- [环境变量](#环境变量)
- [已知遗留与缺口](#已知遗留与缺口)

---

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 运行时 / 包管理 | Bun 1.3.3 | `bun install` / `bun run`，测试也用 Bun 自带的 runner |
| 框架 | Next.js 16.3.1 | App Router，Server Components 默认 |
| UI | Mantine 9.5.1 | 组件自带尺寸/间距 props；主题是一个 TS 对象 |
| 样式 | CSS Modules + `postcss-preset-mantine` | **没有 Tailwind**，也没有任何 utility class |
| 图标 | `@tabler/icons-react` | Mantine 官方文档、demo 和大部分官方模板默认用的就是这套（两者同一个作者）；纯 forwardRef SVG,没有 context/hooks,Server/Client Component 都能直接 import,不需要单独的 `/ssr` 入口 |
| 数据库 | SQLite | 单文件，无需服务或容器；驱动是 `@libsql/client` |
| ORM / 迁移 | Drizzle 0.45 + drizzle-kit 0.31 | schema 就是 TS，迁移 SQL 进版本库 |
| 认证 | Auth.js（next-auth 5 beta） | Credentials provider + JWT session + `@auth/drizzle-adapter` |
| 表单 | `@mantine/form` | 用 `schemaResolver()` 直接吃 Zod schema（Standard Schema） |
| 校验 | Zod 4 | 表单、Route Handler、Server Action 共用同一份 schema |
| 客户端数据 | SWR 2.5 | 需要客户端搜索/轮询/乐观更新时用 |
| 明暗主题 | Mantine 自带 | `<ColorSchemeScript>` 是阻塞脚本，首屏不闪 |
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
├── layout.tsx          # 根布局，所有渲染 HTML 的路由都在它下面
├── error.tsx           # (app) 之外的错误边界（登录页、404 兜底……）
├── (app)/              # 已登录区：带左侧导航栏（rail），layout 里有登录拦截
│   ├── layout.tsx      # 校验 session + 套一层 <AppShell>
│   ├── error.tsx       # 错误边界，渲染在 rail 里面
│   ├── loading.tsx     # Suspense fallback，同样在 rail 里面
│   ├── page.tsx        # 即 "/"，307 跳到 /dashboard
│   ├── dashboard/      # 设计系统的活文档页
│   ├── notes/          # 完整业务示例
│   ├── settings/       # 占位页，新页面可以拷这个开头
│   └── 403/            # 无权限页
├── (auth)/             # 全屏区：不带 rail，也不要求登录
│   └── login/
├── not-found.tsx       # 本段抛 notFound() 时渲染
├── [...rest]/          # 未匹配 URL 的兜底，只调 notFound()
├── api/                # Route Handlers
│   ├── auth/[...nextauth]/
│   ├── health/         # 健康检查（不鉴权），见[可观测性](#可观测性)
│   ├── v1/             # 只认 Bearer 的对外 API（小程序/App）
│   │   ├── auth/wechat/    # 唯一不鉴权的 v1 路由：换 token
│   │   └── notes/
│   └── notes/          # 外部消费者路径的示例，应用自己不调
├── robots.ts           # /robots.txt（按 origin）
├── sitemap.ts          # /sitemap.xml
├── manifest.ts         # /manifest.webmanifest
├── global-error.tsx    # 根布局自己炸掉时的最后兜底，零 import
├── favicon.ico
└── globals.css         # 文档级全局 CSS，不是唯一样式入口，见[UI 与主题](#ui-与主题)
```

约定与注意：

- **括号目录是路由组，不进 URL。** `(app)/dashboard/page.tsx` 对应 `/dashboard`。分组的意义是
  让两组页面用不同的 layout——`(app)` 有 rail 且要求登录，`(auth)` 都没有。
- **根布局是 [src/app/layout.tsx](src/app/layout.tsx)。** 它干三件事：`await auth()` 拿
  session 传给 Provider、给 `<html>` 摊上 `mantineHtmlProps`（里面就是
  `data-mantine-color-scheme="light"` 和 `suppressHydrationWarning`，见
  [UI 与主题](#ui-与主题)）并在 `<head>` 里渲染 `<ColorSchemeScript>`。
  它是动态渲染的（读了 session），别指望这一层有静态优化。
- **`[...rest]/page.tsx` 不能删。** 实测过：没有它，未匹配的路径会去找 Next 内置的 404，
  而不是我们自己的 `not-found.tsx`——这不是某个特定路由段的怪癖，是这个版本 Next 的普遍行为，
  删掉它 `e2e/shell.e2e.ts` 的 404 用例会当场挂。
- **`not-found.tsx` 故意不套 `AppShell`。** 套了就要有 session，而 404 对未登录访客也得能渲染。
- **三个错误边界是三个不同的位置，不是重复。** `error.tsx` 永远不包住**自己那一段的
  layout**，所以：`(app)/error.tsx` 渲染在 `AppShell` 里面（rail 还在，用户能导航走）；
  `app/error.tsx` 接住 (app) 之外的页面，以及 `(app)/layout.tsx` 自己抛的错；
  `global-error.tsx` 接住 `app/layout.tsx` 自己抛的错，此时连 `<html>` 都得它自己渲染。
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
├── providers/  # 全局 Provider（AppProviders.tsx）+ Mantine 主题（theme.ts / css-variables-resolver.ts / mantine-overrides.css）
└── ui/         # 通用小部件：BlackHoleMark / ButtonLink / ErrorState / LoginHero / color-mode / sign-out-button
```

规则：**这里不写业务逻辑，也不碰数据库。** 只依赖 props、Mantine 和 session。要用到某个业务域的
东西，说明它该放 `features/`。

- [src/components/layout/NavLinks.ts](src/components/layout/NavLinks.ts)：rail 的导航项清单，
  加页面要来这里加一条。
- [src/components/ui/color-mode.tsx](src/components/ui/color-mode.tsx)：`useColorMode()` 的
  公开 API（`colorMode` / `mode` / `setMode` / `toggleColorMode`）和姊妹模板保持一致，
  内部换成了 Mantine 的 `useMantineColorScheme` + `useComputedColorScheme`，所以调用方的代码
  可以互搬。
- [src/components/ui/ButtonLink.tsx](src/components/ui/ButtonLink.tsx)：一个 `'use client'` 的
  薄壳，就为了 `<Button component={Link}>`。**Server Component 里写不了这一句**，且跟
  `Link` 是哪个库的无关：把一个组件*引用*当成 prop 值（而不是当 JSX 用）传给 Client
  Component，等于把一个函数塞进 props，RSC 序列化不了函数（除非标了 `'use server'`），报
  "Functions cannot be passed directly to Client Components"。实测验证过——直接在
  `(app)/403/page.tsx` 里写 `<Button component={Link} href="/">`（`Link` 来自
  `next/link`）复现同一个错误。403 / 404 两个页面因此走这个壳。

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
├── site-url.ts         # 绝对 URL 的唯一来源，见 [SEO](#seo-与元数据)
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
│   ├── migrate-cli.ts  # 给纯 Node 环境（Docker 运行时）打包用的独立入口
│   ├── seed.ts         # demo 用户（手机号 13800000000）+ 两条笔记
│   └── reset.ts        # db:reset 的实现
├── auth/
│   ├── config.ts       # Auth.js 配置：adapter、providers、callbacks
│   ├── index.ts        # 导出 handlers / auth / signIn / signOut
│   ├── schema.ts       # phoneOtpSchema + 固定演示码常量，config 和登录表单共用
│   ├── session.ts      # getRequiredSession() / getRequiredBearerSession()
│   ├── verify.ts       # 一个验证核心 + 两种传输，见[多端认证](#多端认证一个验证核心两种传输)
│   ├── wechat.ts       # 小程序登录的诚实占位(jscode2session)
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
| `src/proxy.ts` | Next 16 的中间件（旧名 `middleware.ts`）。**注入 `x-request-id` + 每请求 CSP nonce，不管登录态**。Next 16 起默认跑 Node runtime |
| `src/instrumentation.ts` | `onRequestError`：接住渲染期异常，把 digest 和真实堆栈写在一起，见[可观测性](#可观测性) |
| `src/lib/` | 不属于某个业务域的通用工具：目前只有 `action-error.ts`（把 `ActionResult` 的 `code` 翻成文案，见[错误处理](#错误处理)） |
| `e2e/` | Playwright 用例，文件名必须是 `*.e2e.ts`；`auth.setup.ts` 是登录态的来源 |
| `test/setup.ts` | happy-dom + jest-dom 注册。**只由 `test:dom` 脚本 `--preload`**，见[测试](#测试) |
| `test/unit-setup.ts` | 把 `DATABASE_URL` 顶成 `:memory:`。**只由 `test:unit` 脚本 `--preload`**，见[测试](#测试) |
| `biome.json` | 格式化 + lint + import 排序规则 |
| `playwright.config.ts` | E2E 配置：setup project + `webServer` 跑 db:reset → build → start |
| `postcss.config.mjs` | `postcss-preset-mantine` + `postcss-simple-vars`（断点变量），见[UI 与主题](#ui-与主题) |
| `next.config.ts` | `serverExternalPackages`（libsql 的原生模块不能打包）+ 固定安全响应头 |
| `Dockerfile` / `.dockerignore` | 单实例生产镜像，见[部署](#部署)。**未构建验证过** |
| `bunfig.toml` | 只有 `[test]` 的覆盖率配置。**别在这里加全局 `preload`**，见[测试](#测试) |
| `lefthook.yml` | Git 钩子（pre-commit 格式化 + commit-msg 校验），见[工程化关卡](#工程化关卡) |
| `renovate.json` | 依赖升级分组策略，同上 |
| `AGENTS.md` / `CLAUDE.md` | 给 AI 助手的项目说明。那段 Next.js 提示是 `next dev` 自动写入的，别手删 |

## 分层与依赖方向

```
src/app/ (路由、页面)
  ├─→ src/features/<域>/   业务域的 schema / actions / dto / 专属组件
  │      └─→ src/core/     服务端能力
  ├─→ src/components/      通用展示层（不依赖 core）
  └─→ src/core/            页面也可以直接调 service
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
  能共用一个值。libsql 需要 scheme，`client.ts` 里的 `toLibsqlUrl()` 负责补 `file:`。
  `src/core/env.ts` 因此用 `z.string()` 校验它，不是 `z.url()`。
- **`:memory:` 会被换成 `file::memory:?cache=shared`，这一步不能省。** 裸的内存库是
  **单连接私有**的，而 `@libsql/client` 会为 `db.transaction()` **另开一个连接**。结果是：
  任何针对 `:memory:` 的事务都看到一个空库，事务结束后连原来的连接都用不了了——实测
  一个只提交、什么都不写的事务就足以触发，之后每条查询都报 `no such table`。
  单测跑在内存库上、生产跑在文件上，所以不换的话**事务在这个项目里根本没法测**。
  共享缓存的 URI 正是 SQLite 给这个问题的答案：一个进程内共用的内存库。
  `notes-service.test.ts` 里有一条用例（"a rollback leaves the schema usable"）守它。
- **外键默认是开的——但只是因为用了 libsql。** 裸 SQLite（和 `better-sqlite3`）默认关闭外键，
  而且这个设置是**每个连接**一次的。`client.ts` 里没写 `PRAGMA foreign_keys = ON` 是验证过的
  结论，不是漏了。换驱动的话必须加回来，否则 `onDelete: 'cascade'` 全部静默失效。
- **没有 `ilike`，而且 `LIKE` 的通配符必须自己转义。** 两件事一起处理，见
  `notes-service.ts` 的 `listNotes`：
  - 裸 `LIKE` 只对 ASCII 大小写无关，还受列 collation 影响，所以显式套 `lower()`。
    代价是这个表达式**用不上索引**，等于扫这个用户的行——数据量大的域应该换 SQLite 的 FTS5。
  - 用户输入里的 `%` 和 `_` 是通配符。不转义的话搜 `%` 匹配全部、`_` 匹配任意单字符。
    这不是注入（drizzle 会参数化），但搜索框会静默地不按用户说的做。
    **SQLite 默认没有转义字符**，必须显式写 `ESCAPE`；而 drizzle 的 `like()` 只接受
    `(column, pattern)` 两个参数，挂不上 `ESCAPE` 子句，所以那里是手写的 `sql` 模板。
    转义反斜杠本身要放在最前面，否则会把它二次转义。

  `notes-service.test.ts` 有三条用例分别守大小写、`%`、`_` 和字面反斜杠。
- **时间戳有两种单位，别混。** auth 那三张表的 `emailVerified` / `expires` 必须是
  `integer({ mode: 'timestamp_ms' })`——`@auth/drizzle-adapter` 写死了毫秒。我们自己的
  `note.createdAt` 用 `integer({ mode: 'timestamp' })`（秒），配 `default(sql\`(unixepoch())\`)`。
  单位搞错不会报错，只会把时间算到 1970 年。
- **`.returning()` 要配 `await`。** 不 await 拿到的是查询构造器，
  `const [x] = db.insert(...).returning()` 会抛 "not iterable"。
- **单写者模型。** SQLite 的写操作串行化在一个写者上，所以持有写锁的事务是**阻塞**其他写者，
  而不是和它们死锁。推论：事务要短，绝对不要在事务里 `await` 无关的东西（比如一个 HTTP 调用）。

### 查询一律有界，读写不变量用事务

`notes` 是[标准流程](#新增业务的标准流程)会被逐字照抄的模板，所以这两条写在 service 层，
不在调用方。

**分页。** `listNotes` 返回 `{ items, total, limit, offset }`，永远有界：

- 默认 20 条（`NOTES_PAGE_SIZE`），硬上限 100（服务内部常量）。
- **`limit` 在 service 里再夹一次**，即使暴露层的 zod 已经校验过。schema 保护的是那一个入口，
  service 要对**所有**调用方安全，包括将来的服务端调用方。有用例断言 `limit: 1_000_000`
  会被夹到 100。
- `total` 是**符合同一过滤条件的总数**，不是本页条数——调用方靠它判断还有没有更多。
- UI 走的是"加宽窗口"而不是翻页：`NoteList` 只增大 `limit`。这样每个
  `(query, limit)` 只有一个 SWR 缓存项，下面的乐观更新只需要修补一份列表。
  要做页码式分页就传 `offset`，action 和接口都已经支持。
- 索引跟着查询走：`note_userId_createdAt_idx` 是复合索引，等值列在前、排序列在后，
  所以分页不用排整张表。

**事务。** `createNote` 是模板里的事务示例，而它需要事务的原因是**配额检查**：
先 count 再 insert 是两条语句，没有事务的话两个并发请求可以都读到 499、都插入成功。
这个"先读后写"的形状正是事务存在的意义，也是绝大多数真实不变量的形状（库存、余额、占座）。

在回调里 throw 就会回滚（drizzle 发 `ROLLBACK`），所以配额拒绝不会留下半个写入。
配额值（500）是随便定的，**它启用的那个检查才是重点**。

> 抄这段之前先读 [SQLite 的几个坑](#sqlite-的几个坑)里关于 `:memory:` 和单写者的两条——
> 事务在这个技术栈上有两个非显然的前提。

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

`fields` 字段带的是**出错的字段名，不带文案**。项目里的 schema 一律不写人话文案
（原因见 [core/auth/schema.ts](src/core/auth/schema.ts)），zod 自带的消息又是英文，
所以客户端拿字段名去查自己的中文文案表。空数组会被基类归一化成 `undefined`，因此
"`fields` 存在"永远意味着"确实能归到这些字段"。

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
      revalidatePath('/notes', 'page')
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
  不用手写一份会漂移的副本。和 layout 里的 `LayoutProps<'/'>` 是同一套东西。
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
        setError(field, { message: FIELD_MESSAGE[field] })
      }
    }
    return
  }
  toast.danger(getActionErrorMessage(result))
  return
}
```

两点值得说明：

- **服务端的 `VALIDATION` 是纵深防御，不是日常路径。** 同一份 schema 已经在客户端由
  `zodResolver` 跑过了，所以走到这里意味着请求被改过或者 schema 漂移了。
- **字段文案是查一个 `FIELD_MESSAGE` 字面量表，不是 `errors.title?.message`。** 后者是
  zod 自带的英文串。按"哪个字段错了"取文案，和 `LoginForm` 一致。

### 三个错误边界

| 文件 | 接住什么 | 渲染在哪 |
| --- | --- | --- |
| `app/(app)/error.tsx` | (app) 组里页面抛的错 | `AppShell` **里面**——rail 还在，用户能导航走 |
| `app/error.tsx` | (app) 之外的页面，**以及 `(app)/layout.tsx` 自己抛的错** | 整个 `<body>` 内 |
| `app/global-error.tsx` | `app/layout.tsx` 自己抛的错 | 它自己的 `<html>` / `<body>` |

规则来自 Next：**`error.tsx` 不包住自己那一段的 layout**，所以每往上一层就少一层可用的东西。

- **签名是 `{ error, retry }`。** Next 16 改的名，`retry` 从 16.3 起稳定。`retry()` 会重新
  取数据并重渲染边界的 children；老的 `reset()` 只清错误状态，不重新取。
- **`app/error.tsx` 和 `(app)/error.tsx` 传的是硬编码中文字面量**，不是从某个 provider 读的
  文案——两者共用 [ErrorState](src/components/ui/ErrorState.tsx)，两个文件的差别只是它渲染在哪。
- **`global-error.tsx` 什么都 import 不了，这是刻意的。** 它替换掉根布局，所以：得自己渲染
  `<html>`/`<body>`；不能 `export metadata`（错误边界是 Client Component，用 React 的
  `<title>` 代替）；**拿不到全局样式**，因为 `<ColorSchemeScript>` 和它写的
  `data-mantine-color-scheme` 都属于刚刚炸掉的那个 layout。更重要的是，这是应用坏掉时唯一还要工作的页面——每一个
  import 都是它跟着一起坏掉的途径，所以它用内联 `<style>` 和硬编码文案，一个 import 都没有。
- **`digest` 值得露出来。** 生产环境下真实消息只在服务端日志里，客户端只有这个 hash——它是
  用户能拿来报障的唯一线索。

### `loading.tsx` 带来的一条无害日志

`app/(app)/loading.tsx` 给这一组加了 Suspense 边界，于是这些页面变成**流式响应**。
代价是：客户端在响应还没发完时就离开（任何硬导航——关标签页、手动改地址栏——都能触发），
服务端会打一条

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

> proxy 里的写法有个关键点：**先改 `request.headers`，再用它构造 `NextResponse.next({
> request: { headers: request.headers } })`**。这是 Next 官方支持的、往下游渲染层加**请求**
> 头的唯一方式；反过来，先造好 response 再往它身上加请求头是做不到的，除非动 Next 内部的
> `x-middleware-override-headers` 协议。这条链路有 e2e 守着（`e2e/observability.e2e.ts`）。

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

**Mantine 大量用 `style` 属性而不是 class 来定位**：floating-ui 给每个 Popover / Tooltip /
Menu 写内联 `style`，`Progress` 的宽度、`Slider` 的填充、每个 `Transition` 也一样。
**nonce 永远管不到属性**——nonce 是元素的属性，不是声明的属性——所以再怎么接线都盖不住这一片。

而 CSP 规范堵死了那个显而易见的绕法：**一个 directive 里只要出现 nonce 或 hash，
`'unsafe-inline'` 就会被忽略。** 所以 `style-src` 做不到"我们的 `<style>` 用 nonce、内联属性用
unsafe-inline"——在同一个 directive 里只能二选一。

于是只有三条路，本项目选了第三条：

1. **只用 nonce** → 所有内联 `style` 属性被拒。浮层全部堆在左上角，slider 没有填充。
   响很大，但也彻底不能用。
2. **`style-src 'nonce-…'` + 单独的 `style-src-attr 'unsafe-inline'`** → 能正常渲染的最严方案
   （`style-src-attr` 是独立 directive，有自己的白名单）。它栽在另一类内联样式上：
   `react-remove-scroll`（Mantine 的依赖，`Modal` / `Drawer` 用它锁滚动）在浏览器里创建
   `<style>` 元素，它的 nonce 只能来自 `get-nonce` 的模块级 `setNonce()`，而 Mantine 从不调用
   ——于是那个元素被拒，症状是弹窗打开时背景还能滚，很容易漏掉。
3. **样式放开 `'unsafe-inline'`** → 现在的做法。注入的 CSS 能污染页面、能通过选择器外泄一些
   属性值，但**不能执行脚本**。在 `script-src` 保持严格的前提下，这是更小的风险，而且不会腐烂。

顺带一提，`MantineProvider` 还是接了 `getStyleNonce`（见
[AppProviders.tsx](src/components/providers/AppProviders.tsx)），让**我们自己控制的**那一个
`<style>`（主题的 CSS 变量）带上 nonce。在上面的策略下它不产生任何效果，存在的意义是：哪天要收紧
`style-src`，改动只在 `security-headers.ts` 一行。

`e2e/security.e2e.ts` 断言生产策略下**零** CSP 违规，所以哪天需要重新审视，测试会先说话。

### 两个必须手工接线的 nonce 消费者

Next 会自动把 nonce 打到它**自己**生成的东西上（框架脚本、页面 chunk、它自己的内联样式）。
它不认识的就得自己接：

- **Mantine 的 `<ColorSchemeScript>`。** `app/layout.tsx` 读 `x-nonce` 直接传给它的
  `nonce` prop（同一个值也给 `MantineProvider` 的 `getStyleNonce`）。接错了的症状恰恰是这个脚本
  被放进来要解决的那个问题：首屏闪一帧错误的配色。`e2e/security.e2e.ts` 有一条用例断言
  `<html>` 上的 `data-mantine-color-scheme` 是 `light|dark`，就是守这个。
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

### 主题是三个文件，各管一层

[src/components/providers/](src/components/providers/) 下：

| 文件 | 是什么 | 改什么去这里 |
| --- | --- | --- |
| [theme.ts](src/components/providers/theme.ts) | `createTheme()` 的返回值，纯 TS 对象 | 调色板、间距/字号/圆角刻度、每个组件的 `.extend()`（`vars` / `styles` / `defaultProps`） |
| [css-variables-resolver.ts](src/components/providers/css-variables-resolver.ts) | `CSSVariablesResolver` 函数 | `createTheme()` 管不到的 CSS 变量——按明暗分开的语义变量（`--mantine-color-dimmed`、`--mantine-color-text` 之类），以及本项目自己的 token（`--app-font-serif`） |
| [mantine-overrides.css](src/components/providers/mantine-overrides.css) | 纯 CSS，选择器打在 Mantine 自己的类名上（`.mantine-Button-root` 等） | `.extend()` 的 `vars` / `styles` 到不了的地方——`:hover` / `:checked` / `::after` 这类伪类和状态组合 |

三者在 [AppProviders.tsx](src/components/providers/AppProviders.tsx) 里接成
`<MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>`；
`mantine-overrides.css` 是普通 CSS 文件，和 Mantine 自己的两份 `styles.css` 一起在
[layout.tsx](src/app/layout.tsx) 里按顺序 import——**顺序是硬约束**（晚导入的覆盖
早导入的），细节看那个文件顶部的注释。

**没有 utility class 层，也没有 Tailwind。** 组件排版用 Mantine 的 style props
（`<Stack gap="md">`、`<Text c="dimmed">`），组件私有样式用 CSS Modules
（`AppShell.module.css`、`BlackHoleMark.module.css`）。

### 什么该写进 globals.css

几乎没有——[globals.css](src/app/globals.css) 现在只有一条规则
（`html, body { height: 100% }`），而且它必须留在文档级：`100%` 高度的子孙元素要一路追到
`<html>` / `<body>` 才能解析成具体像素，这条链路没法下放到某个组件的 CSS Module 里。

判断一条规则该不该进 `globals.css` 的标准很简单：**它是不是在描述某个具体组件？** 是的话
就该进那个组件自己的 CSS Module，或者如果是所有实例共享的行为/配色，进 `theme.ts` 的
`.extend()` 或 `mantine-overrides.css`（见上一节）。`globals.css` 只留给真正"跟哪个组件都
无关，纯粹是文档本身的"规则。

### `mantine-overrides.css` 的一个坑：`alpha()` 不是 CSS 函数

`@mantine/core` 导出一个叫 `alpha()` 的 JS helper（`alpha('var(--x)', 0.5)` 在 JS 里算出
一个颜色字符串），但**CSS 里没有这个函数**。照着那份写法直接搬进 `.css` 文件
（`background-color: alpha(var(--x), 0.5)`）时，浏览器会把这条声明当成非法值**静默丢弃**——
不报错、控制台也不警告，症状只是"这条规则看起来没生效"。CSS 里要做同样的事得用原生的
`color-mix(in srgb, var(--x) 50%, transparent)`。

### 字体：CJK 回退写在 `theme.ts` 里

`theme.ts` 里的 `FONT_FAMILY_SANS` / `FONT_FAMILY_MONOSPACE`（`css-variables-resolver.ts`
里对应的是 `FONT_FAMILY_SERIF`）都在基础字体后面手动接了一串中文回退（`PingFang SC` /
`Microsoft YaHei` / `Songti SC` / `Noto Serif SC`）。**必须手动接**：UI 是中文，而这些基础
字体（不管是 `Geist` 还是 `Georgia`）都没有 CJK 字形，缺了回退就是整段中文文字静默掉回浏览器
默认字体——换字体前肉眼根本不会注意到。`--app-font-serif` 是本项目自己加的 token（登录页大
标题、`LoginForm` 用），不属于 vendor 主题本身，改 `css-variables-resolver.ts` 时容易漏掉。

### 对比度：用 axe 量，不用眼睛量

现在这套主题（含 21 个 Tailwind 风格的调色板）是整份搬进来的，Mantine 默认调色板和
`primaryShade` 都不是它的出发点，所以旧主题量出来的对比度数字全部作废。真正在用的方法是跑
[e2e/a11y.e2e.ts](e2e/a11y.e2e.ts)（axe），看它指认哪个具体元素不达标，再改那一个颜色的
映射——不要提前手算 21 个颜色 × 好几个 variant 的对比度，没被哪个页面渲染到的组合就没法验证，
也就不该预先改。具体测出来的三处修法见[工程化关卡](#工程化关卡)。

### 明暗主题

`data-mantine-color-scheme="light"|"dark"`（属性，不是 class），由 Mantine 的
`<ColorSchemeScript defaultColorScheme="auto">` 在首屏 paint 前写好——这一行在
[layout.tsx](src/app/layout.tsx) 的 `<head>` 里，`nonce` 要手动接，见
[两个必须手工接线的 nonce 消费者](#两个必须手工接线的-nonce-消费者)。

- `<html {...mantineHtmlProps}>` 静态写了 `data-mantine-color-scheme="light"` 和
  `suppressHydrationWarning`——前者保证没 JS 时也是有样式的浅色页面，后者是因为
  `<ColorSchemeScript>` 会在 hydrate 前改掉这个属性，服务端标记和 DOM 本来就不一致。
- `defaultColorScheme="auto"` 要同时给 `<ColorSchemeScript>` 和 `<MantineProvider>`——两处
  必须一致，不一致就是先出一帧错的配色再纠正。
- 三态（跟随系统 / 浅色 / 深色）走 [useColorMode()](src/components/ui/color-mode.tsx)：对外
  API 和姊妹模板保持一致（`colorMode` / `mode` / `setMode` / `toggleColorMode`），内部是
  Mantine 的 `useMantineColorScheme` + `useComputedColorScheme('light')` 的一层薄封装，不是
  翻译层。`/settings` 页是用法示例。

### 表单：`@mantine/form` 直接吃 Zod schema

[LoginForm.tsx](src/features/auth/components/LoginForm.tsx) 是范例：

```tsx
const resolvePhoneOtp = schemaResolver(phoneOtpSchema, { sync: true })
const form = useForm({ validate: resolvePhoneOtp, ... })
```

`schemaResolver()` 直接吃 Zod schema（Standard Schema）。`{ sync: true }` 让
`form.validate()` 同步返回结果而不是 Promise——这点在"发送验证码"那一步很关键：按钮要在同一
个事件循环里决定是否开始倒计时。字段报错信息不能来自 schema 本身（`core/auth/schema.ts`
故意不带任何本地化文案，zod 产出的是不可翻译的英文串），所以按字段名查一个 `FIELD_MESSAGE`
字面量表，而不是拼字符串——`Record<keyof PhoneOtp, string>` 的类型标注保证了每个字段都有
对应文案，漏一个 `bun run typecheck` 就会报错。

### 侧边栏 rail 的一个坑

[AppShell.tsx](src/components/layout/AppShell.tsx)：

- **导航项只有图标，文字进 `aria-label`。** 可访问名和从前有可见文字时一样，所以
  `getByRole('link', { name: '设置' })` 那些 e2e 断言不受影响——改这里时别把 `aria-label`
  弄丢。
- `Tooltip` 直接包 `ActionIcon`，本身不是坑——**这是一个曾经的坑被修好之后的样子**，值得记住
  为什么：Mantine 的 `Tooltip` 把 ref 和事件处理器 clone 到子元素上，而不是外面套一个可聚焦
  容器，所以每个导航项只有一个 tab 停靠点，键盘聚焦也会触发 tooltip。旧版本（另一套 UI 库）的
  `Tooltip` 会多套一层 `role="button"`，`e2e/a11y.e2e.ts` 顶部的注释记着这件事——现在没有任何
  规则被禁用，保持这样。

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

**唯一的守卫在 [(app)/layout.tsx](src/app/(app)/layout.tsx)**：`await auth()`，
没 session 就 `redirect('/login')`。

- **`src/proxy.ts` 故意不管登录态**：把 `auth()` 拉进 proxy 会把数据库驱动和 Auth.js adapter
  一起拖进那个 bundle。
- **layout 守卫覆盖不到 `src/app/api/`** —— Route Handler 不跑 layout。所以那里**每个 handler
  仍然自己 `await auth()` 判 401**。`e2e/auth.e2e.ts` 对这两道防线分别有断言。
- 登录成功后 `router.refresh()` 要在 `router.push()` **之前**：守卫是在服务端读 session 的，
  不先刷新就可能落到一个"还没登录"的旧渲染上，被弹回 `/login`。

### 多端认证:一个验证核心,两种传输

浏览器和微信小程序没法用同一种方式携带会话,而差别**只在凭据存在哪里**:

| 客户端 | 传输 | 为什么 |
| --- | --- | --- |
| 浏览器 | httpOnly cookie | JS 读不到,XSS 偷不走;`SameSite=Lax` 是[安全](#安全)那节 CSRF 论证的前提 |
| 小程序 / 原生 App | `Authorization: Bearer` | `wx.request` 没有可靠的 cookie jar |

[core/auth/verify.ts](src/core/auth/verify.ts) 就是这条界线:

```
sessionFromCookie()          → auth()           ← 浏览器
sessionFromBearer(request)   → decode(JWE)      ← 小程序 / App
requireSession(session)      → UnauthorizedError ← 共用的那一半
```

**分界到这里就停了。** 两条传输都产出 `Session`,而 `core/services/` 永远不知道用的是哪条——
它只收 `userId`。加第三个端是加一个 `sessionFrom*`,service 层一行不改。

#### 为什么两条传输**不能**合并

写一个"cookie 和 header 都试一遍"的函数会更短。**别这么做。** 同时接受两者的路由重新
打开了 CSRF 面:浏览器会自动带上 cookie,于是一个跨站表单提交就能在 Bearer 端点上完成认证。
分开之后每个表面的安全论证都独立且简单:

- Server Actions 和 `/api/notes` → **只认 cookie**
- `/api/v1/*` → **只认 Bearer**,所以它**天生**没有 CSRF 面

`e2e/api-v1.e2e.ts` 里那条 `refuses a cookie-authenticated request` 就是守这个的——它跑在
**已登录**的 storageState 下,所以请求确实带着 cookie,401 才有意义。**那个文件里其余的用例
在有人"顺手"加上 cookie 回退之后依然会通过,只有这一条会红。**

#### token 的几个取舍

- **用 Auth.js 自己的 `encode`/`decode`**,不手搓 JWT:已经是依赖、产出的是加密(JWE)而非
  仅签名的 token、密钥从 `AUTH_SECRET` 派生——不用管第二个 secret。
- **salt 是我们自己的常量**(`api-v1-bearer`)。cookie 会话和 Bearer token 共用
  `AUTH_SECRET`,不同的 salt 才能阻止其中一个被当作另一个重放。有用例守这条。
- ⚠️ **没有 refresh token,也没有吊销名单。** 签出去的 token 到期前一直有效;轮转
  `AUTH_SECRET` 会一次性作废全部,这是目前唯一的吊销手段。做模板可以,**要"退出这一台设备"
  就不行**。

#### 微信小程序这一侧

[core/auth/wechat.ts](src/core/auth/wechat.ts) 是和 `otp.ts` 同样的**诚实占位**:
`WECHAT_APPID` / `WECHAT_SECRET` 不设时它**不调微信**,而是从 code 派生一个确定性的假 openid——
所以整条链路(签 token → 带着它调 `/api/v1` → 读到按 userId 隔离的数据)没有凭据也能端到端跑通,
`e2e/api-v1.e2e.ts` 正是靠这个。

真接的时候四件事要对,占位教不了你:

1. **微信用 HTTP 200 返回错误。** 判 `errcode`,不要判 status。`40029` 是 code 失效,
   映射成 401 而不是 500。**这是最容易搞错的一条**,所以它有单测(用注入的凭据 + 打桩的
   `fetch`,不联网)。
2. **code 一次性,约 5 分钟过期。** 不要缓存、不要重试。
3. **`session_key` 绝不下发**,而且每次 `wx.login()` 都轮转。要用(解密手机号、签名校验)
   就单独建表存,见 `usersTable.openid` 的注释。
4. **`unionid` 只有开放平台账号才有。** 有的话应该拿它做账号主键,这样同一个人在你的多个
   应用里是一个用户。

手机号是**另一个接口**(`getPhoneNumber` 给客户端一个 code,你在服务端换),**不复用
`otp.ts` 那条手机号登录路径**。它的配额和收费政策变过几次,查最新文档,别照抄任何二手说法。

> 凭据是**注入**的而不是 mock `@/core/env`:bun 的 `mock.module` 是进程级的,在一个测试文件里
> mock env 会静默改掉整轮的 `DATABASE_URL` 和 `LOG_LEVEL`——这个坑这个仓库已经踩过一次
> (见 `test/unit-setup.ts`)。参数不会泄漏。

#### 两个表面的对照

| | `/api/notes` | `/api/v1/notes` |
| --- | --- | --- |
| 传输 | cookie | **只有 Bearer** |
| 消费者 | cookie 型 handler 的示例 | 微信小程序 / 原生 App |
| CSRF | 靠 `SameSite=Lax` + 预检 | **结构上就没有** |
| 版本化 | 无 | `/api/v1`,从第一个端点就有 |

**`/api/v1` 从第一天就带版本前缀。** 小程序是灰度发布的,老版本会继续调老形状一段时间,
所以你需要一个能放 v2 而不破坏它们的地方。现在只花一个路径段,事后再加很痛。

## SEO 与元数据

绝对 URL 全部从 `APP_URL` 派生，收在 [src/core/site-url.ts](src/core/site-url.ts)，
这样 metadata、sitemap、robots.txt 不会对"这个站叫什么"产生分歧。

**这一块的每种错法都是静默的**：缺 `metadataBase` 不会报错，只会把 localhost 发布出去。
所以 [e2e/seo.e2e.ts](e2e/seo.e2e.ts) 和 [core/site-url.test.ts](src/core/site-url.test.ts)
把这些都钉住了。

### 两个实际踩到的坑

**`robots.txt` / `sitemap.xml` 默认是静态生成的，会把构建时的 `APP_URL` 烤死。**
实测发现的：`APP_URL=https://example.test bun run start` 之后页面的 canonical 是对的
（页面是动态渲染），但 `robots.txt` 里还是 `http://localhost:3000`——因为它在构建时就
渲染完了，而构建时没有 `APP_URL`。一个镜像部署到两个域名的话两边都是错的。
所以这两个文件都加了 `export const dynamic = 'force-dynamic'`，代价是两个很少被请求的
小文本响应。

**sitemap 现在是空的，这是对的。** 本模板没有任何可被爬取的公开页面：`/` 是 307 跳到
`/dashboard`（见 `(app)/page.tsx`），整个 `(app)` 组要登录，`/login` 和 `/403` 在
robots.txt 里被 disallow。一开始 `PUBLIC_PATHS` 里放了 `/`，
e2e 的"每个列出的 URL 都不能重定向"当场把它抓出来了。所以交付的是**接好线并测过的机制**，
里面暂时没有内容——有公开页面之后往 `PUBLIC_PATHS` 加。

## 编码规范

### 格式化和 lint 全部交给 Biome

tab 缩进、单引号、JSX 用双引号、分号按需。**不要手动调格式**，写完跑：

```bash
bun run lint:fix     # 修 lint + 格式化 + 排 import
```

⚠️ `biome.json` 是标准 JSON，**不支持注释**。加了注释配置会静默解析失败并退回 Biome 默认设置
（双引号、带分号），`--write` 一跑就会把全项目格式反着改一遍。

`biome.json` 里 `css.parser.tailwindDirectives: true` 现在是死配置——项目里已经没有任何
`@source` / `@theme` / `@apply`，这个开关当初是为 Tailwind 加的。留不留都不影响
lint / format 的结果（验证过：关掉之后 `bun run lint` 输出完全一样），清理见
[已知遗留与缺口](#已知遗留与缺口)。

import 顺序也是 Biome 自动排的，分组顺序：`bun:`/`node:` → 第三方包 → `@/` 别名 → 相对路径 → 样式。
项目内引用**统一用 `@/` 绝对路径**（`@/*` 映射到 `src/`）。

### 命名

跟着现有文件走，不要另起一套：

- 组件文件 PascalCase：`AppShell.tsx`、`LoginHero.tsx`、`LoginForm.tsx`
- hooks / 工具 / 非组件模块 kebab-case：`color-mode.tsx`、`notes-service.ts`
- 数据库表变量带 `Table` 后缀：`usersTable`、`notesTable`

### TypeScript

- `strict: true`，不要 `any`。
- 类型尽量**推导而不是手写**：入参类型从 Zod schema 推、表行类型用 `$inferSelect`
  （`import type { Note } from '@/core/db/schema'`），service 的返回值让它自己推。
- **Zod 的 `.default()` 会让 input / output 类型不一样**——`z.input<typeof schema>` 是表单持有
  的那份（`body` 可以不填），`z.output<typeof schema>` 是解析后 service 收到的那份（`body`
  一定有值）。`useForm<CreateNoteValues>`（Mantine `@mantine/form`）用前者；
  `src/features/notes/schema.ts` 把两个类型都导出了就是为这件事。
- 页面/布局的 props 用 Next 生成的 `PageProps<'/路径'>` / `LayoutProps<'/路径'>`，路径要跟
  实际的路由结构完全一致，例如根布局是 `LayoutProps<'/'>`。改了路由结构记得重跑
  `bun run typecheck`（它会先 `next typegen`）。

### Server / Client 组件

- `'use client'` 只加在真正需要 state、事件、浏览器 API 的**叶子组件**上，别往上蔓延到页面。
  `login/page.tsx` 是范例：页面是 Server Component，`'use client'` 只在 `LoginForm` 上。

### 样式

优先级：**Mantine style props → `theme.ts` 的 `.extend()` → CSS Module →
`mantine-overrides.css` → `globals.css`**——越靠后越难改，也越该是最后手段。

- 颜色一律走 Mantine 的语义变量（`c="dimmed"`、`color="red"`、`var(--mantine-color-text)`
  这类），**不要写死 `#fff` / `#000`**——语义变量才会跟着明暗模式和 `theme.ts` 的调色板走。
- `globals.css` 里该写什么，见[什么该写进 globals.css](#什么该写进-globalscss)。
- 字体栈里必须带中文回退（`PingFang SC` / `Microsoft YaHei` / `Songti SC` / `Noto Serif SC`），
  基础字体（`Geist`、`Georgia`）都没有 CJK 字形——`theme.ts` / `css-variables-resolver.ts` 里的
  `FONT_FAMILY_*` 常量就是为这件事，见[UI 与主题](#ui-与主题)。

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
`mock.module()` 换掉 `next-auth/react` 和 `next/navigation`。断言直接查真实渲染出来的
中文字面量（`'手机号'`、`'登录'`……）——组件里的文案就是硬编码的，测试没有另一份来源要保持
同步。

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
- **`e2e/api-v1.e2e.ts` 守 Bearer 表面。** 其中 `refuses a cookie-authenticated request` 是整个
  文件存在的理由——它跑在已登录的 storageState 下,所以请求带着 cookie,401 才有意义
- **`e2e/a11y.e2e.ts` 用 axe 扫 5 个页面。** 它一次就扫出三个真问题，见[工程化关卡](#工程化关卡)
- **`e2e/seo.e2e.ts` 守 canonical / hreflang / robots / sitemap / manifest。** 这一块每种错法
  都是静默的，只有断言能发现
- **`e2e/security.e2e.ts` 守 CSP 和限流。** 单测只能断言 header 的**值**，断言不了浏览器在这个
  策略下还愿不愿意跑这个应用——而 CSP 失败是安静的：页面照样加载，某个脚本或样式悄悄没生效，
  什么都不抛。所以那里有专门收集控制台 CSP 违规、并断言为空的用例
- 浏览器语言在 `playwright.config.ts` 里锁成了 `zh-CN`，所以不带前缀的 URL 断言拿到的是中文；
  要测英文就显式访问 `/en/...`

一个断言技巧值得记：**`getByRole('alert')` 会撞上 Next 自己的 route announcer**
（它也是 `role="alert"`），按文案断言。（Mantine 的 `Checkbox` / `Switch` 直接给真实的
`<input>` 加样式，不像某些库把它藏在装饰元素下面——`getByRole('checkbox')` 之类可以直接点，
不用额外的 `data-slot` 选择器，见 `e2e/notes.e2e.ts`。）

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

**列表查询必须有界**，参数是 `{ query?, limit?, offset? }`，返回 `{ items, total }`，
并且在 service 里夹一次 `limit`——别信调用方传来的值。**先读后写的不变量用 `db.transaction()`**。
两者的完整理由和 SQLite 上的两个前提见[查询一律有界，读写不变量用事务](#查询一律有界读写不变量用事务)。

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

### 6. 加页面

`src/app/(app)/tasks/page.tsx`（要 rail 和登录拦截就放 `(app)` 组，公开的全屏页放
`(auth)` 组或自己新建一组）。拷 `settings/page.tsx` 当起点最省事，要带表单和列表就拷 `notes/`。
需要在 rail 上露出入口，就去 `src/components/layout/NavLinks.ts` 加一条
`{ href, label, icon }`——`label` 直接写中文字面量，不用另外查文案文件。

### 7. 加 E2E

`e2e/tasks.e2e.ts`。登录态已经由 setup project 给好了，直接 `page.goto('/tasks')`。

### 几个更短的路径

- **只加一个静态页面**：第 6 步 + 第 7 步就够了。
- **只加/改文案**：直接改组件里的中文字面量，不用同步任何其他文件。
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

## 工程化关卡

### 覆盖率:阈值定成 0.90,但要知道它在量什么

`bun run test:coverage` 跑单测并报覆盖率，阈值在 `bunfig.toml` 里。**只有传
`--coverage` 时才会强制**，所以 `test:unit` / `test:dom` 不受影响——验证过。

两条必须知道的：

- **Bun 的阈值是按文件强制的，不是按总体。** 这就是 `coveragePathIgnorePatterns` 存在的
  唯一原因。实测：整体是 ~98% funcs / ~98% lines，但全局 0.90 会失败，一路降到
  `0.70/0.60` 才变绿——而那个数字挡不住任何东西。被忽略的几个文件的"未覆盖"都是对的：
  `migrate.ts` 未覆盖的正是 `import.meta.main` 自跑块（它存在的意义就是"被 import 时不要
  跑"），`schema.ts` 未覆盖的是 drizzle 的 `$defaultFn` / `$onUpdate` 回调（那是数据不是逻辑，
  效果由 `notes-service.test.ts` 断言）。
- **这个百分比本身是偏高的。** 覆盖率只统计**被加载过**的文件，所以 `core/mailer/`、
  `core/storage/` 这些没有测试的文件压根不出现在报告里。它是防回归的棘轮，不是"我们测了多少"
  的答案。
- **推论:加一个测试可能让报告里的数字变低。** 加 `core/auth/verify.test.ts` 时就发生了——它
  import 了 `@/core/auth`，于是 `core/auth/config.ts` 和 `core/zod-config.ts` 第一次被加载、
  第一次出现在报告里，双双拖低总数并卡住了阈值。两者最后进了 ignore 列表，理由写在
  `bunfig.toml` 里。**看到数字掉了先想"是不是拉进来了新文件",而不是"是不是覆盖变差了"。**

### Git 钩子

[lefthook.yml](lefthook.yml)。钩子由 lefthook 的 postinstall 装进 `.git/hooks`，而那个
postinstall 能跑**只因为** `lefthook` 被列进了 `package.json` 的 `trustedDependencies`——
bun 默认屏蔽生命周期脚本，不加这一条 `bun install` 会静默地不装钩子。钩子没生效就手动跑
`bunx lefthook install`。

**pre-commit 只做快且确定的事**：Biome 的格式化和 lint，且只作用于 staged 文件。
不做 typecheck（要整个程序，好几秒）、不跑测试、不构建——那些在 CI。
一个要跑 30 秒的钩子会被 `--no-verify` 绕过，而一个经常被绕过的钩子比没有更糟：
它让人以为有东西在把关。

用 `--write` 而不是只检查：Biome 在这里的修复是确定性的、纯格式的，为了让人手动跑一遍同样
的命令而中断提交纯属摩擦。配 `stage_fixed: true`——没有它，修复只落在工作区，**提交进去的
还是没修的那份**。

`commit-msg` 校验 conventional commit 前缀。仓库本来用 `bun run commit`（czg）交互式写消息，
但没有东西阻止手写的消息破坏约定。校验刻意宽松：只认类型前缀，不评判标题内容；
merge / revert / fixup 消息直接放过。

### 无障碍:axe 扫出了三个真问题

[e2e/a11y.e2e.ts](e2e/a11y.e2e.ts) 在 5 个页面（含一个打开的浮层）上跑 axe，范围限定
`wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa`——`best-practice` 那组是值得读的意见，
但不值得让构建失败，混进来会让这套检查噪音大到被关掉。

这个项目对无障碍很在意（到处 `aria-label`，整个测试套件用 `getByRole` 定位），但光靠人读
代码防不住换主题带来的问题——**换成现在这套 shadcn 风格主题（见[UI 与主题](#ui-与主题)）
之后，axe 一次就扫出三个真问题**：

1. **`Danger` 按钮的白字在 `red-5` 填充上只有约 4.4:1。** WCAG AA 正文要求 4.5:1。改成
   `red-6` 后约 5.9:1——`css-variables-resolver.ts` 里 `--mantine-color-red-filled` 现在指向
   `red-6`。
2. **`已上线` 徽标的白字在 `teal-5` 填充上只有约 3.5:1。** 改成 `teal-6` 后约 5.1:1，同一个
   文件里改。
3. **`SegmentedControl` 未选中项的 `dimmed` 文字在它自己浅灰色的底上只有约 4.4:1。**
   `--mantine-color-dimmed`（浅色模式）从 `secondary-10` 改成 `secondary-6`，约 9.5:1。

三处都是**先跑测试拿到失败的具体元素，再改那一个颜色映射**，不是提前手算——这套主题有
21 个颜色 × 好几个 variant，没被哪个页面渲染到的组合没法用 axe 验证，也就没有预先改。往后
加新颜色的 `filled` / `light` 用法，照这个方法来：跑一遍 `e2e/a11y.e2e.ts`，测出来再补。

> **axe 能查什么、不能查什么**：它查机器可判定的部分——对比度、缺失的表单标签、非法 ARIA、
> 重复 id。它判断不了聚焦顺序是否合理，也判断不了一个标签是否**有意义**。
> WCAG 里大约只有三分之一是机器可判定的，所以通过它是**底线，不是证书**。

### 依赖升级

[renovate.json](renovate.json)。选 Renovate 而不是 Dependabot，是因为它对 Bun 的
`bun.lock` 支持更成熟，而这个仓库 pin 了大量精确版本——**模板最容易腐烂的就是依赖**。
需要在仓库上安装 Renovate 的 GitHub App（一次性）。

分组规则不是装饰，每一条都对应一种"分开升就一定挂"的情况：

- **`next` / `react` / `react-dom` 一起**：分开升，每个 PR 都会红到三个都进来为止。
- **`drizzle-orm` / `drizzle-kit` 一起**：共用迁移格式，单独升一个可能让 `db:generate`
  产出运行时读不了的 SQL。
- **`next-auth` / `@auth/*` 永不批量、永不自动合并**：还是 5.x beta，beta 之间就有破坏性变更。
- **`@mantine/*` 和 `postcss-preset-mantine` 一起**：每个 `@mantine/*` 包都把其余
  `@mantine/*` 声明成精确版本的 peer dependency，单独升一个直接装不上；
  `postcss-preset-mantine` 编译的是组件样式依赖的 CSS 特性，跟着一起升。
- patch / minor 批量成一个 PR：三十个独立的版本号 PR 是"依赖 PR 开始被无视"的起点。

## 部署

形状是**单实例 + 挂载卷上的一个 SQLite 文件**。这是有意的，不是凑合——什么时候该换见下面
「什么时候这套不够用」。

### 已经验证过的，和没验证过的

Docker 在写这部分的环境里不可用，所以：

| 项 | 状态 |
| --- | --- |
| `output: 'standalone'` 产物能跑 | ✅ 直接跑过 `node server.js` |
| libsql 原生 addon 被正确 trace | ✅ `/api/health` 真跑了 `select 1` 并返回 200 |
| 必须手动拷 `.next/static` | ✅ 移走它之后每个 `/_next/static` 请求都 500 |
| 打包后的 migrator 在纯 Node 下能跑 | ✅ 建出了全部 6 张表 |
| 构建需要 `AUTH_SECRET` | ✅ 移开 `.env.local` 后构建报 `Invalid environment variables` |
| 运行时 `APP_URL` 进得去 robots.txt | ✅ 见 [SEO 与元数据](#seo-与元数据) |
| **`Dockerfile` 本身** | ⚠️ **从未构建过。** 第一次 `docker build` 请当成 review |

`Dockerfile` 表达的是上面这些已验证的事实，但镜像没造过。

### 三个非显然的点

**1. 构建期需要 `AUTH_SECRET`，但它不是运行时用的那个。**
`next build` 会求值 `src/core/env.ts`。Dockerfile 里给的是占位值，且**故意不用 `ARG`**——
`ARG` 会诱导别人在构建时传真 secret，那就会被烤进镜像层。运行时 `env.ts` 会用真实环境
重新求值。

**2. `standalone` 不拷 `public/` 和 `.next/static`。** Next 的文档说这两个应该交给 CDN。
漏掉 `.next/static` 的症状是**静默的**：应用正常启动，页面没有样式，每个资源 404/500。
Dockerfile 手动拷了。（本模板没有 `public/`，那条 COPY 注释掉了——`COPY` 一个不存在的
路径会让构建失败。）

**3. 所有 stage 的 libc 必须一致。** 三个 stage 全是 Alpine（musl），这是**功能要求**不是
体积偏好：`standalone` 会把**构建 stage** 平台的 `.node` addon trace 进产物，所以用 Debian
的 `oven/bun:1.3.3` 构建再喂给 Alpine 运行时，会拷进 `@libsql/linux-x64-gnu`，服务器第一次
查询就死。要换就三个一起换。

### 迁移策略

容器启动时在同一个容器里跑：`node migrate.mjs && node server.js`。`&&` 保证迁移失败就不
启动，而不是拿一个和代码不匹配的 schema 去服务流量。

**这只适合当前这个形状**：一个实例，数据库就是刚挂上来那个卷里的一个文件，没有独立的
数据库服务要迁移，也没有第二个副本来竞争。**两个副本同时跑这条命令会竞争同一个文件**——
到那一步迁移就该放进一个独立的、跑完才允许副本启动的 job。

migrator 是[单独打包](src/core/db/migrate-cli.ts)的，因为运行时镜像既没有 Bun 也没有源码。
它是独立入口而不是复用 `migrate.ts`，原因是后者用 `import.meta.main` 判断要不要自跑，
而那是 Bun 的特性——Node 直到 v24 才有，所以在 `engines` 允许的 Node 20/22 上，
`migrate.ts` 的 Node 打包版会**静默什么都不做**。

### 什么时候这套不够用

- **要多副本。** SQLite 是单写者，多个实例写同一个文件会互相阻塞；而且内存里的限流器
  （见[安全](#安全)）也会退化。换 Turso 连接串（libsql 驱动原生支持）或换回 Postgres。
- **卷挂不上。** 那 SQLite 就不成立，直接换 Postgres：改 `schema.ts` 的 import、
  `drizzle.config.ts` 的 dialect、以及 `client.ts` 的驱动。
- **要 CDN。** 把 `.next/static` 和 `public/` 传上去，别让 Node 进程发静态资源。

### CI

五个并行 job：`lint` / `typecheck` / `test` / `build` / `e2e`。

- **`build` 单独成 job**，即使 `e2e` 也会构建。构建失败在这里说的是"构建坏了"；同样的失败
  在 e2e 里表现为 `webServer` 超时，得绕一大圈才到同一个答案。
- **`concurrency` + `cancel-in-progress`**：同一个 ref push 三次不会跑三套完整套件。
- **两层缓存**：bun 的包缓存按 `bun.lock` 的哈希，Playwright 浏览器按 Playwright 版本
  （从 `bun pm ls` 读，不会和实际安装的漂移）。注意 `--with-deps` 装的系统库不在缓存里，
  所以缓存命中时仍然要跑一次 `install-deps`。
- **失败时上传 Playwright 报告**，成功时不传。

## 环境变量

本地把 `.env.example` 拷成 `.env.local`，填上 `AUTH_SECRET`（`openssl rand -base64 32`）。

| 变量 | 必填 | 默认 | 用途 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 否 | `./data/dev.db` | SQLite **文件路径**（不是 URL）。`:memory:` 也认 |
| `AUTH_SECRET` | **是** | — | Auth.js 签 JWT，缺了直接启动失败 |
| `AUTH_URL` | 否（**生产应设**） | — | 本部署的规范 origin。不设时 Auth.js 从 `Host` 头推导回调 URL，见[安全](#安全)。缺失时 `register()` 会打启动告警 |
| `APP_URL` | 否（**生产必设**） | `http://localhost:3000` | 对外的 origin，用来生成 canonical / hreflang / sitemap / OG 的绝对地址，见 [SEO 与元数据](#seo-与元数据)。通常和 `AUTH_URL` 同值。**填错是静默的**——发布出去的是 localhost |
| `LOG_LEVEL` | 否 | `info` | pino 级别 |
| `RESEND_API_KEY` | 否 | — | 不填时 `sendEmail()` 只打 warn 不发信 |
| `WECHAT_APPID` / `WECHAT_SECRET` | 否 | — | 两个都不填时 `core/auth/wechat.ts` 进占位模式(确定性假 openid,不调微信),`/api/v1` 照样能跑。见[多端认证](#多端认证一个验证核心两种传输) |
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
4. **`biome.json` 里 `css.parser.tailwindDirectives: true` 是死配置。** 项目已经没有
   Tailwind，这个开关当初是为它开的（见[编码规范](#编码规范)）。删不删都不影响任何
   lint / format 结果，纯粹是清理债务，没人处理过。
5. **错误边界没有常驻的自动化测试。** 渲染出来的部分由
   [ErrorState.test.tsx](src/components/ui/ErrorState.test.tsx) 覆盖，但"边界有没有真的接上"
   要靠一条故意抛错的路由，模板里不想常留这种东西。改完 `error.tsx` 之后照下面这样验一次
   （两个 `error.tsx` 都是这么验过的）：

   ```bash
   # 1. 目录名不能以下划线开头——那是 Next 的 private folder 约定，整个目录不进路由
   mkdir -p 'src/app/boomprobe' 'src/app/(app)/boomprobeapp'
   for d in 'src/app/boomprobe' 'src/app/(app)/boomprobeapp'; do
   echo 'export default async function Boom() { throw new Error("probe") }' > "$d/page.tsx"
   done
   bun run dev   # 然后开 /boomprobe 和 /boomprobeapp
   # 2. 验完删掉这两个目录
   ```

   要确认的四件事：错误 UI 出来了；`(app)` 那条**左侧 rail 还在**（嵌套边界的意义就在这）；
   生产构建（`bun run build && bun run start`）下**真实的错误消息不出现在页面上**，只有
   `digest`；点"重试"能重新渲染。

   `global-error.tsx` 要触发得让 `app/layout.tsx` 自己抛错，代价比较大，一般改完它
   肉眼过一遍就行。
6. **`src/core/storage/local-stub.ts` 只是占位**，写本地磁盘。真要用文件存储就照 `StorageAdapter`
   接口换成 S3/R2 实现。
7. **403 页没有任何地方会跳转过去。** 登录拦截解决的是"未登录"（弹到 `/login`），而项目里还没有
   角色模型，所以没有"已登录但无权限"这种情况。加了角色判断之后，service 抛 `ForbiddenError`
   （`core/errors.ts` 里已经有了），让页面 `redirect('/403')`。
   > 另一条路是 Next 的 `forbidden()` / `unauthorized()` 加 `forbidden.tsx` /
   > `unauthorized.tsx`，能顺手填掉这个缺口。**本项目刻意没走这条**：它需要打开
   > `experimental.authInterrupts`，模板不想依赖实验性 API；而且它靠抛中断工作，会被
   > `runAction` / `withHandler` 的 try/catch 影响（要靠 `unstable_rethrow` 放行）。
8. **没有软删除。** `notesTable` 有 `createdAt` / `updatedAt`，但删除是真删。需要"回收站"或
   审计的话加 `deletedAt`，并记得**每个查询的 `where` 都要带上它**——漏一个就等于泄露已删数据。
9. **标题搜索是 `LIKE` 扫表。** 通配符已经转义、大小写已经处理（见
   [SQLite 的几个坑](#sqlite-的几个坑)），但 `lower()` 让表达式用不上索引，所以搜索是扫这个
   用户的行。每用户数据量大的域应该换 SQLite 的 FTS5。
10. **登录页的微信按钮是禁用的占位。** 后端没有对应 provider，接法见
    `src/core/auth/config.ts` 的 `providers`。
11. **没有 `authenticator` 表。** `@auth/drizzle-adapter` 的 WebAuthn 方法会去查它，
    表不存在时那些方法运行时会炸。本模板不用 WebAuthn，所以没建；要用的话往
    `src/core/db/schema.ts` 里补一个，并把它传给 `DrizzleAdapter`。
12. **英文文案是从中文翻译来的占位内容**，dashboard 和登录页左侧插画那些都是展示用的样例文字，
    不是真实业务文案。
13. **`/dashboard` 和 `/notes` 都是给你删的。** 前者是设计系统活文档，后者是业务示例。

### 主动放弃的东西（不是缺口）

- **多主题切换器和 Material ripple**。姊妹模板 `next-template` 用同一套机制（Mantine 的
  JS 主题对象 + per-component `.extend()`）做了 Notion / Material 2 / Material 3 三套可
  运行时切换的主题；这里只保留了一套（见[UI 与主题](#ui-与主题)），纯粹是范围选择，不是
  技术限制——机制现在完全一样。要加第二套主题：写第二个 `createTheme()` 对象和第二个
  `CSSVariablesResolver`，运行时按存起来的偏好选一个传给 `<MantineProvider theme={...}>`，
  不用碰 CSS 选择器特异性。
- **SQLite 的并发写入能力**。单文件数据库适合单实例部署；要多实例或高写入量，
  把 `DATABASE_URL` 换成 Turso 连接串（libsql 驱动本来就支持），或者换回 Postgres
  （改 `schema.ts` 的 import、`drizzle.config.ts` 的 dialect、以及 client 的驱动）。
  完整的取舍和迁移策略见[部署](#部署)。
