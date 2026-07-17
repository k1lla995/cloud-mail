<template>
  <div class="recycle-page">
    <div class="recycle-toolbar">
      <label class="recycle-search">
        <Icon icon="iconoir:search" width="19" height="19" aria-hidden="true" />
        <input v-model="query" type="text" autocomplete="off" :placeholder="$t('searchRecycle')" :aria-label="$t('searchRecycle')" />
        <button v-if="query" type="button" :aria-label="$t('clear')" @click="query = ''"><Icon icon="mingcute:close-circle-fill" width="17" height="17" /></button>
      </label>
    </div>
    <el-alert v-if="expiringCount" class="expiry-alert" :title="$t('recycleExpiryNotice', { count: expiringCount })" type="warning" :closable="false" show-icon />
    <emailScroll
      ref="scroll"
      type="recycle"
      recycle-mode
      :get-email-list="getRecycleList"
      :email-restore="emailRestore"
      :email-permanent-delete="emailPermanentDelete"
      :empty-description="$t('recycleEmpty')"
      :show-account-icon="false"
      :show-star="false"
      @jump="jumpContent"
    >
      <template #first>
        <el-tooltip :content="$t('emptyRecycle')" placement="bottom">
          <button class="clear-recycle" type="button" :aria-label="$t('emptyRecycle')" @click="clearRecycle">
            <Icon icon="material-symbols:delete-sweep-outline-rounded" width="21" height="21" />
          </button>
        </el-tooltip>
      </template>
    </emailScroll>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import emailScroll from '@/components/email-scroll/index.vue'
import { emailPermanentDelete, emailRestore, recycleClear, recycleList } from '@/request/email.js'
import { useEmailStore } from '@/store/email.js'

defineOptions({ name: 'recycle' })

const { t } = useI18n()
const emailStore = useEmailStore()
const scroll = ref({})
const expiringCount = ref(0)
const query = ref('')
let expiryNotified = false
let cleanupNotified = false
let searchTimer

watch(query, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => scroll.value.refreshList(), 180)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

async function getRecycleList(emailId, size) {
  const data = await recycleList(emailId, size, 0, query.value)
  expiringCount.value = data.expiringCount || 0
  if (data.expiringCount && !expiryNotified) {
    expiryNotified = true
    ElNotification({ title: t('recycleBin'), message: t('recycleExpiryNotice', { count: data.expiringCount }), type: 'warning', position: 'top-right', duration: 5000 })
  }
  if (data.autoCleaned && !cleanupNotified) {
    cleanupNotified = true
    ElMessage({ message: t('recycleAutoCleaned', { count: data.autoCleaned }), type: 'success', plain: true })
  }
  return data
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'recycle'
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  emailStore.contentData.showUnread = false
  router.push('/message')
}

function clearRecycle() {
  ElMessageBox.confirm(t('emptyRecycleWarning'), t('permanentDeleteTitle'), {
    confirmButtonText: t('emptyRecycle'),
    confirmButtonClass: 'el-button--danger',
    cancelButtonText: t('cancel'),
    type: 'error'
  }).then(async () => {
    try {
      const data = await recycleClear()
      ElMessage({ message: t('recycleCleared', { count: data.count || 0 }), type: 'success', plain: true })
      scroll.value.refreshList()
    } catch {
      ElMessage({ message: t('permanentDeleteFailed'), type: 'error', plain: true })
    }
  })
}
</script>

<style scoped lang="scss">
.recycle-page { height: 100%; display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
.recycle-toolbar { padding: 10px 15px 0; border-bottom: 1px solid var(--el-border-color-lighter); }.recycle-search { width: min(440px, 100%); height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 10px; color: var(--el-text-color-regular); border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-fill-color-light); }.recycle-search input { width: 100%; min-width: 0; height: 100%; color: var(--el-text-color-primary); background: transparent; }.recycle-search button { display: grid; place-items: center; color: var(--secondary-text-color); }
.expiry-alert { margin: 10px 15px 0; width: auto; }
.clear-recycle { width: 30px; height: 30px; display: grid; place-items: center; color: var(--el-color-danger); border-radius: 5px; cursor: pointer; }.clear-recycle:hover, .clear-recycle:focus-visible { background: var(--el-color-danger-light-9); }
</style>
