<p align="center">
  <img src="mail-vue/public/codex-pet-favicon.png" width="96" alt="k1lla-mailplus mascot" />
</p>

<h1 align="center">k1lla-mailplus</h1>

<p align="center">
  A serverless email service built on Cloudflare for managing multiple accounts, sending and receiving emails, and storing attachments.
</p>

<p align="center">
  <a href="README.md">Chinese</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/frontend-Vue%203-42b883.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020.svg" alt="Cloudflare Workers" />
</p>

<p align="center">
  <a href="README.md">中文</a> | <strong>English</strong>
</p>

## Overview

k1lla-mailplus is a lightweight, responsive email management system. With a single domain, you can create and manage multiple email accounts while deploying the backend on Cloudflare's edge infrastructure to reduce traditional server and maintenance costs.

This project is also a practical example of a full-stack serverless application, covering frontend and backend separation, access control, email processing, object storage, and data visualization.

## Features

- **Email account management**: Create and manage multiple email accounts and domains.
- **Email delivery**: Receive, send, reply to, forward, and track emails.
- **Attachment handling**: Upload, receive, and download attachments stored in Cloudflare R2.
- **Admin console**: Manage users, emails, system settings, and permissions.
- **Role-based access control**: Restrict features and resource access by user role.
- **Email forwarding**: Forward received emails to Telegram or other email services.
- **Verification code recognition**: Use Workers AI to detect verification codes in emails.
- **Data visualization**: Use ECharts to display system, user, and email metrics.
- **Security protection**: Integrate Cloudflare Turnstile to reduce automated registration and abuse.
- **Built-in spam rules**: Detect upstream spam markers and disposable sender domains; matched mail goes to Trash and is not forwarded.
- **Traceable Trash**: Show why an email entered Trash, with restore, permanent deletion, and 30-day automatic cleanup.
- **Responsive interface**: Support desktop and major mobile browsers.
- **Internationalization**: Built-in Chinese and English interfaces.
- **Open API**: Support batch user creation and conditional email queries.

## Tech Stack

### Frontend

- Vue 3 + Vite
- Element Plus
- Pinia
- Vue Router
- Vue I18n
- ECharts

### Backend and Infrastructure

- Cloudflare Workers
- Hono
- Drizzle ORM
- Cloudflare D1: Relational data storage
- Cloudflare KV: Caching and configuration storage
- Cloudflare R2: Attachment and object storage
- Resend: Email delivery service
- Workers AI: Verification code recognition
- Cloudflare Turnstile: CAPTCHA protection

## Project Structure

```text
k1lla-mailplus/
├── mail-vue/                 # Vue 3 frontend application
│   └── src/
│       ├── components/       # Shared components
│       ├── layout/            # Page layouts
│       ├── request/           # API request layer
│       ├── router/            # Router configuration
│       ├── store/             # Global state
│       └── views/             # Page components
├── mail-worker/              # Cloudflare Workers backend
│   ├── src/
│   │   ├── api/              # API endpoints
│   │   ├── dao/              # Data access layer
│   │   ├── email/             # Email processing
│   │   ├── security/          # Authentication and authorization
│   │   ├── service/           # Business services
│   │   └── index.js           # Worker entry point
│   └── wrangler.toml          # Workers configuration
├── doc/                      # Deployment docs (GitHub Actions ZH/EN)
└── LICENSE
```

## Local Development

### Requirements

Prepare the following before you start:

