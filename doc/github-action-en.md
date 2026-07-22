# GitHub Actions Deployment Guide

This page explains how to deploy k1lla-mailplus to Cloudflare Workers with GitHub Actions.  
**中文版:** [github-action.md](github-action.md)

> For manual deploy (edit `wrangler.toml` + `pnpm deploy`), see [README-en.md](../README-en.md) → **Build and Deployment**.  
> Actions and manual deploy need the **same values**; only the place you store them differs (GitHub Secrets vs local file).

---

## What to prepare first

Create these in the Cloudflare dashboard before adding Secrets:

| Resource | Required | Value to copy |
| --- | :---: | --- |
| D1 database | ✅ | **Database ID** (UUID) |
| KV namespace | ✅ | **Namespace ID** |
| R2 bucket | Recommended | **Bucket name** (name, not a UUID) |
| Domain | ✅ | Cloudflare-hosted mail domain, e.g. `example.com` |
| Cloudflare API token | ✅ | Token with Workers / D1 / KV / R2 permissions |
| Cloudflare Account ID | ✅ | Account ID |

Step-by-step resource creation: [README-en.md → Build and Deployment → Step 1](../README-en.md).

---

## 1. Configure GitHub repository Secrets

1. Fork or clone [https://github.com/k1lla995/k1lla-mailplus](https://github.com/k1lla995/k1lla-mailplus)
2. Open your repo → **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each row below

### Secrets reference

| Secret name | Required | Meaning | Example | Notes |
| --- | :---: | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | ✅ | Cloudflare API token | (shown once when created) | Needs Workers and related resource permissions |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Cloudflare account ID | `0123abcd...` | From dashboard sidebar / account overview |
| `D1_DATABASE_ID` | ✅ | D1 Database ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | The ID, not the database name |
| `KV_NAMESPACE_ID` | ✅ | KV Namespace ID | `0123456789abcdef0123456789abcdef` | 32-char hex |
| `R2_BUCKET_NAME` | ✅* | R2 bucket name | `k1lla-mailplus` | *Required by the default workflow template |
| `DOMAIN` | ✅ | Mail domains as a **JSON array string** | `["example.com"]` | Must include brackets and double quotes; multi: `["a.com","b.com"]`; **no `@`** |
| `ADMIN` | ✅ | Full admin email | `admin@example.com` | Domain after `@` must appear in `DOMAIN` |
| `JWT_SECRET` | ✅ | Long random secret | (generate 32+ chars) | Used for login and `/api/init/<JWT_SECRET>` |
| `NAME` | If used by workflow | Worker name | `k1lla-mailplus` | — |
| `CUSTOM_DOMAIN` | If used by workflow | Custom domain for routes | `mail.example.com` | — |
| `AI_MODEL` | Optional | AI model | `@cf/meta/llama-3.1-8b-instruct` | Optional; code has a default |
| `ANALYSIS_CACHE` | Optional | Cache analytics | `false` | `true` or `false` |
| `PROJECT_LINK` | Optional | Show project links | `true` | `true` or `false` |
| `INIT_URL` | ❌ | Auto-init URL after deploy | Leave **empty** on first deploy | Manually open init in a browser so you can save the temp password |

### `DOMAIN` format (most common mistake)

| Correct | Incorrect |
| --- | --- |
| `["example.com"]` | `example.com` (not a JSON array) |
| `["example.com","mail.example.org"]` | `@example.com` (no `@`) |
| `["example.com"]` | `["@example.com"]` |

### `ADMIN` must match `DOMAIN`

- ✅ `DOMAIN=["example.com"]`, `ADMIN=admin@example.com`
- ❌ `DOMAIN=["example.com"]`, `ADMIN=admin@gmail.com`

---

## 2. Create a Cloudflare API token

1. Open [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → start from “Edit Cloudflare Workers” and add D1 / KV / R2 / account permissions as needed  
   (example image: ![token permissions example](https://i.miji.bid/2025/07/07/dc2e1dc8dcd217644759c46c6c705de1.png))
3. Copy the token immediately into GitHub Secret `CLOUDFLARE_API_TOKEN`

## 3. Find your Cloudflare Account ID

1. Open the Dashboard
2. Copy **Account ID** from the sidebar or account overview
3. Store it as `CLOUDFLARE_ACCOUNT_ID`

---

## 4. Run the workflow

1. Open the repo **Actions** tab and select the deploy workflow
2. Click **Run workflow** once
3. Wait until the job finishes successfully

### After the first deploy: initialize manually (important)

Open in a browser (replace domain and secret):

```text
https://your-project-domain/api/init/your-JWT_SECRET
```

This will:

1. Create / migrate database tables  
2. Create the root admin for `ADMIN`  
3. If the admin is new, return `temporaryPassword` **once** — save it immediately  

Sign in with the `ADMIN` email + temporary password, then change the password under **Personal Settings**.

> - The init URL contains `JWT_SECRET`; do not share it  
> - **Do not set `INIT_URL` on first deploy**, or the temp password may exist only in Actions logs  
> - The admin email cannot be created via public registration  

### Upgrading an existing instance

1. Sync upstream or push new code; wait for Actions to deploy  
2. Visit the init URL once more to run migrations  
3. A trusted admin is usually not reset and gets no new temporary password  

### Syncing upstream

Use a sync bot, or click **Sync fork** / Sync Upstream on GitHub.

---

## 5. Mapping to manual `wrangler.toml`

| Manual `wrangler.toml` | GitHub Secret |
| --- | --- |
| `[[d1_databases]].database_id` | `D1_DATABASE_ID` |
| `[[kv_namespaces]].id` | `KV_NAMESPACE_ID` |
| `[[r2_buckets]].bucket_name` | `R2_BUCKET_NAME` |
| `[vars].domain` | `DOMAIN` (JSON array string) |
| `[vars].admin` | `ADMIN` |
| `[vars].jwt_secret` | `JWT_SECRET` |

Binding names `db` / `kv` / `r2` are fixed in the template — **do not rename them**.

---

## 6. FAQ

| Symptom | What to do |
| --- | --- |
| Actions fails: permission denied | Expand API Token permissions (Workers, D1, KV, R2, account read) |
| Deploy OK but “database not bound” | Check `D1_DATABASE_ID` / `KV_NAMESPACE_ID` and account match |
| Signup rejects domain | Ensure `DOMAIN` is a valid JSON array without `@` |
| Init secret mismatch | URL secret must equal Secret `JWT_SECRET` exactly (no spaces/newlines) |
| No incoming mail | Point Cloudflare Email Routing to this Worker; domain must be in `DOMAIN` |

For full variable meanings, receiving mail, and troubleshooting, see [README-en.md](../README-en.md).