import app from '../hono/hono';
import result from '../model/result';
import settingService from '../service/setting-service';
import userContext from "../security/user-context";
import telegramService from '../service/telegram-service';
import accessControlService from '../security/access-control-service';

app.put('/setting/set', async (c) => {
	await settingService.set(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/setting/query', async (c) => {
	const setting = await settingService.get(c);
	return c.json(result.ok(setting));
});

app.get('/setting/websiteConfig', async (c) => {
	const setting = await settingService.websiteConfig(c);
	return c.json(result.ok(setting));
})

app.put('/setting/setBackground', async (c) => {
	const key = await settingService.setBackground(c, await c.req.json());
	return c.json(result.ok(key));
});

app.delete('/setting/deleteBackground', async (c) => {
	await settingService.deleteBackground(c);
	return c.json(result.ok());
});

app.put('/setting/setPwaIcon', async (c) => {
	const key = await settingService.setPwaIcon(c, await c.req.json());
	return c.json(result.ok(key));
});

app.delete('/setting/deletePwaIcon', async (c) => {
	await settingService.deletePwaIcon(c);
	return c.json(result.ok());
});

app.get('/setting/pwaManifest', async (c) => {
	const setting = await settingService.query(c);
	const icon = setting.pwaIcon
		? (setting.r2Domain
			? `${setting.r2Domain.replace(/\/$/, '').replace(/^([^:]+)$/, 'https://$1')}/${setting.pwaIcon}`
			: `/${setting.pwaIcon}`)
		: '/codex-pet-favicon.png';

	return c.json({
		name: setting.title || 'k1lla-mailplus',
		short_name: setting.title || 'k1lla-mailplus',
		start_url: '/',
		display: 'standalone',
		background_color: '#FFFFFF',
		theme_color: '#FFFFFF',
		icons: [{ src: icon, sizes: setting.pwaIcon ? '512x512' : '256x256', type: 'image/png', purpose: 'any maskable' }]
	}, 200, {
		'Cache-Control': 'no-cache, no-store, must-revalidate'
	});
});

app.put('/setting/setBlacklist', async (c) => {
	const setting = await settingService.setBlacklist(c, await c.req.json());
	return c.json(result.ok(setting));
})

app.post('/setting/configureTelegramWebhook', async (c) => {
	if (!await accessControlService.isRootAdmin(c)) {
		return c.json(result.fail('Only the root administrator can configure the Telegram webhook', 403), 403);
	}
	return c.json(result.ok(await telegramService.configureWebhook(c)));
});

