<template>
  <div class="header" :class="!hasPerm('email:send') ? 'not-send' : ''">
    <div class="header-btn">
      <hanburger @click="changeAside"></hanburger>
      <span class="breadcrumb-item">{{ $t(route.meta.title) }}</span>
    </div>
    <div v-perm="'email:send'" class="writer-box" @click="openSend">
      <div class="writer">
        <Icon icon="material-symbols:edit-outline-sharp" width="22" height="22"/>
      </div>
    </div>
    <mail-search class="mail-search" />
    <el-dropdown
      v-if="hasManagementAccess"
      class="management-dropdown"
      trigger="click"
      placement="bottom-start"
      popper-class="management-menu-popper"
    >
      <button class="management-trigger" type="button" :class="{ active: isManagementRoute }" :aria-label="$t('managementCenter')">
        <Icon icon="solar:settings-linear" width="20" height="20" aria-hidden="true" />
        <span>{{ $t('managementCenter') }}</span>
        <Icon class="management-chevron" icon="mingcute:down-small-fill" width="17" height="17" aria-hidden="true" />
      </button>
      <template #dropdown>
        <el-dropdown-menu class="management-menu">
          <el-dropdown-item v-if="hasPerm('analysis:query')" :class="{ active: route.meta.name === 'analysis' }" @click="openManagement('analysis')">
            <Icon icon="fluent:data-pie-20-regular" width="19" height="19" />
            <span>{{ $t('analytics') }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="hasPerm('user:query')" :class="{ active: route.meta.name === 'user' }" @click="openManagement('user')">
            <Icon icon="si:user-alt-2-line" width="18" height="18" />
            <span>{{ $t('allUsers') }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="hasPerm('all-email:query')" :class="{ active: route.meta.name === 'all-email' }" @click="openManagement('all-email')">
            <Icon icon="fluent:mail-list-28-regular" width="19" height="19" />
            <span>{{ $t('allMail') }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="hasPerm('role:query')" :class="{ active: route.meta.name === 'role' }" @click="openManagement('role')">
            <Icon icon="fluent:lock-closed-16-regular" width="19" height="19" />
            <span>{{ $t('permissions') }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="hasPerm('reg-key:query')" :class="{ active: route.meta.name === 'reg-key' }" @click="openManagement('reg-key')">
            <Icon icon="fluent:fingerprint-20-filled" width="19" height="19" />
            <span>{{ $t('inviteCode') }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="hasPerm('setting:query')" :class="{ active: route.meta.name === 'sys-setting' }" @click="openManagement('sys-setting')">
            <Icon icon="eos-icons:system-ok-outlined" width="18" height="18" />
            <span>{{ $t('SystemSettings') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <div class="toolbar">
      <div v-if="uiStore.dark" class="sun-icon icon-item" @click="openDark($event)">
        <Icon icon="mingcute:sun-fill"/>
      </div>
      <div v-else class="dark-icon icon-item" @click="openDark($event)">
        <Icon icon="solar:moon-linear"/>
      </div>
      <div class="notice icon-item" @click="openNotice">
        <Icon icon="streamline-plump:announcement-megaphone"/>
      </div>
      <el-dropdown ref="userinfoRef" @visible-change="e => userInfoShow = e" :teleported="false" popper-class="detail-dropdown">
        <div class="avatar" @click="userInfoHide" >
          <div class="avatar-text">
            <div>{{ formatName(userStore.user.email) }}</div>
          </div>
          <Icon class="setting-icon" icon="mingcute:down-small-fill" width="24" height="24"/>
        </div>
        <template #dropdown>
          <div class="user-details">
            <div class="details-avatar">
              {{ formatName(userStore.user.email) }}
            </div>
            <div class="user-name">
              {{ userStore.user.name }}
            </div>
            <div class="detail-email" @click="copyEmail(userStore.user.email)">
              {{ userStore.user.email }}
            </div>
            <div class="detail-user-type">
              <el-tag>{{ userStore.user.role.name }}</el-tag>
            </div>
            <div class="action-info">
              <div>
                <span style="margin-right: 10px">{{ $t('sendCount') }}</span>
                <span style="margin-right: 10px">{{ $t('accountCount') }}</span>
              </div>
              <div>
                <div>
                  <span v-if="sendCount" style="margin-right: 5px">{{ sendCount }}</span>
                  <el-tag v-if="!hasPerm('email:send')">{{ sendType }}</el-tag>
                  <el-tag v-else>{{ sendType }}</el-tag>
                </div>
                <div>
                  <el-tag v-if="settingStore.settings.manyEmail || settingStore.settings.addEmail">
                    {{ $t('disabled') }}
                  </el-tag>
                  <span v-else-if="accountCount && hasPerm('account:add')"
                        style="margin-right: 5px">{{ $t('totalUserAccount', {msg: accountCount}) }}</span>
                  <el-tag v-else-if="!accountCount && hasPerm('account:add')">{{ $t('unlimited') }}</el-tag>
                  <el-tag v-else-if="!hasPerm('account:add')">{{ $t('unauthorized') }}</el-tag>
                </div>
              </div>
            </div>
            <div class="logout">
              <el-button type="primary" :loading="logoutLoading" @click="clickLogout">{{ $t('logOut') }}</el-button>
            </div>
          </div>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import router from "@/router";
import hanburger from '@/components/hamburger/index.vue'
import {logout} from "@/request/login.js";
import {Icon} from "@iconify/vue";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useRoute} from "vue-router";
import {computed, ref} from "vue";
import {useSettingStore} from "@/store/setting.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {setExtend} from "@/utils/day.js"
import MailSearch from '@/components/mail-search/index.vue'

const {t} = useI18n();
const route = useRoute();
const settingStore = useSettingStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const logoutLoading = ref(false)
const userInfoShow = ref(false)
const userinfoRef = ref({})
const managementPermissions = ['analysis:query', 'user:query', 'all-email:query', 'role:query', 'reg-key:query', 'setting:query']
const managementRoutes = ['analysis', 'user', 'all-email', 'role', 'reg-key', 'sys-setting']
const hasManagementAccess = computed(() => managementPermissions.some(hasPerm))
const isManagementRoute = computed(() => managementRoutes.includes(route.meta.name))

const accountCount = computed(() => {
  return userStore.user.role.accountCount
})

const sendType = computed(() => {

  if (settingStore.settings.send === 1) {
    return t('disabled')
  }

  if (!hasPerm('email:send')) {
    return t('unauthorized')
  }

  if (userStore.user.role?.sendType === 'ban') {
    return t('sendBanned')
  }

  if (userStore.user.role?.sendType === 'internal') {
    return t('sendInternal')
  }

  if (!userStore.user.role?.sendCount) {
    return t('unlimited')
  }

  if (userStore.user.role?.sendType === 'day') {
    return t('daily')
  }

  if (userStore.user.role?.sendType === 'count') {
    return t('total')
  }
})

const sendCount = computed(() => {


  if (!hasPerm('email:send')) {
    return null
  }

  if (userStore.user.role?.sendType === 'ban') {
    return null
  }

  if (userStore.user.role?.sendType === 'internal') {
    return null
  }

  if (!userStore.user.role?.sendCount) {
    return null
  }

  if (settingStore.settings.send === 1) {
    return null
  }

  return userStore.user.sendCount + '/' + userStore.user.role?.sendCount
})

function userInfoHide(e) {
    if (userInfoShow.value) {
        userinfoRef.value.handleClose()
    } else {
        userinfoRef.value.handleOpen()
    }
}

async function copyEmail(email) {
  try {
    await navigator.clipboard.writeText(email);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function changeLang(lang) {
  setExtend(lang === 'en' ? 'en' : 'zh-cn')
  settingStore.lang = lang
}

function openNotice() {
  uiStore.showNotice()
}

function openDark(e) {

  const nextIsDark = !uiStore.dark
  const root = document.documentElement

  if (!document.startViewTransition) {
    switchDark(nextIsDark, root);
    return
  }

  const x = e.clientX
  const y = e.clientY

  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  const endRadius = Math.hypot(maxX, maxY)

  // 标记切换目标，供 CSS 选择器使用
  root.setAttribute('data-theme-to', nextIsDark ? 'dark' : 'light')
  root.style.setProperty('--vt-x', `${x}px`)
  root.style.setProperty('--vt-y', `${y}px`)
  root.style.setProperty('--vt-end-radius', `${endRadius + 10}px`)

  const transition = document.startViewTransition(() => {
    switchDark(nextIsDark, root);
  })

  transition.finished.finally(() => {
    // 清理标记
    root.removeAttribute('data-theme-to')
  })
}

function switchDark(nextIsDark, root) {
  root.setAttribute('class', nextIsDark ? 'dark' : '')
  const metaTag = document.getElementById('theme-color-meta');
  const isMobile =  !window.matchMedia("(pointer: fine) and (hover: hover)").matches;
  metaTag.setAttribute('content', nextIsDark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#FFFFFF' : '#F1F1F1'));
  uiStore.dark = nextIsDark
}

function openSend() {
  uiStore.writerRef.open()
}

function openManagement(name) {
  router.push({ name })
}

function changeAside() {
  uiStore.asideShow = !uiStore.asideShow
}

function clickLogout() {
  logoutLoading.value = true
  logout().then(() => {
    localStorage.removeItem("token")
    router.replace('/login')
  }).finally(() => {
    logoutLoading.value = false
  })
}

function formatName(email) {
  return email[0]?.toUpperCase() || ''
}

</script>
<style>
.detail-dropdown {
  color: var(--el-text-color-primary) !important;
}

.management-menu-popper.el-popper {
  padding: 5px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  box-shadow: 0 14px 36px color-mix(in srgb, #000 18%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.management-menu-popper .el-popper__arrow::before {
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
}
</style>
<style lang="scss" scoped>

:deep(.el-popper.is-pure) {
  border-radius: 6px;
}

.user-details {
  width: 250px;
  font-size: 14px;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;

  .user-name {
    font-weight: bold;
    margin-top: 10px;
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
  }

  .detail-user-type {
    margin-top: 10px;
  }

  .action-info {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto;
    margin-top: 10px;

    > div:first-child {
      display: grid;
      align-items: center;
      gap: 10px;
    }

    > div:last-child {
      display: grid;
      gap: 10px;
      text-align: center;

      > div {
        display: flex;
        align-items: center;
      }
    }
  }

  .detail-email {
    padding-left: 20px;
    padding-right: 20px;
    width: 250px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    color: var(--regular-text-color);
    cursor: pointer;
  }

  .logout {
    margin-top: 20px;
    width: 100%;
    padding-left: 10px;
    padding-right: 10px;
    padding-bottom: 10px;

    .el-button {
      border-radius: 6px;
      height: 28px;
      width: 100%;
    }
  }

  .details-avatar {
    margin-top: 20px;
    height: 40px;
    width: 40px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border: 1px solid var(--dark-border);
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }
}


.header {
  text-align: right;
  font-size: 12px;
  display: grid;
  height: 100%;
  gap: 10px;
  grid-template-columns: auto auto minmax(260px, 720px) auto 1fr;
}

.header.not-send {
  grid-template-columns: auto minmax(260px, 720px) auto 1fr;
}

.mail-search {
  min-width: 0;
  align-self: center;
}

.management-dropdown {
  align-self: center;
}

.management-trigger {
  min-height: 40px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--el-text-color-regular);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 76%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--light-ill) 86%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(18px) saturate(145%);
  -webkit-backdrop-filter: blur(18px) saturate(145%);
  cursor: pointer;
  transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;

  span {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  &:hover,
  &:focus-visible,
  &.active {
    color: var(--el-color-primary);
    border-color: color-mix(in srgb, var(--el-color-primary) 54%, var(--el-border-color));
    background: color-mix(in srgb, var(--el-color-primary) 10%, var(--light-ill));
    box-shadow: 0 5px 16px color-mix(in srgb, var(--el-color-primary) 13%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--el-color-primary) 50%, transparent);
    outline-offset: 2px;
  }
}

:deep(.management-menu .el-dropdown-menu__item) {
  min-width: 142px;
  min-height: 38px;
  gap: 9px;
  padding: 0 10px;
  color: var(--el-text-color-primary);
  border-radius: 5px;
  font-size: 13px;
  line-height: 38px;
}

:deep(.management-menu .el-dropdown-menu__item:hover),
:deep(.management-menu .el-dropdown-menu__item.active) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.writer-box {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 5px;

  .writer {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    color: #ffffff;
    background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-dark-2));
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;

    .writer-text {
      margin-left: 15px;
      font-size: 14px;
      font-weight: bold;;
    }
  }
}

.header-btn {
  display: inline-flex;
  align-items: center;
  height: 100%;
  min-width: 0;
}

.breadcrumb-item {
  font-weight: bold;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toolbar {
  grid-column: -2 / -1;
  display: flex;
  justify-content: end;
  gap: 15px;
  @media (max-width: 767px) {
    gap: 10px;
  }

  .icon-item {
    align-self: center;
    width: 30px;
    height: 30px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .icon-item:hover {
    background: var(--base-fill);
  }

  .notice {
    font-size: 22px;
    margin-right: 4px;
  }

  .dark-icon {
    font-size: 20px;
  }

  .sun-icon {
    font-size: 24px;
  }

  .avatar {
    display: flex;
    align-items: center;
    cursor: pointer;

    .avatar-text {
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);
      height: 30px;
      width: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 8px;
      border: 1px solid var(--dark-border);
    }

    .setting-icon {
      position: relative;
      top: 0;
      margin-right: 10px;
      bottom: 10px;
    }
  }

}

.el-tooltip__trigger:first-child:focus-visible {
  outline: unset;
}

@media (max-width: 767px) {
  .header,
  .header.not-send {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 6px;
  }

  .writer-box,
  .breadcrumb-item,
  .toolbar .notice,
  .toolbar .setting-icon {
    display: none;
  }

  .toolbar {
    gap: 2px;
  }

  .management-trigger {
    width: 44px;
    min-height: 44px;
    padding: 0;

    span,
    .management-chevron {
      display: none;
    }
  }
}
</style>
