import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import contactService from '../service/contact-service';

app.get('/contact/list', async (c) => {
	const data = await contactService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.get('/contact/recent-recipients', async (c) => {
	const data = await contactService.recentRecipients(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/contact/add', async (c) => {
	const data = await contactService.add(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.delete('/contact/delete', async (c) => {
	await contactService.remove(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/contact/history', async (c) => {
	const data = await contactService.history(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});
