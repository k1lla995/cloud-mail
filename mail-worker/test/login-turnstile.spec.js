import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE_URL = 'http://example.com/api';
const JWT_SECRET = 'b7f29a1d-18e2-4d3b-941f-f6b2c97c02fd';

async function request(path, init = {}) {
	const response = await SELF.fetch(`${BASE_URL}${path}`, init);
	return response.json();
}

function login(password, token) {
	return request('/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password, token })
	});
}

describe('login Turnstile protection', () => {
	it('requires Turnstile after the configured number of failed login attempts', async () => {
		const initialized = await request(`/init/${JWT_SECRET}`);
		const adminPassword = initialized.admin.temporaryPassword;

		await env.db.prepare('UPDATE setting SET login_verify = 2, login_verify_count = 1').run();
		await request(`/init/${JWT_SECRET}`);

		const failedLogin = await login('incorrect-password');
		expect(failedLogin.code).toBe(501);

		const protectedLogin = await login(adminPassword);
		expect(protectedLogin.code).toBe(400);
	});
});
