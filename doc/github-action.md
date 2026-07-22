# GitHub Actions 部署指南

本页说明如何用 GitHub Actions 把 k1lla-mailplus 自动部署到 Cloudflare Workers。  
**English version:** [github-action-en.md](github-action-en.md)

> 手动部署（本地改 `wrangler.toml` + `pnpm deploy`）请看仓库根目录 [README.md](../README.md) 的「构建与部署」章节。  
> Actions 方式与手动方式需要的信息**完全相同**，只是填写位置从 `wrangler.toml` 换成了 GitHub Secrets。

---

## 你需要先准备什么

在配置 Secrets 之前，请先在 Cloudflare 控制台创建好：

| 资源 | 是否必须 | 你要记下的值 |
| --- | :---: | --- |
| D1 数据库 | ✅ | **Database ID**（UUID） |
| KV 命名空间 | ✅ | **Namespace ID** |
| R2 存储桶 | 推荐 | **Bucket name**（桶名，不是 UUID） |
| 域名 | ✅ | 已接入 Cloudflare 的邮件域名，如 `example.com` |
| Cloudflare API Token | ✅ | 有 Workers / D1 / KV / R2 等权限的令牌 |
| Cloudflare Account ID | ✅ | 账户 ID |

创建资源的逐步说明见 [README.md → 构建与部署 → 第 1 步](../README.md)。

---

## 一、配置 GitHub 仓库 Secrets

