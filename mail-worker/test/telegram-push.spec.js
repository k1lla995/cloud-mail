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

describe('per-user Telegram push', () => {
	it('requires root authorization, verifies a private binding, and disables push on revocation', async () => {
		const initialized = await request(`/init/${JWT_SECRET}`);
		const rootLogin = await login('admin@example.com', initialized.admin.temporaryPassword);
		const rootToken = rootLogin.data.token;

		const configureBot = await request('/setting/set', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ tgBotToken: 'test-token', tgWebhookSecret: 'test-webhook-secret', resendTokens: {} })
		});
		expect(configureBot.code).toBe(200);
		const addUser = await request('/user/add', {
			method: 'POST',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'member@example.com', type: 1, password: 'member-password' })
		});
		expect(addUser.code).toBe(200);
		const member = await env.db.prepare('SELECT user_id AS userId FROM user WHERE email = ?').bind('member@example.com').first();
		const memberLogin = await login('member@example.com', 'member-password');
		const memberToken = memberLogin.data.token;

		const unapprovedBinding = await request('/my/telegram/binding', {
			method: 'POST', headers: { Authorization: memberToken }
		});
		expect(unapprovedBinding.code).toBe(403);

		const memberEscalation = await request('/user/setTelegramAuthorization', {
			method: 'PUT',
			headers: { Authorization: memberToken, 'content-type': 'application/json' },
			body: JSON.stringify({ userId: member.userId, authorized: 1 })
		});
		expect(memberEscalation.code).toBe(403);

		const approval = await request('/user/setTelegramAuthorization', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ userId: member.userId, authorized: 1 })
		});
		expect(approval.code).toBe(200);
		expect(approval.data.authorized).toBe(1);

		const binding = await request('/my/telegram/binding', {
			method: 'POST', headers: { Authorization: memberToken }
		});
		expect(binding.code).toBe(200);
		expect(binding.data.code).toMatch(/^[a-f0-9]{36}$/);
		await request('/setting/set', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ tgBotToken: '', tgWebhookSecret: 'test-webhook-secret', resendTokens: {} })
		});

		const invalidWebhook = await request('/telegram/webhook', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});
		expect(invalidWebhook.code).toBe(401);

		const webhook = await request('/telegram/webhook', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret'
			},
			body: JSON.stringify({ message: { text: `/start bind_${binding.data.code}`, chat: { id: 123456, type: 'private', username: 'member' } } })
		});
		expect(webhook.ok).toBe(true);
		const telegram = await env.db.prepare('SELECT authorized, push_enabled AS pushEnabled, chat_id AS chatId FROM user_telegram WHERE user_id = ?').bind(member.userId).first();
		expect(telegram).toMatchObject({ authorized: 1, pushEnabled: 0, chatId: '123456' });

		const enablePush = await request('/my/telegram/push', {
			method: 'PUT',
			headers: { Authorization: memberToken, 'content-type': 'application/json' },
			body: JSON.stringify({ enabled: true })
		});
		expect(enablePush.data.pushEnabled).toBe(1);

		const revoke = await request('/user/setTelegramAuthorization', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ userId: member.userId, authorized: 0 })
		});
		expect(revoke.data).toMatchObject({ authorized: 0, pushEnabled: 0 });
	});
});
