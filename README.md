<p align="center">
  <img src="mail-vue/public/codex-pet-favicon.png" width="96" alt="k1lla-mailplus mascot" />
</p>

<h1 align="center">k1lla-mailplus</h1>

<p align="center">
  一个基于 Cloudflare 的 Serverless 邮箱服务，支持多账号管理、邮件收发与附件存储。
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/frontend-Vue%203-42b883.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020.svg" alt="Cloudflare Workers" />
</p>

## 项目简介

k1lla-mailplus 是一个轻量、响应式的邮箱管理系统。只需要一个域名，就可以创建和管理多个邮箱账号，并通过 Cloudflare 的边缘基础设施部署后端服务，降低传统服务器的运维成本。

这个项目适合作为 Serverless 全栈应用的实践案例，覆盖了前后端分离、权限控制、邮件处理、对象存储和数据可视化等常见工程场景。

## 功能特性

- **邮箱账号管理**：创建、管理多个邮箱账号和域名。
- **邮件收发**：支持邮件接收、发送、回复、转发和状态追踪。
- **附件处理**：支持附件上传、接收和下载，文件存储在 Cloudflare R2。
- **管理员控制台**：提供用户、邮件、系统配置和权限管理能力。
- **权限控制**：基于角色的访问控制（RBAC），限制不同用户的功能和资源访问范围。
- **邮件推送**：可将收到的邮件转发到 Telegram 或其他邮箱服务。
- **验证码识别**：结合 Workers AI 自动识别邮件中的验证码。
- **数据可视化**：使用 ECharts 展示用户和邮件等系统数据。
- **安全防护**：集成 Cloudflare Turnstile，降低批量注册和自动化攻击风险。
- **内置垃圾邮件规则**：自动识别上游垃圾邮件标记和临时邮箱域名；命中邮件会进入回收站且不会被转发。
- **可追溯回收站**：回收站会展示邮件进入原因，支持恢复、永久删除和 30 天自动清理。
- **响应式界面**：适配桌面端及主流移动端浏览器。
- **国际化支持**：内置中文和英文界面。
- **开放 API**：支持批量创建用户和按条件查询邮件。

## 技术栈

### 前端

- Vue 3 + Vite
- Element Plus
- Pinia
- Vue Router
- Vue I18n
- ECharts

### 后端与基础设施

- Cloudflare Workers
- Hono
- Drizzle ORM
- Cloudflare D1：关系型数据存储
- Cloudflare KV：缓存和配置存储
- Cloudflare R2：附件和对象存储
- Resend：邮件发送服务
- Workers AI：验证码识别
- Cloudflare Turnstile：人机验证

## 项目结构

```text
k1lla-mailplus/
├── mail-vue/                 # Vue 3 前端应用
│   └── src/
│       ├── components/       # 通用组件
│       ├── layout/            # 页面布局
│       ├── request/           # API 请求层
│       ├── router/            # 路由配置
│       ├── store/             # 全局状态
│       └── views/             # 页面组件
├── mail-worker/              # Cloudflare Workers 后端
│   ├── src/
│   │   ├── api/              # API 接口
│   │   ├── dao/              # 数据访问层
│   │   ├── email/             # 邮件处理
│   │   ├── security/          # 认证与授权
│   │   ├── service/           # 业务服务
│   │   └── index.js           # Worker 入口
│   └── wrangler.toml          # Workers 配置
├── doc/                      # 部署和使用文档
└── LICENSE
```

## 本地开发

### 环境要求

- Node.js 18 或更高版本
- pnpm
- Cloudflare 账号及 Wrangler CLI

### 启动前端

```bash
cd mail-vue
pnpm install
pnpm dev
```

### 启动后端

```bash
cd mail-worker
pnpm install
pnpm dev
```

具体的 Cloudflare D1、KV、R2、域名和邮件服务配置，请参考 [`doc`](doc) 目录下的部署文档，并根据自己的环境填写配置文件和密钥。不要将 API Token、数据库凭据或其他敏感信息提交到仓库。

## 构建与部署

### 1. 创建 Cloudflare 资源

在 Cloudflare 控制台创建并记录以下资源：

- 一个 Worker；
- 一个 D1 数据库和一个 KV 命名空间；
- 可选的 R2 存储桶，用于附件和背景图；
- 已接入 Cloudflare 的邮件域名，以及可选的 Resend 发信配置。

将资源 ID 绑定到 Worker。手动部署时编辑 `mail-worker/wrangler.toml`；GitHub Actions 部署时按 [`doc/github-action.md`](doc/github-action.md) 配置 Secrets。

### 2. 配置运行变量

至少设置以下变量：

- `domain`：可接收和创建邮箱的域名数组，例如 `["example.com"]`；
- `admin`：管理员邮箱，必须属于 `domain` 中的域名；
- `jwt_secret`：随机、保密且足够长的字符串，用于登录令牌和首次初始化；
- `db` 与 `kv`：D1 和 KV 绑定，绑定名不可改动。

不要复用示例中的密钥，也不要将生产密钥提交到仓库。

### 3. 构建并部署

构建前端：

```bash
cd mail-vue
pnpm build
```

部署 Worker：

```bash
cd mail-worker
pnpm deploy
```