| Item | Notes |
| --- | --- |
| Node.js | **18+** (20 LTS recommended). Check with `node -v`. |
| pnpm | Package manager. Install with `npm install -g pnpm` if needed. |
| Cloudflare account | A free account is enough. Sign in at the [Cloudflare Dashboard](https://dash.cloudflare.com/). |
| Domain | The domain **must** be on Cloudflare (nameservers pointed to Cloudflare) to receive mail. |
| Wrangler CLI | Official Cloudflare CLI. Install with `npm install -g wrangler`, then `wrangler login`. |

### Optional: preview the frontend only

You can run the UI without a full Cloudflare setup:

```bash
cd mail-vue
pnpm install
pnpm dev
```

Open the URL printed in the terminal (usually `http://localhost:5173`).

### Optional: run the backend locally

```bash
cd mail-worker
pnpm install
pnpm dev
```

The local backend reads `mail-worker/wrangler-dev.toml` and your Wrangler login session.  
**Full login, storage, and mail receiving** still need real D1/KV (and related) resources with correct bindings and variables. Beginners usually get better results by following **Build and Deployment** below and using the live Worker in the browser.

> **Security**: API tokens, `jwt_secret`, database IDs, and similar values are secrets. **Do not** commit them to Git or share them in public chats/screenshots.

---

## Build and Deployment (beginner-friendly)

Follow this order: **create resources → bind them → set variables → deploy → initialize**.  
You can also use [GitHub Actions](doc/github-action-en.md). The same values are required; they are just stored as GitHub Secrets instead of local `wrangler.toml` fields.

### Three resources you must understand

| Name | Plain meaning | Used for in this project | Required |
| --- | --- | --- | :---: |
| **D1** | Cloudflare’s SQLite database | Users, mail, roles, settings | ✅ Yes |
| **KV** | Key-value store (simple cache) | Login sessions, cached site settings | ✅ Yes |
| **R2** | Object storage (file bucket) | Attachments, backgrounds, PWA icons | Recommended |

Two more terms:

- **Binding**: the name your Worker code uses to access a resource. In this project, **`db` / `kv` / `r2` / `assets` / `ai` are fixed in code and must not be renamed**.
- **Vars**: runtime configuration such as mail domains, admin email, and JWT secret.

---

### Step 1: Create Cloudflare resources

Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and select your account.

#### 1.1 Create a D1 database

1. Go to **Workers & Pages** → **D1** (or search for “D1”).
2. Click **Create database**.
3. Name example: `k1lla-mailplus` (name is flexible; the **Database ID** is what matters).
4. Open the database and save:
   - **Database name**
   - **Database ID** (UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### 1.2 Create a KV namespace

1. Go to **Workers & Pages** → **KV**.
2. Click **Create a namespace**.
3. Name example: `k1lla-mailplus-kv`.
4. Save:
   - **Namespace ID** (usually a 32-character hex string)

#### 1.3 (Recommended) Create an R2 bucket

1. Go to **R2** → **Create bucket**.
2. Bucket names must be lowercase letters/numbers/hyphens, e.g. `k1lla-mailplus`.
3. Save the **Bucket name** (R2 binding uses the **name**, not a separate UUID).

> Without R2 the app can still run, but attachments / some image features are limited. For a full trial with attachments, create R2.

#### 1.4 Prepare your domain

1. Add the domain to Cloudflare and set its nameservers at your registrar to Cloudflare’s nameservers.
2. Wait until the domain is **Active**.
3. You will put this hostname (without `@`) into the `domain` variable, e.g. `example.com`.

Receiving mail also requires Cloudflare **Email Routing** to forward mail to this Worker (see **Step 6**).

---

### Step 2: Bind resources in `wrangler.toml`

Open:

`mail-worker/wrangler.toml`

D1 / KV / R2 bindings are **commented out by default**. Uncomment them and fill in your real values.  
**Keep every `binding` name exactly as shown**; only change IDs and names.

#### 2.1 Required binding example

```toml
[[d1_databases]]
binding = "db"                          # fixed — do not change
database_name = "k1lla-mailplus"        # your D1 database name
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # your D1 Database ID

[[kv_namespaces]]
binding = "kv"                          # fixed — do not change
id = "0123456789abcdef0123456789abcdef" # your KV Namespace ID

# Optional: enable when you need attachment storage
[[r2_buckets]]
binding = "r2"                          # fixed — do not change
bucket_name = "k1lla-mailplus"          # your R2 bucket name
```

#### 2.2 Binding reference

| Block | `binding` (fixed) | Fields you fill | Where to copy from |
| --- | --- | --- | --- |
| `[[d1_databases]]` | `db` | `database_name`, `database_id` | D1 dashboard |
| `[[kv_namespaces]]` | `kv` | `id` | KV Namespace ID |
| `[[r2_buckets]]` (optional) | `r2` | `bucket_name` | R2 bucket name |
| `[assets]` | `assets` | usually unchanged | Frontend build output, default `./dist` |
| `[ai]` | `ai` | usually unchanged | Workers AI binding |

#### 2.3 Common mistakes

| Symptom | Likely cause |
| --- | --- |
| KV / D1 not bound | `binding` renamed, or still commented out at deploy time |
| Deploy OK but API returns 502 “database not bound” | Wrong `database_id` / KV `id`, or wrong Cloudflare account |
| Changed `binding = "database"` | **Never rename bindings** — code only uses `db`, `kv`, `r2` |

> With GitHub Actions you do **not** put IDs into `wrangler.toml` by hand. Put `D1_DATABASE_ID`, `KV_NAMESPACE_ID`, `R2_BUCKET_NAME`, etc. into GitHub Secrets instead. See [`doc/github-action-en.md`](doc/github-action-en.md).

---

### Step 3: Set runtime variables (critical)

Still in `mail-worker/wrangler.toml`, edit the `[vars]` section.  
Vars are **configuration values**, separate from resource bindings.

#### 3.1 Full example (replace with your own values)

```toml
[vars]
# Domains allowed for signup and receiving mail (no @ prefix)
# Multiple domains go in the array
domain = ["example.com"]

# Administrator email — must use a domain listed above
admin = "admin@example.com"

# JWT secret: generate a long random string (32+ chars recommended)
# Used for login tokens and the first-time init URL /api/init/<jwt_secret>
# If leaked, others may forge sessions or trigger initialization
jwt_secret = "replace-with-your-own-long-random-string"

# Optional
# ai_model = "@cf/meta/llama-3.1-8b-instruct"   # AI model for captcha extraction
# analysis_cache = false                        # cache analytics charts
# project_link = true                           # show project links in UI
# orm_log = false                               # SQL logs (enable only when debugging)
```

#### 3.2 Variable reference

| Variable | Required | Type / format | Meaning | Good example | Bad example |
| --- | :---: | --- | --- | --- | --- |
| `domain` | ✅ | String array | Domains allowed for signup/receive; **no `@`** | `["example.com"]` | `"@example.com"`, bare `example.com` without array |
| `admin` | ✅ | Full email | Root admin account; domain must be in `domain` | `admin@example.com` | `admin`, `admin@gmail.com` when domain is only `example.com` |
| `jwt_secret` | ✅ | Long random string | JWT signing key; also path secret for `/api/init/...` | Your own random string | `123456`, `password`, sample text |
| `ai_model` | Optional | String | Workers AI model name | `@cf/meta/llama-3.1-8b-instruct` | — |
| `analysis_cache` | Optional | `true` / `false` | Cache analytics data | `false` | — |
| `project_link` | Optional | `true` / `false` | Show project links in UI | `true` | — |

#### 3.3 How `domain` and `admin` must match

1. `domain` is hostnames only — no `@`, no `https://`.
2. Multiple domains: `domain = ["example.com", "mail.example.org"]`.
3. `admin` must be a full address whose domain appears in `domain`:  
   - ✅ `domain = ["example.com"]` + `admin = "boss@example.com"`  
   - ❌ `domain = ["example.com"]` + `admin = "boss@gmail.com"`
4. After init, only this `admin` mailbox is the root administrator; **public registration cannot use that address**.

#### 3.4 Generate `jwt_secret`

- Use a password manager / random generator (32+ characters), or:

```bash
# macOS / Linux
openssl rand -hex 32

# or Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the entire output into `jwt_secret = "..."`.

> `keep_vars = true` in `wrangler.toml` means console-edited vars may be retained in some update paths. Beginners should manage vars in **one place only** (`wrangler.toml` or GitHub Secrets) to avoid drift.

---

### Step 4: Deploy to Cloudflare

From a terminal:

```bash
# 1) Log in to Cloudflare
wrangler login

# 2) Install Worker dependencies
cd mail-worker
pnpm install

# 3) Deploy (builds the frontend, then publishes the Worker)
pnpm deploy
```

Notes:

- `pnpm deploy` runs `wrangler deploy` and builds `mail-vue` into `mail-worker/dist`.
- After success you get a `*.workers.dev` URL; you can also attach a custom domain in the dashboard.
- Custom domains need DNS on Cloudflare pointing at the Worker (use Workers custom domains / routes as guided by the UI).

For GitHub Actions: add Secrets, then run the workflow from the Actions tab. See [`doc/github-action-en.md`](doc/github-action-en.md).

---

### Step 5: First-time database init and admin creation

After deploy, **open this URL once in a browser** (replace domain and secret):

```text
https://your-project-domain/api/init/your-jwt-secret
```

Example:

```text
https://mail.example.com/api/init/a1b2c3d4e5f6...
```

#### What this request does

1. Creates / upgrades database tables (migrations).
2. Creates (or takes over) the **root admin** for the configured `admin` email.
3. If the admin is **newly created**, the JSON response includes a one-time `temporaryPassword`.

#### Sign-in steps

1. **Copy and store** `temporaryPassword` immediately (shown fully only at this moment).
2. Open the site and sign in with the **`admin` email + temporary password**.
3. Open **Personal Settings** and change the password right away.

#### Security notes

| Note | Detail |
| --- | --- |
| Init URL contains the secret | The path is your `jwt_secret` — do not post it publicly |
| Do not auto-init on first deploy | CI auto-init may leave the temp password only in logs |
| Visiting init again | For an already trusted admin, usually **no** new temp password; used for migrations |
| Changing `admin` | Re-init may take over the new email, issue a new temp password, and invalidate old sessions |

If you see JWT secret mismatch, the URL secret does **not** match the deployed `jwt_secret` (check typos and whether the latest config was deployed).

---

### Step 6: Configure receiving mail (Email Routing)

Without this step you can open the login page but **will not receive external mail**.

1. Cloudflare dashboard → your domain → **Email** → **Email Routing**.
2. Enable Email Routing and add the DNS records it requests (MX, etc.).
3. Create a route that sends addresses (or catch-all) **to your Worker** (the k1lla-mailplus Worker).
4. Ensure every receiving domain is listed in the `domain` variable.

Outbound sending usually needs a provider such as **Resend** in System Settings — that is separate from receiving. Without send config you can still receive and read mail.

---

### Step 7: Recommended settings after login

As admin, open **System Settings** and configure as needed:

1. Public registration and invite codes (registration keys).
2. Turnstile (bot protection for signup / login abuse).
3. Send provider (e.g. Resend token) and object storage domain (R2 custom domain for attachments).
4. Telegram bot (optional mail push).
5. Blocklists / spam rules (see **Built-in Spam Rules Guide** below).

---

### Step 8: Upgrade an existing instance

1. Deploy the new version (`pnpm deploy` or GitHub Actions).
2. Visit once: `https://your-project-domain/api/init/your-jwt-secret` to run migrations.
3. For an already trusted admin: password is usually **not** reset and no new temp password is returned.
4. A new temp password may be issued only if:  
   - the old admin lacked the trusted marker; or  
   - you changed the `admin` variable to a different email.

---

### Which deploy method should you use?

| Method | Best for | What you do |
| --- | --- | --- |
| Manual: edit `wrangler.toml` + `pnpm deploy` | First deploy, learning each step | Create D1/KV/R2 → fill bindings & vars → deploy → browser init |
| GitHub Actions | Ongoing auto-deploy on push/sync | Put the same values in GitHub Secrets — see [`doc/github-action-en.md`](doc/github-action-en.md) |

Both methods need the same data: **D1 ID, KV ID, R2 bucket name, domain, admin, jwt_secret**.

---

### Troubleshooting quick reference

| Symptom | What to check |
| --- | --- |
| Blank site / static 404 | Frontend build succeeded? `[assets]` points to `./dist`? |
| API says KV / D1 not bound | Bindings named `db`/`kv`? IDs correct? Redeployed after edit? |
| Signup rejected for domain | Is the address domain in `domain`? Extra `@`? |
| Cannot sign in as admin | Did you run init? Temp password correct? Exact `admin` email? |
| Init secret mismatch | URL secret equals deployed `jwt_secret`? |
| Login works but no incoming mail | Email Routing → this Worker? MX live? Domain in `domain`? |
| Attachments fail | R2 bound? R2 public/custom domain set in System Settings? |

## Built-in Spam Rules Guide

### Detection and precedence

The system evaluates spam rules after receiving an email and before forwarding it to Telegram or another mailbox. A match moves the email directly to Trash and stops forwarding. Trash emails are retained for 30 days and then permanently removed automatically.

If an email matches more than one rule, Trash shows the most specific reason using this precedence:

1. **Blacklist rule**: a sender/address domain in the system blacklist, or in the sender blacklist assigned through the recipient's role.
2. **Manual rule**: a subject or body keyword in the system blacklist.
3. **Auto-detected spam**: an upstream spam header or a domain from the built-in disposable-email list.
4. **Recently deleted**: an email manually moved to Trash from a mailbox list, email detail page, or batch action.

### Automatic rules

Automatic rules are enabled by default and do not need configuration:

- `X-Spam-Flag` values of `yes`, `true`, or `1` are treated as spam.
- `X-Spam-Status` is treated as spam when it contains `yes` or `spam`, or when its `score` is greater than or equal to `required`.
- Sender domains are matched against the bundled disposable-email domain list. A listed parent domain also matches its subdomains. For example, a list entry for `example-temp.com` also matches `mail.example-temp.com`.

The disposable-domain data comes from [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains). It is released under CC0 and bundled into the Worker, so receiving mail does not rely on an external network request.

### Configure manual rules and blacklists

1. Sign in as an administrator, open **System Settings**, then open **Email Blocklist**.
2. Add a keyword under **Email Subject** to classify matching subjects as **Manual rule**.
3. Add a keyword under **Email Content** to classify matching HTML or plain-text bodies as **Manual rule**.
4. Add a complete email address or domain under **Sender** to classify matching senders or sender domains as **Blacklist rule**.
5. For per-user control, add email addresses, domains, or `*` to the sender restriction on that user's role. Matching messages also show **Blacklist rule**.

Keywords use literal contains matching. Use specific phrases rather than short common words to reduce false positives. Domain rules do not need an `@` prefix.

### Review, restore, and clean up mail

1. Open **Trash** from the sidebar. Each email has a reason tag before its subject.
2. The Trash search box searches only emails already in Trash. In normal mail search, enable **Include Trash** to also return deleted emails.
3. Select one or more emails to restore them to their original mailbox. Restoring removes the Trash reason.
4. Permanent deletion and emptying Trash cannot be undone. During the final 7 days, Trash displays a notice for emails that are about to be removed automatically.

### Update the disposable-domain list

Before a Worker release, maintainers can fetch the latest upstream revision and generate a new bundled snapshot:

```bash
pnpm --dir mail-worker update:disposable-domains
```

Commit the generated `mail-worker/src/const/disposable-domains.js`, then build and deploy the Worker normally. The command contacts GitHub only during development or CI updates; production mail delivery does not contact GitHub.

### Upgrade note

This feature adds the Trash reason database field. For an existing installation, deploy the new Worker and then visit the initialization URL once to apply migrations:

```bash
https://your-project-domain/api/init/your-jwt-secret
```

Existing Trash emails are labeled **Recently deleted**. New emails entering Trash record their actual matching reason. The initialization URL contains a secret; do not retain, share, or publish it after use.

## Screenshots

| Mailbox List | Email Details |
| :---: | :---: |
| ![Mailbox list](doc/demo/demo1.png) | ![Email details](doc/demo/demo2.png) |

| Admin Console | System Analytics |
| :---: | :---: |
| ![Admin console](doc/demo/demo3.png) | ![System analytics](doc/demo/demo4.png) |

## License

This project is licensed under the [MIT License](LICENSE).
