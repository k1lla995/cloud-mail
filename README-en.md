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
├── doc/                      # Deployment and usage documentation
└── LICENSE
```

## Local Development

### Requirements

- Node.js 18 or later
- pnpm
- A Cloudflare account and Wrangler CLI

### Start the frontend

```bash
cd mail-vue
pnpm install
pnpm dev
```

### Start the backend

```bash
cd mail-worker
pnpm install
pnpm dev
```

For Cloudflare D1, KV, R2, domain, and email service configuration, refer to the deployment documentation under [`doc`](doc). Fill in the configuration files and secrets for your environment. Never commit API tokens, database credentials, or other sensitive information to the repository.

## Build and Deployment

### 1. Create Cloudflare resources

Create and record the following in the Cloudflare dashboard:

- A Worker;
- A D1 database and KV namespace;
- An optional R2 bucket for attachments and background images;
- A Cloudflare-managed mail domain and, optionally, a Resend delivery configuration.

Bind the resource IDs to the Worker. Edit `mail-worker/wrangler.toml` for manual deployments, or configure the Secrets listed in [`doc/github-action.md`](doc/github-action.md) for GitHub Actions.

### 2. Configure runtime variables

Set at least these values:

- `domain`: an array of domains that can receive and create mailboxes, for example `["example.com"]`;
- `admin`: the administrator email, which must belong to a configured domain;
- `jwt_secret`: a long, random, secret string used for login tokens and first-time initialization;
- `db` and `kv`: the D1 and KV bindings. Their binding names must not change.

Do not reuse example secrets or commit production credentials.

### 3. Build and deploy

Build the frontend:

```bash
cd mail-vue
pnpm build
```

Deploy the Worker:

```bash
cd mail-worker
pnpm deploy
```

### 4. Initialize and sign in

After the first deployment, manually visit the initialization URL below. It creates database tables, runs migrations, and creates the trusted administrator account for the configured `admin` email:

```bash
https://your-project-domain/api/init/your-jwt-secret
```

The response includes `temporaryPassword`. Save it immediately, sign in with the configured `admin` email, and change the password in Personal Settings. The administrator email is reserved server-side, so neither public sign-up nor OAuth binding can create it.

Never share or retain the initialization URL because it contains `jwt_secret`. Do not configure an automatic initialization URL for the first deployment, otherwise the temporary password may only be available in automation logs.

### 5. Upgrade an existing instance

After deployment, visit the same initialization URL once to run migrations. A trusted administrator is not reset and no new temporary password is returned. The system only takes over the account, generates a new temporary password, and revokes previous sessions when an older administrator account lacks the trusted marker or when the configured `admin` email changes.

After signing in, use System Settings to enable registration, configure invite codes, mail delivery, and object storage as needed. For production, deployment through GitHub Actions or another CI workflow is recommended.

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
