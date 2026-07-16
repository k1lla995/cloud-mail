import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE_URL = 'http://example.com/api';
const JWT_SECRET = 'b7f29a1d-18e2-4d3b-941f-f6b2c97c02fd';

async function request(path, init = {}) {
	const response = await SELF.fetch(`${BASE_URL}${path}`, init);
	return response.json();
}

async function login(email, password) {
	return request('/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
}

async function createRole(token, name, permIds) {
	const result = await request('/role/add', {
		method: 'POST',
		headers: { Authorization: token, 'content-type': 'application/json' },
		body: JSON.stringify({
			name,
			permIds,
			banEmail: [],
			availDomain: [],
			sendType: 'count',
			sendCount: 0,
			accountCount: 0,
			sort: 0
		})
	});
	expect(result.code).toBe(200);
	return env.db.prepare('SELECT role_id AS roleId FROM role WHERE name = ?').bind(name).first();
}

async function createUser(token, email, type, password) {
	const result = await request('/user/add', {
		method: 'POST',
		headers: { Authorization: token, 'content-type': 'application/json' },
		body: JSON.stringify({ email, type, password })
	});
	expect(result.code).toBe(200);
	return env.db.prepare('SELECT user_id AS userId FROM user WHERE email = ?').bind(email).first();
}

describe('RBAC privilege boundaries', () => {
	it('prevents a role manager from granting itself permissions or resetting the root password', async () => {
		const initialized = await request(`/init/${JWT_SECRET}`);
		const adminPassword = initialized.admin.temporaryPassword;
		const adminLogin = await login('admin@example.com', adminPassword);
		const adminToken = adminLogin.data.token;

		const managerRole = await createRole(adminToken, 'role-manager', [13, 15]);
		const manager = await createUser(adminToken, 'manager@example.com', managerRole.roleId, 'manager-password');
		const managerLogin = await login('manager@example.com', 'manager-password');
		const managerToken = managerLogin.data.token;

		const selfEscalation = await request('/role/set', {
			method: 'PUT',
			headers: { Authorization: managerToken, 'content-type': 'application/json' },
			body: JSON.stringify({
				roleId: managerRole.roleId,
				name: 'role-manager',
				permIds: [6, 8, 13, 15],
				banEmail: [],
				availDomain: [],
				sendType: 'count',
				sendCount: 0,
				accountCount: 0,
				sort: 0
			})
		});
		expect(selfEscalation.code).toBe(403);

		await env.db.prepare('INSERT INTO role_perm (role_id, perm_id) VALUES (?, ?)')
			.bind(managerRole.roleId, 8).run();
		const root = await env.db.prepare('SELECT user_id AS userId FROM user WHERE email = ?')
			.bind('admin@example.com').first();
		const rootPasswordReset = await request('/user/setPwd', {
			method: 'PUT',
			headers: { Authorization: managerToken, 'content-type': 'application/json' },
			body: JSON.stringify({ userId: root.userId, password: 'replacement-password' })
		});
		expect(rootPasswordReset.code).toBe(403);

		const unchangedRootLogin = await login('admin@example.com', adminPassword);
		expect(unchangedRootLogin.code).toBe(200);
		expect(manager.userId).toBeTruthy();
	});
});
