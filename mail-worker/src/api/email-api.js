import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import userContext from '../security/user-context';
import attService from '../service/att-service';

app.get('/email/list', async (c) => {
	const data = await emailService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.get('/email/search', async (c) => {
	const list = await emailService.search(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.get('/email/recycle', async (c) => {
	const data = await emailService.recycleList(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.put('/email/restore', async (c) => {
	const count = await emailService.restore(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok({ count }));
});

app.delete('/email/permanent', async (c) => {
	const count = await emailService.permanentDelete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok({ count }));
});

app.delete('/email/recycle', async (c) => {
	const count = await emailService.clearRecycle(c, userContext.getUserId(c));
	return c.json(result.ok({ count }));
});

app.get('/email/latest', async (c) => {
	const list = await emailService.latest(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.delete('/email/delete', async (c) => {
	await emailService.delete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/email/attList', async (c) => {
	const attList = await attService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(attList));
});

app.post('/email/send', async (c) => {
	const email = await emailService.send(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(email));
});

app.put('/email/read', async (c) => {
	await emailService.read(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
})

