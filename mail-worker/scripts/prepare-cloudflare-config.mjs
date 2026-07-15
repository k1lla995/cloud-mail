import { readFile, writeFile } from 'node:fs/promises';

const d1DatabaseId = requireEnv('D1_DATABASE_ID', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const kvNamespaceId = requireEnv('KV_NAMESPACE_ID', /^[0-9a-f]{32}$/i);
const d1DatabaseName = optionalEnv('D1_DATABASE_NAME', 'db', /^[a-zA-Z0-9_-]+$/);
const r2BucketName = optionalEnv('R2_BUCKET_NAME', 'r2', /^[a-z0-9][a-z0-9-]*[a-z0-9]$/);

const sourceUrl = new URL('../wrangler.toml', import.meta.url);
const outputUrl = new URL('../wrangler.generated.toml', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

const bindings = `

# Generated at build time. Do not commit this file.
[[d1_databases]]
binding = "db"
database_name = "${d1DatabaseName}"
database_id = "${d1DatabaseId}"

[[kv_namespaces]]
binding = "kv"
id = "${kvNamespaceId}"

[[r2_buckets]]
binding = "r2"
bucket_name = "${r2BucketName}"
`;

await writeFile(outputUrl, `${source.trimEnd()}${bindings}`, 'utf8');
console.log('Generated wrangler.generated.toml with D1, KV, and R2 bindings.');

function requireEnv(name, pattern) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required. Deployment stopped before publishing.`);
	}
	if (!pattern.test(value)) {
		throw new Error(`${name} has an invalid format. Deployment stopped before publishing.`);
	}
	return value;
}

function optionalEnv(name, fallback, pattern) {
	const value = process.env[name]?.trim() || fallback;
	if (!pattern.test(value)) {
		throw new Error(`${name} has an invalid format. Deployment stopped before publishing.`);
	}
	return value;
}
