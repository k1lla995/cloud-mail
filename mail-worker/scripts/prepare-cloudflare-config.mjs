import { readFile, writeFile } from 'node:fs/promises';

const d1DatabaseId = optionalEnv('D1_DATABASE_ID', undefined, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const kvNamespaceId = optionalEnv('KV_NAMESPACE_ID', undefined, /^[0-9a-f]{32}$/i);
const r2BucketName = optionalEnv('R2_BUCKET_NAME', undefined, /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/);
const d1DatabaseName = d1DatabaseId
	? optionalEnv('D1_DATABASE_NAME', 'db', /^[a-zA-Z0-9_-]+$/)
	: undefined;

const sourceUrl = new URL('../wrangler.toml', import.meta.url);
const outputUrl = new URL('../wrangler.generated.toml', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

const bindingBlocks = [];

if (d1DatabaseId) {
	bindingBlocks.push(`[[d1_databases]]
binding = "db"
database_name = "${d1DatabaseName}"
database_id = "${d1DatabaseId}"`);
}

if (kvNamespaceId) {
	bindingBlocks.push(`[[kv_namespaces]]
binding = "kv"
id = "${kvNamespaceId}"`);
}

if (r2BucketName) {
	bindingBlocks.push(`[[r2_buckets]]
binding = "r2"
bucket_name = "${r2BucketName}"`);
}

const bindings = bindingBlocks.length
	? `\n\n# Generated at build time. Do not commit this file.\n${bindingBlocks.join('\n\n')}\n`
	: '\n';

await writeFile(outputUrl, `${source.trimEnd()}${bindings}`, 'utf8');
if (bindingBlocks.length) {
	console.log(`Generated wrangler.generated.toml with ${bindingBlocks.length} resource binding(s).`);
} else {
	console.warn('No resource build variables found. Deploying without D1, KV, or R2 bindings; bind them manually after deployment.');
}

function optionalEnv(name, fallback, pattern) {
	const value = process.env[name]?.trim() || fallback;
	if (value === undefined) {
		return undefined;
	}
	if (!pattern.test(value)) {
		throw new Error(`${name} has an invalid format. Deployment stopped before publishing.`);
	}
	return value;
}
