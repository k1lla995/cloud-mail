import { and, eq } from 'drizzle-orm';
import BizError from '../error/biz-error';
import { isDel } from '../const/entity-const';
import orm from '../entity/orm';
import perm from '../entity/perm';
import role from '../entity/role';
import rolePerm from '../entity/role-perm';
import user from '../entity/user';
import adminUtils from '../utils/admin-utils';
import { t } from '../i18n/i18n';

function deny() {
	throw new BizError(t('unauthorized'), 403);
}

function uniqueIds(ids) {
	if (!Array.isArray(ids)) {
		deny();
	}

	return [...new Set(ids.map(Number).filter(Number.isInteger))];
}

function isStrictSubset(candidateIds, allowedIds) {
	const candidate = new Set(candidateIds);
	const allowed = new Set(allowedIds);
	return candidate.size < allowed.size && [...candidate].every(id => allowed.has(id));
}

const accessControlService = {
	async currentUser(c) {
		const userId = c.get('user')?.userId;
		const userRow = await orm(c).select().from(user).where(
			and(eq(user.userId, userId), eq(user.isDel, isDel.NORMAL))
		).get();

		if (!userRow) {
			deny();
		}

		return userRow;
	},

	async isRootAdmin(c) {
		const userRow = await this.currentUser(c);
		return adminUtils.isAdminUser(userRow, c.env.admin);
	},

	async rolePermIds(c, roleId) {
		const rows = await orm(c).select({ permId: rolePerm.permId }).from(rolePerm)
			.innerJoin(perm, eq(perm.permId, rolePerm.permId))
			.where(eq(rolePerm.roleId, roleId)).all();
		return rows.map(row => row.permId);
	},

	async actorPermIds(c, actor = null) {
		const userRow = actor || await this.currentUser(c);
		return this.rolePermIds(c, userRow.type);
	},

	async assertPermIdsWithinActor(c, permIds, { strict = false } = {}) {
		const requestedIds = uniqueIds(permIds);
		const actor = await this.currentUser(c);
		if (adminUtils.isAdminUser(actor, c.env.admin)) {
			return;
		}

		const actorPermIds = await this.actorPermIds(c, actor);
		const allowed = strict
			? isStrictSubset(requestedIds, actorPermIds)
			: requestedIds.every(id => actorPermIds.includes(id));

		if (!allowed) {
			deny();
		}
	},

	async assertCanManageRole(c, roleId, requestedPermIds) {
		const targetRole = await orm(c).select().from(role).where(eq(role.roleId, roleId)).get();
		if (!targetRole) {
			throw new BizError(t('roleNotExist'));
		}

		const actor = await this.currentUser(c);
		if (adminUtils.isAdminUser(actor, c.env.admin)) {
			return targetRole;
		}

		if (Number(targetRole.roleId) === Number(actor.type)) {
			deny();
		}

		const actorPermIds = await this.actorPermIds(c, actor);
		const targetPermIds = await this.rolePermIds(c, targetRole.roleId);
		if (!isStrictSubset(targetPermIds, actorPermIds)) {
			deny();
		}

		if (requestedPermIds !== undefined) {
			const requestedIds = uniqueIds(requestedPermIds);
			if (!isStrictSubset(requestedIds, actorPermIds)) {
				deny();
			}
		}

		return targetRole;
	},

	async assertCanManageUser(c, targetUserId, nextRoleId) {
		const targetUser = await orm(c).select().from(user).where(eq(user.userId, targetUserId)).get();
		if (!targetUser) {
			throw new BizError(t('notExist'));
		}

		const actor = await this.currentUser(c);
		if (adminUtils.isAdminUser(actor, c.env.admin)) {
			return targetUser;
		}

		if (adminUtils.isAdminUser(targetUser, c.env.admin)) {
			deny();
		}

		const actorPermIds = await this.actorPermIds(c, actor);
		const targetPermIds = await this.rolePermIds(c, targetUser.type);
		if (!isStrictSubset(targetPermIds, actorPermIds)) {
			deny();
		}

		if (nextRoleId !== undefined) {
			const nextRole = await orm(c).select().from(role).where(eq(role.roleId, nextRoleId)).get();
			if (!nextRole || !isStrictSubset(await this.rolePermIds(c, nextRole.roleId), actorPermIds)) {
				deny();
			}
		}

		return targetUser;
	}
};

export default accessControlService;
