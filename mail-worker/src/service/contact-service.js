import { and, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm';
import orm from '../entity/orm';
import contact from '../entity/contact';
import email from '../entity/email';
import { emailConst, isDel } from '../const/entity-const';
import BizError from '../error/biz-error';
import verifyUtils from '../utils/verify-utils';
import { t } from '../i18n/i18n';
import emailService from './email-service';

const contactService = {
	async list(c, params, userId) {
		const { query, emailPrefix, emailSuffix, birthday, createAfter, createBefore } = params;
		const conditions = [eq(contact.userId, userId)];
		const contains = (column, value) => sql`${column} COLLATE NOCASE LIKE ${'%' + value.trim() + '%'}`;

		if (query?.trim()) conditions.push(or(contains(contact.email, query), contains(contact.nickname, query)));
		if (emailPrefix?.trim()) conditions.push(sql`${contact.email} COLLATE NOCASE LIKE ${emailPrefix.trim() + '%'}`);
		if (emailSuffix?.trim()) conditions.push(sql`${contact.email} COLLATE NOCASE LIKE ${'%' + emailSuffix.trim()}`);
		if (birthday) conditions.push(eq(contact.birthday, birthday));
		if (createAfter) conditions.push(gte(contact.createTime, `${createAfter} 00:00:00`));
		if (createBefore) conditions.push(lte(contact.createTime, `${createBefore} 23:59:59`));

		return orm(c).select().from(contact)
			.where(and(...conditions))
			.orderBy(desc(contact.contactId))
			.limit(200)
			.all();
	},

	async recentRecipients(c, params, userId) {
		const query = params.query?.trim();
		const recipientEmail = sql`LOWER(json_extract(recipient.value, '$.address'))`;
		const conditions = [
			eq(email.userId, userId),
			eq(email.type, emailConst.type.SEND),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING),
		];

		if (query) conditions.push(sql`${recipientEmail} LIKE ${'%' + query.toLowerCase() + '%'}`);

		return orm(c).select({
			email: recipientEmail.as('email'),
			lastSentTime: sql`MAX(${email.createTime})`.as('last_sent_time'),
		}).from(email)
			.innerJoin(sql`json_each(COALESCE(${email.recipient}, '[]')) AS recipient`, sql`1 = 1`)
			.where(and(...conditions))
			.groupBy(recipientEmail)
			.orderBy(desc(sql`MAX(${email.createTime})`))
			.limit(10)
			.all();
	},

	async add(c, params, userId) {
		const emailValue = params.email?.trim().toLowerCase();
		if (!emailValue) throw new BizError(t('emptyEmail'));
		if (!verifyUtils.isEmail(emailValue)) throw new BizError(t('notEmail'));

		const existing = await orm(c).select({ contactId: contact.contactId }).from(contact).where(and(
			eq(contact.userId, userId),
			sql`${contact.email} COLLATE NOCASE = ${emailValue}`
		)).get();
		if (existing) throw new BizError(t('emailExistDatabase'));

		return orm(c).insert(contact).values({
			userId,
			email: emailValue,
			nickname: params.nickname?.trim() || '',
			birthday: params.birthday || '',
			phone: params.phone?.trim() || '',
		}).returning().get();
	},

	async remove(c, params, userId) {
		const contactIds = (params.contactIds || '').split(',').map(Number).filter(Number.isInteger);
		if (!contactIds.length) return;
		await orm(c).delete(contact).where(and(
			eq(contact.userId, userId),
			inArray(contact.contactId, contactIds)
		)).run();
	},

	async history(c, params, userId) {
		const contactId = Number(params.contactId);
		const contactRow = await orm(c).select().from(contact).where(and(
			eq(contact.contactId, contactId),
			eq(contact.userId, userId)
		)).get();
		if (!contactRow) throw new BizError(t('notExistUser'), 404);

		const emailValue = contactRow.email;
		const matchesRecipient = sql`EXISTS (
			SELECT 1 FROM json_each(COALESCE(${email.recipient}, '[]')) AS recipient
			WHERE json_extract(recipient.value, '$.address') COLLATE NOCASE = ${emailValue}
		)`;
		const list = await orm(c).select().from(email).where(and(
			eq(email.userId, userId),
			eq(email.isDel, isDel.NORMAL),
			ne(email.status, emailConst.status.SAVING),
			or(
				sql`${email.sendEmail} COLLATE NOCASE = ${emailValue}`,
				sql`${email.toEmail} COLLATE NOCASE = ${emailValue}`,
				matchesRecipient
			)
		)).orderBy(desc(email.emailId)).limit(100).all();

		await emailService.emailAddAtt(c, list);
		return { contact: contactRow, list };
	},
};

export default contactService;