### 4. 首次初始化并登录

首次部署后，手动访问下面的初始化地址。它会创建数据库表、执行迁移，并为 `admin` 配置的邮箱创建可信管理员账号：

```bash
https://你的项目域名/api/init/你的jwt_secret
```

响应会包含 `temporaryPassword`。立即保存它，使用 `admin` 邮箱登录，然后在“个人设置”中修改密码。管理员邮箱已被服务端保留，公开注册和 OAuth 绑定均不能创建该地址。

请勿公开或长期保留初始化地址，因为其中包含 `jwt_secret`。首次部署不要配置自动初始化 URL，否则临时密码可能只出现在自动化日志里而无法安全保存。

### 5. 升级已有实例

部署新版本后，再访问一次相同初始化地址即可运行迁移。已经初始化的可信管理员不会被重置，也不会再次返回临时密码。仅当旧管理员账号尚未写入可信标记，或你修改了 `admin` 配置时，系统才会接管该账号、生成新临时密码并撤销旧会话。

完成登录后，按需在系统设置中开启注册、配置注册码、邮件发送服务和对象存储。生产环境建议通过 GitHub Actions 或其他 CI 流程执行部署。

## 内置垃圾邮件规则教程

### 判定方式与优先级

系统在邮件入库后、Telegram 和邮箱转发之前执行垃圾邮件判定。只要任一规则命中，邮件会直接移入回收站，不会继续转发。回收站中的邮件会保留 30 天，到期后自动永久清理。

当一封邮件同时匹配多种规则时，回收站只显示一个最明确的原因，优先级如下：

1. **黑名单规则判断**：系统黑名单中的发件人/域名，或用户角色配置的发件人黑名单。
2. **手动规则判断**：系统黑名单中的邮件主题关键词或正文关键词。
3. **规则自动判断垃圾邮件**：邮件头的垃圾评分，或内置临时邮箱域名清单。
4. **最近删除**：用户在邮箱列表、详情页或批量操作中手动移入回收站的邮件。

### 自动规则

自动规则默认启用，无需填写配置：

- 当邮件头 `X-Spam-Flag` 为 `yes`、`true` 或 `1` 时，系统将其视为垃圾邮件。
- 当 `X-Spam-Status` 包含 `yes` 或 `spam`，或者其中的 `score` 大于等于 `required` 时，系统将其视为垃圾邮件。
- 发件人域名会与内置临时邮箱域名清单匹配，子域名也会命中其已收录的父域名。例如，清单中存在 `example-temp.com` 时，`mail.example-temp.com` 也会被识别。

临时邮箱域名清单来源于 [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)，以 CC0 许可发布，并随 Worker 一起部署，因此收信时不依赖外部网络。

### 配置手动规则和黑名单

1. 使用管理员账号进入 **系统设置**，打开 **邮件黑名单**。
2. 在 **邮件主题** 中添加关键词，命中主题的邮件会显示“手动规则判断”。
3. 在 **邮件内容** 中添加关键词，HTML 正文或纯文本正文命中时会显示“手动规则判断”。
4. 在 **发件人** 中添加完整邮箱地址或域名。命中发件人或发件域名时会显示“黑名单规则判断”。
5. 如需按用户控制，在对应用户角色的发件人限制中添加邮箱、域名或 `*`；命中的邮件同样显示“黑名单规则判断”。

关键词按照原文包含关系匹配。建议使用足够具体的词组，避免用过短、常见的单词造成误判；域名规则不需要添加 `@`。

### 查看、恢复与清理邮件

1. 在侧栏打开 **回收站**，每封邮件主题前会显示进入原因标签。
2. 使用搜索框仅检索已经进入回收站的邮件；常规邮件搜索需要勾选“包含回收站”才会同时返回已删除邮件。
3. 选择单封或多封邮件后可恢复。恢复会将邮件还原到原邮箱，并清除其回收站原因。
4. 永久删除和清空回收站不可恢复。到期前 7 天，回收站会提示即将自动清理的邮件数量。

### 更新临时邮箱域名清单

维护者可在发布 Worker 前执行以下命令，下载上游最新提交并生成新的内置快照：

```bash
pnpm --dir mail-worker update:disposable-domains
```

提交生成的 `mail-worker/src/const/disposable-domains.js` 后，按常规流程构建并部署 Worker。该命令只在开发或 CI 更新时访问 GitHub；线上收信不会访问 GitHub。

### 升级注意事项

本功能新增了回收站原因字段。升级已有实例时，部署新 Worker 后必须再访问一次初始化地址以执行数据库迁移：

```bash
https://你的项目域名/api/init/你的jwt_secret
```

已有回收站邮件会被标记为“最近删除”，新进入回收站的邮件会记录实际命中原因。初始化地址包含密钥，执行后请勿保存、分享或公开。

## 截图

| 邮箱列表 | 邮件详情 |
| :---: | :---: |
| ![邮箱列表](doc/demo/demo1.png) | ![邮件详情](doc/demo/demo2.png) |

| 管理后台 | 系统数据 |
| :---: | :---: |
| ![管理后台](doc/demo/demo3.png) | ![系统数据](doc/demo/demo4.png) |

## 开源协议

本项目使用 [MIT License](LICENSE) 开源。

