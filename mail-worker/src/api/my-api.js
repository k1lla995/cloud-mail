import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import userTelegramService from '../service/user-telegram-service';

app.get('/my/loginUserInfo', async (c) => {
	const user = await userService.loginUserInfo(c, userContext.getUserId(c));
	return c.json(result.ok(user));
});

app.put('/my/resetPassword', async (c) => {
	await userService.resetPassword(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.delete('/my/delete', async (c) => {
	await userService.delete(c, userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/my/telegram', async (c) => {
	return c.json(result.ok(await userTelegramService.get(c)));
});

app.post('/my/telegram/binding', async (c) => {
	return c.json(result.ok(await userTelegramService.createBinding(c)));
});

app.put('/my/telegram/push', async (c) => {
	const { enabled } = await c.req.json();
	return c.json(result.ok(await userTelegramService.setPushEnabled(c, Boolean(enabled))));
});

app.delete('/my/telegram', async (c) => {
	return c.json(result.ok(await userTelegramService.unbind(c)));
});


