import BizError from '../error/biz-error';
import accountService from './account-service';
import orm from '../entity/orm';
import user from '../entity/user';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { emailConst, isDel, roleConst, userConst } from '../const/entity-const';
import kvConst from '../const/kv-const';
import KvConst from '../const/kv-const';
import cryptoUtils from '../utils/crypto-utils';
import emailService from './email-service';
import dayjs from 'dayjs';
import permService from './perm-service';
import roleService from './role-service';
import emailUtils from '../utils/email-utils';
import saltHashUtils from '../utils/crypto-utils';
import constant from '../const/constant';
import { t } from '../i18n/i18n'
import reqUtils from '../utils/req-utils';
import adminUtils from '../utils/admin-utils';
import accessControlService from '../security/access-control-service';
import { userTelegram } from '../entity/user-telegram';

const userService = {

	async loginUserInfo(c, userId) {

		const userRow = await userService.selectById(c, userId);

		if (!userRow) {
			throw new BizError(t('authExpired'), 401);
		}

		const [account, roleRow, permKeys] = await Promise.all([
			accountService.selectByEmailIncludeDel(c, userRow.email),
			roleService.selectById(c, userRow.type),
			adminUtils.isAdminUser(userRow, c.env.admin) ? Promise.resolve(['*']) : permService.userPermKeys(c, userId)
		]);

		const user = {};
		user.userId = userRow.userId;
		user.uid = userRow.uid;
		user.sendCount = userRow.sendCount;
		user.email = userRow.email;
		user.account = account;
		user.name = account.name;
		user.permKeys = permKeys;
		user.role = roleRow;
		user.type = userRow.type;

		if (adminUtils.isAdminUser(userRow, c.env.admin)) {
			user.role = constant.ADMIN_ROLE
			user.type = 0;
		} else if (!roleRow) {
			throw new BizError(t('roleNotExist'), 403);
		}

		return user;
	},


	async resetPassword(c, params, userId) {

		const { password } = params;

		if (password.length < 6) {
			throw new BizError(t('pwdMinLength'));
		}
		const { salt, hash } = await cryptoUtils.hashPassword(password);
		await orm(c).update(user).set({ password: hash, salt: salt }).where(eq(user.userId, userId)).run();
	},

	async recoverAdmin(c, userId, password) {
		const { salt, hash } = await cryptoUtils.hashPassword(password);
		await userService.assignRootAdminUid(c, userId);
		await orm(c).update(user).set({
			password: hash,
			salt,
			type: 0,
			status: userConst.status.NORMAL,
			isDel: isDel.NORMAL,
			uid: '0000'
		}).where(eq(user.userId, userId)).run();
		await accountService.restoreByUserId(c, userId);
		await c.env.kv.delete(KvConst.AUTH_INFO + userId);
	},

	async markAdmin(c, userId) {
		await userService.assignRootAdminUid(c, userId);
		await orm(c).update(user).set({ type: 0, uid: '0000' }).where(eq(user.userId, userId)).run();
		await c.env.kv.delete(KvConst.AUTH_INFO + userId);
	},

	selectByEmail(c, email) {
		return orm(c).select().from(user).where(
			and(
				eq(user.email, email),
				eq(user.isDel, isDel.NORMAL)))
			.get();
	},

	async generateUid(c, options = {}) {
		if (options.fixed) {
			return options.fixed;
		}

		const rows = await orm(c).select({ uid: user.uid }).from(user).all();
		const used = new Set(rows.map(row => row.uid).filter(Boolean));

		for (let i = 0; i < 200; i++) {
			const uid = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
			if (uid === '0000' || used.has(uid)) {
				continue;
			}
			return uid;
		}

		for (let n = 1; n < 10000; n++) {
			const uid = String(n).padStart(4, '0');
			if (!used.has(uid)) {
				return uid;
			}
		}

		throw new BizError(t('uidPoolExhausted'));
	},

	async assignRootAdminUid(c, userId = null) {
		const holders = await orm(c).select().from(user).where(eq(user.uid, '0000')).all();
		for (const holder of holders) {
			if (userId != null && holder.userId === userId) {
				continue;
			}
			const newUid = await userService.generateUid(c);
			await orm(c).update(user).set({ uid: newUid }).where(eq(user.userId, holder.userId)).run();
		}
	},

	async insert(c, params) {
		const values = { ...params };
		// Fixed root uid must be exclusive before insert
		if (values.uid === '0000') {
			await userService.assignRootAdminUid(c, null);
		}

		let lastError = null;
		for (let attempt = 0; attempt < 5; attempt++) {
			const payload = { ...values };
			if (!payload.uid) {
				payload.uid = await userService.generateUid(c);
			}
			try {
				const { userId } = await orm(c).insert(user).values(payload).returning().get();
				return userId;
			} catch (e) {
				lastError = e;
				const msg = String(e?.message || e || '');
				// Retry only on unique uid collisions under concurrent registration
				if (!/UNIQUE|unique|uid/i.test(msg) || payload.uid === '0000') {
					throw e;
				}
				values.uid = undefined;
			}
		}
		throw lastError || new BizError(t('uidPoolExhausted'));
	},

	selectByEmailIncludeDel(c, email) {
		return orm(c).select().from(user).where(sql`${user.email} COLLATE NOCASE = ${email}`).get();
	},

	selectByIdIncludeDel(c, userId) {
		return orm(c).select().from(user).where(eq(user.userId, userId)).get();
	},

	selectById(c, userId) {
		return orm(c).select().from(user).where(
			and(
				eq(user.userId, userId),
				eq(user.isDel, isDel.NORMAL)))
			.get();
	},

	async delete(c, userId) {
		await orm(c).update(user).set({ isDel: isDel.DELETE }).where(eq(user.userId, userId)).run();
		await c.env.kv.delete(kvConst.AUTH_INFO + userId)
	},

	async physicsDelete(c, params) {
		let { userIds } = params;
		userIds = userIds.split(',').map(Number);
		await Promise.all(userIds.map(userId => accessControlService.assertCanManageUser(c, userId)));
		await Promise.all(userIds.map(userId => c.env.kv.delete(KvConst.AUTH_INFO + userId)));
		await accountService.physicsDeleteByUserIds(c, userIds);
		await orm(c).delete(user).where(inArray(user.userId, userIds)).run();
	},

	async list(c, params) {

		let { num, size, email, timeSort, status } = params;

		size = Number(size);
		num = Number(num);
		timeSort = Number(timeSort);
		params.isDel = Number(params.isDel);
		if (size > 50) {
			size = 50;
		}

		num = (num - 1) * size;

		const conditions = [];

		if (status > -1) {
			conditions.push(eq(user.status, status));
			conditions.push(eq(user.isDel, isDel.NORMAL));
		}


		if (email) {
			const keyword = String(email).trim();
			if (/^\d{1,4}$/.test(keyword)) {
				const paddedUid = keyword.padStart(4, '0');
				conditions.push(sql`(${user.email} COLLATE NOCASE LIKE ${'%'+ keyword + '%'} OR ${user.uid} = ${paddedUid} OR ${user.uid} LIKE ${'%'+ keyword + '%'})`);
			} else {
				conditions.push(sql`(${user.email} COLLATE NOCASE LIKE ${'%'+ keyword + '%'} OR ${user.uid} LIKE ${'%'+ keyword + '%'})`);
			}
		}


		if (params.isDel) {
			conditions.push(eq(user.isDel, params.isDel));
		}


		const query = orm(c).select({
			...user,
			telegramAuthorized: userTelegram.authorized
		}).from(user)
			.leftJoin(userTelegram, eq(userTelegram.userId, user.userId))
			.where(and(...conditions));


		if (timeSort) {
			query.orderBy(asc(user.userId));
		} else {
			query.orderBy(desc(user.userId));
		}

		const list = await query.limit(size).offset(num);

		const { total } = await orm(c)
			.select({ total: count() })
			.from(user)
			.where(and(...conditions)).get();
		const userIds = list.map(user => user.userId);

		const types = [...new Set(list.map(user => user.type))];

		const [emailCounts, delEmailCounts, sendCounts, delSendCounts, accountCounts, delAccountCounts, roleList] = await Promise.all([
			emailService.selectUserEmailCountList(c, userIds, emailConst.type.RECEIVE),
			emailService.selectUserEmailCountList(c, userIds, emailConst.type.RECEIVE, isDel.DELETE),
			emailService.selectUserEmailCountList(c, userIds, emailConst.type.SEND),
			emailService.selectUserEmailCountList(c, userIds, emailConst.type.SEND, isDel.DELETE),
			accountService.selectUserAccountCountList(c, userIds),
			accountService.selectUserAccountCountList(c, userIds, isDel.DELETE),
			roleService.selectByIdsHasPermKey(c, types,'email:send')
		]);

		const receiveMap = Object.fromEntries(emailCounts.map(item => [item.userId, item.count]));
		const sendMap = Object.fromEntries(sendCounts.map(item => [item.userId, item.count]));
		const accountMap = Object.fromEntries(accountCounts.map(item => [item.userId, item.count]));

		const delReceiveMap = Object.fromEntries(delEmailCounts.map(item => [item.userId, item.count]));
		const delSendMap = Object.fromEntries(delSendCounts.map(item => [item.userId, item.count]));
		const delAccountMap = Object.fromEntries(delAccountCounts.map(item => [item.userId, item.count]));

		for (const user of list) {

			const userId = user.userId;

			user.receiveEmailCount = receiveMap[userId] || 0;
			user.sendEmailCount = sendMap[userId] || 0;
			user.accountCount = accountMap[userId] || 0;

			user.delReceiveEmailCount = delReceiveMap[userId] || 0;
			user.delSendEmailCount = delSendMap[userId] || 0;
			user.delAccountCount = delAccountMap[userId] || 0;

			const roleIndex = roleList.findIndex(roleRow => user.type === roleRow.roleId);
			let sendAction = {};

			if (roleIndex > -1) {
				sendAction.sendType = roleList[roleIndex].sendType;
				sendAction.sendCount = roleList[roleIndex].sendCount;
				sendAction.hasPerm = true;
			} else {
				sendAction.hasPerm = false;
			}

			if (adminUtils.isAdminUser(user, c.env.admin)) {
				sendAction.sendType = constant.ADMIN_ROLE.sendType;
				sendAction.sendCount = constant.ADMIN_ROLE.sendCount;
				sendAction.hasPerm = true;
				user.type = 0
			}

			user.sendAction = sendAction;
		}

		return { list, total };
	},

	async updateUserInfo(c, userId, recordCreateIp = false) {



		const activeIp = reqUtils.getIp(c);

		const {os, browser, device} = reqUtils.getUserAgent(c);

		const params = {
			os,
			browser,
			device,
			activeIp,
			activeTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
		};

		if (recordCreateIp) {
			params.createIp = activeIp;
		}

		await orm(c)
			.update(user)
			.set(params)
			.where(eq(user.userId, userId))
			.run();
	},

	async setPwd(c, params) {

		const { password, userId } = params;
		await accessControlService.assertCanManageUser(c, userId);
		await this.resetPassword(c, { password }, userId);
		await c.env.kv.delete(KvConst.AUTH_INFO + userId);
	},

	async setStatus(c, params) {

		const { status, userId } = params;
		await accessControlService.assertCanManageUser(c, userId);

		await orm(c)
			.update(user)
			.set({ status })
			.where(eq(user.userId, userId))
			.run();

		if (status === userConst.status.BAN) {
			await c.env.kv.delete(KvConst.AUTH_INFO + userId);
		}
	},

	async setType(c, params) {

		const { type, userId } = params;
		await accessControlService.assertCanManageUser(c, userId, type);

		const roleRow = await roleService.selectById(c, type);

		if (!roleRow) {
			throw new BizError(t('roleNotExist'));
		}

		await orm(c)
			.update(user)
			.set({ type })
			.where(eq(user.userId, userId))
			.run();

	},

	async incrUserSendCount(c, quantity, userId) {
		await orm(c).update(user).set({
			sendCount: sql`${user.sendCount}
	  +
	  ${quantity}`
		}).where(eq(user.userId, userId)).run();
	},

	async updateAllUserType(c, type, curType) {
		await orm(c)
			.update(user)
			.set({ type })
			.where(eq(user.type, curType))
			.run();
	},

	async add(c, params) {

		const { email, type, password } = params;
		await accessControlService.assertPermIdsWithinActor(c, await accessControlService.rolePermIds(c, type), { strict: true });

		if (!c.env.domain.includes(emailUtils.getDomain(email))) {
			throw new BizError(t('notEmailDomain'));
		}

		if (password.length < 6) {
			throw new BizError(t('pwdMinLength'));
		}

		const accountRow = await accountService.selectByEmailIncludeDel(c, email);

		if (accountRow && accountRow.isDel === isDel.DELETE) {
			throw new BizError(t('isDelUser'));
		}

		if (accountRow) {
			throw new BizError(t('isRegAccount'));
		}

		const role = await roleService.selectById(c, type);

		if (!role) {
			throw new BizError(t('roleNotExist'));
		}

		const { salt, hash } = await saltHashUtils.hashPassword(password);

		const userId = await userService.insert(c, { email, password: hash, salt, type });

		await userService.updateUserInfo(c, userId, true);

		await accountService.insert(c, { userId: userId, email, type, name: emailUtils.getName(email) });
	},

	async resetDaySendCount(c) {
		const roleList = await roleService.selectByIdsAndSendType(c, 'email:send', roleConst.sendType.DAY);
		const roleIds = roleList.map(action => action.roleId);
		await orm(c).update(user).set({ sendCount: 0 }).where(inArray(user.type, roleIds)).run();
	},

	async resetSendCount(c, params) {
		await orm(c).update(user).set({ sendCount: 0 }).where(eq(user.userId, params.userId)).run();
	},

	async restore(c, params) {
		const { userId, type } = params
		await accessControlService.assertCanManageUser(c, userId);
		await orm(c)
			.update(user)
			.set({ isDel: isDel.NORMAL })
			.where(eq(user.userId, userId))
			.run();
		const userRow = await this.selectById(c, userId);
		await accountService.restoreByEmail(c, userRow.email);

		if (type) {
			await emailService.restoreByUserId(c, userId);
			await accountService.restoreByUserId(c, userId);
		}

	},

	listByRegKeyId(c, regKeyId) {
		return orm(c)
			.select({email: user.email,createTime: user.createTime})
			.from(user)
			.where(eq(user.regKeyId, regKeyId))
			.orderBy(desc(user.userId))
			.all();
	}
};

export default userService;