1. Fork 或克隆仓库：[https://github.com/k1lla995/k1lla-mailplus](https://github.com/k1lla995/k1lla-mailplus)
2. 打开你的仓库 → **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，按下面表格逐个添加

### Secrets 一览

| Secret 名称 | 是否必须 | 含义 | 填写示例 | 注意 |
| --- | :---: | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | ✅ | Cloudflare API 令牌 | （控制台生成，只显示一次） | 需要 Workers 及相关资源权限，见下文 |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Cloudflare 账户 ID | `0123abcd...` | 在 Dashboard 右侧或账户概览可复制 |
| `D1_DATABASE_ID` | ✅ | D1 的 Database ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 只要 ID，不要填成数据库名字 |
| `KV_NAMESPACE_ID` | ✅ | KV 的 Namespace ID | `0123456789abcdef0123456789abcdef` | 32 位十六进制 |
| `R2_BUCKET_NAME` | ✅* | R2 桶名 | `k1lla-mailplus` | *当前工作流模板默认需要；无桶时请先创建空桶或调整工作流 |
| `DOMAIN` | ✅ | 邮件域名列表（JSON 数组字符串） | `["example.com"]` | **必须带方括号和英文双引号**；多域名：`["a.com","b.com"]`；**不要写 `@`** |
| `ADMIN` | ✅ | 管理员完整邮箱 | `admin@example.com` | `@` 后的域名必须出现在 `DOMAIN` 里 |
| `JWT_SECRET` | ✅ | 长随机密钥 | （自己生成 32 位以上） | 用于登录与 `/api/init/<JWT_SECRET>`；勿用弱密码 |
| `NAME` | 视工作流 | Worker 名称 | `k1lla-mailplus` | 若工作流使用该变量 |
| `CUSTOM_DOMAIN` | 视工作流 | 绑定的自定义域名 | `mail.example.com` | 若工作流配置了 routes |
| `AI_MODEL` | 可选 | AI 模型 | `@cf/meta/llama-3.1-8b-instruct` | 可不填，用代码默认值 |
| `ANALYSIS_CACHE` | 可选 | 是否缓存分析数据 | `false` | `true` 或 `false` |
| `PROJECT_LINK` | 可选 | 是否显示项目链接 | `true` | `true` 或 `false` |
| `INIT_URL` | ❌ | 部署后自动请求的初始化地址 | 首次建议**留空** | 首次部署请手动浏览器访问 init，避免临时密码只出现在日志 |

### `DOMAIN` 写法对照（最容易填错）

| 正确 | 错误 |
| --- | --- |
| `["example.com"]` | `example.com`（缺 JSON 数组） |
| `["example.com","mail.example.org"]` | `@example.com`（不要加 `@`） |
| `["example.com"]` | `["@example.com"]` |

### `ADMIN` 与 `DOMAIN` 必须匹配

- ✅ `DOMAIN=["example.com"]`，`ADMIN=admin@example.com`
- ❌ `DOMAIN=["example.com"]`，`ADMIN=admin@gmail.com`

---

## 二、获取 Cloudflare API 令牌

1. 打开 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → 可选用 “Edit Cloudflare Workers” 模板，并按需补齐 D1 / KV / R2 / Account 相关权限  
   （参考图：![token permissions example](https://i.miji.bid/2025/07/07/dc2e1dc8dcd217644759c46c6c705de1.png)）
3. 创建后**立即复制**令牌到 GitHub Secret `CLOUDFLARE_API_TOKEN`（页面离开后无法再看全文）

## 三、获取 Cloudflare Account ID

1. 登录 Dashboard，进入任意域名或 Workers 概览
2. 右侧边栏或账户 URL 中可看到 **Account ID**
3. 复制到 Secret `CLOUDFLARE_ACCOUNT_ID`

---

## 四、运行工作流

1. 打开仓库 **Actions** 页面，选择部署工作流
2. 点击 **Run workflow** 手动运行一次
3. 等待构建与部署成功（绿色勾）

### 首次部署后：手动初始化（重要）

在浏览器访问（替换成你的域名和 `JWT_SECRET`）：

```text
https://你的项目域名/api/init/你的JWT_SECRET
```

作用：

1. 创建 / 迁移数据库表  
2. 创建 `ADMIN` 对应的根管理员  
3. 若是新管理员，响应中的 `temporaryPassword` **只完整出现这一次** — 立刻保存  

然后用 `ADMIN` 邮箱 + 临时密码登录，在 **个人设置** 中修改密码。

> - 初始化 URL 含有 `JWT_SECRET`，不要公开转发  
> - **首次部署不要配置 `INIT_URL` 自动初始化**，否则临时密码可能只写在 Actions 日志里  
> - 管理员邮箱不能通过公开注册页面创建  

### 升级已有实例

1. 同步上游或推送新代码，等待 Actions 部署完成  
2. 再手动访问一次 init 地址，执行迁移  
3. 已是可信管理员时，通常不会重置密码、也不会返回新的临时密码  

### 同步上游

可使用 bot，或在 GitHub 仓库页面手动点击 **Sync fork** / Sync Upstream。

---

## 五、和手动部署的对应关系

| 手动 `wrangler.toml` | GitHub Secret |
| --- | --- |
| `[[d1_databases]].database_id` | `D1_DATABASE_ID` |
| `[[kv_namespaces]].id` | `KV_NAMESPACE_ID` |
| `[[r2_buckets]].bucket_name` | `R2_BUCKET_NAME` |
| `[vars].domain` | `DOMAIN`（JSON 数组字符串） |
| `[vars].admin` | `ADMIN` |
| `[vars].jwt_secret` | `JWT_SECRET` |

绑定名 `db` / `kv` / `r2` 在模板里已写死，**不要改名**。

---

## 六、常见问题

| 现象 | 处理 |
| --- | --- |
| Actions 部署失败：权限不足 | 检查 API Token 是否包含 Workers、D1、KV、R2、账户读取等权限 |
| 部署成功但站点报数据库未绑定 | 核对 `D1_DATABASE_ID` / `KV_NAMESPACE_ID` 是否复制完整、账户是否同一账号 |
| 注册提示域名不允许 | 检查 `DOMAIN` 是否为合法 JSON 数组，域名是否含 `@` |
| init 提示 secret mismatch | URL 中的密钥必须与 Secret `JWT_SECRET` **完全一致**（注意空格、换行） |
| 收不到邮件 | 在 Cloudflare Email Routing 把邮件路由到该 Worker；域名需在 `DOMAIN` 中 |

更完整的收信、变量含义、故障排查见根目录 [README.md](../README.md)。