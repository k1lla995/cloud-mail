<template>
  <div ref="root" class="mail-search-shell">
    <div class="mail-search-bar" :class="{ focused: open, 'has-filters': activeFilterCount }">
      <Icon class="search-icon" icon="iconoir:search" width="20" height="20" aria-hidden="true" />
      <input
        ref="input"
        v-model="filters.query"
        class="mail-search-input"
        type="search"
        autocomplete="off"
        :placeholder="t('advancedMailSearch')"
        :aria-label="t('advancedMailSearch')"
        @focus="open = true"
        @keydown.enter.prevent="openFirstResult"
        @keydown.esc="close"
      />
      <button v-if="hasSearch" class="clear-button" type="button" :aria-label="t('clear')" @click="clearAll">
        <Icon icon="mingcute:close-circle-fill" width="18" height="18" />
      </button>
      <button class="filter-button" type="button" :aria-label="t('advancedFilters')" :aria-expanded="showFilters" @click="toggleFilters">
        <Icon icon="solar:tuning-2-linear" width="20" height="20" />
        <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
      </button>
    </div>

    <Transition name="search-panel">
      <div v-if="open" class="mail-search-popover">
        <div v-if="showFilters" class="filter-grid">
          <label><span>{{ t('recipient') }}</span><input v-model="filters.recipient" type="text" autocomplete="off" :placeholder="t('searchRecipient')" /></label>
          <label><span>{{ t('sender') }}</span><input v-model="filters.sender" type="text" autocomplete="off" :placeholder="t('searchSender')" /></label>
          <label><span>{{ t('subject') }}</span><input v-model="filters.subject" type="text" autocomplete="off" :placeholder="t('searchSubject')" /></label>
          <label><span>{{ t('containsWords') }}</span><input v-model="filters.words" type="text" autocomplete="off" :placeholder="t('searchWords')" /></label>
          <label><span>{{ t('afterDate') }}</span><input v-model="filters.after" type="date" /></label>
          <label><span>{{ t('beforeDate') }}</span><input v-model="filters.before" type="date" /></label>
          <label><span>{{ t('minSize') }}</span><div class="unit-input"><input v-model="filters.minSize" min="0" step="0.1" type="number" /><b>MB</b></div></label>
          <label><span>{{ t('maxSize') }}</span><div class="unit-input"><input v-model="filters.maxSize" min="0" step="0.1" type="number" /><b>MB</b></div></label>
          <label class="attachment-filter"><span>{{ t('attachments') }}</span><select v-model="filters.hasAttachment"><option value="">{{ t('any') }}</option><option value="true">{{ t('hasAttachments') }}</option><option value="false">{{ t('noAttachments') }}</option></select></label>
        </div>

        <div v-if="hasSearch" class="search-results" :class="{ loading }">
          <div class="results-heading"><span>{{ t('matchingMessages') }}</span><span v-if="loading" class="loading-dot"></span></div>
          <button v-for="message in results" :key="message.emailId" type="button" class="search-result" @click="openMessage(message)">
            <div class="result-avatar">{{ initial(message.name || message.sendEmail) }}</div>
            <div class="result-copy"><strong>{{ message.name || message.sendEmail }}</strong><span>{{ message.subject || t('noSubject') }}</span><small>{{ message.sendEmail }} / {{ formatDate(message.createTime) }}</small></div>
            <Icon v-if="message.attList?.length" class="attachment-icon" icon="mdi:paperclip" width="17" height="17" />
          </button>
          <div v-if="!loading && !results.length" class="no-results">{{ t('noMessagesFound') }}</div>
        </div>
        <div v-else class="search-hint"><Icon icon="solar:magic-stick-3-linear" width="18" height="18" />{{ t('searchHint') }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { emailSearch } from '@/request/email.js'
import { useEmailStore } from '@/store/email.js'

const { t } = useI18n()
const router = useRouter()
const emailStore = useEmailStore()
const root = ref(null)
const input = ref(null)
const open = ref(false)
const showFilters = ref(false)
const loading = ref(false)
const results = ref([])
let debounceTimer
let requestId = 0

const filters = reactive({ query: '', recipient: '', sender: '', subject: '', words: '', after: '', before: '', minSize: '', maxSize: '', hasAttachment: '' })
const hasSearch = computed(() => Object.values(filters).some(value => value !== ''))
const activeFilterCount = computed(() => Object.entries(filters).filter(([key, value]) => key !== 'query' && value !== '').length)

watch(filters, () => {
  open.value = true
  clearTimeout(debounceTimer)
  if (!hasSearch.value) {
    results.value = []
    loading.value = false
    return
  }
  debounceTimer = setTimeout(search, 180)
}, { deep: true })

onMounted(() => document.addEventListener('pointerdown', onOutsidePointer))
onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  document.removeEventListener('pointerdown', onOutsidePointer)
})

function onOutsidePointer(event) {
  if (!root.value?.contains(event.target)) close()
}

function toggleFilters() {
  showFilters.value = !showFilters.value
  open.value = true
  nextTick(() => input.value?.focus())
}

function close() {
  open.value = false
  showFilters.value = false
}

function clearAll() {
  Object.keys(filters).forEach(key => filters[key] = '')
  results.value = []
  showFilters.value = false
  nextTick(() => input.value?.focus())
}

async function search() {
  const id = ++requestId
  loading.value = true
  try {
    const data = await emailSearch({ ...filters, limit: 8 })
    if (id === requestId) results.value = data
  } catch {
    if (id === requestId) results.value = []
  } finally {
    if (id === requestId) loading.value = false
  }
}

function openFirstResult() {
  if (results.value[0]) openMessage(results.value[0])
}

function openMessage(message) {
  emailStore.contentData.email = message
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  emailStore.contentData.showUnread = true
  close()
  router.push('/message')
}

function initial(value = '') { return value.trim().charAt(0).toUpperCase() || '?' }
function formatDate(value) { return value?.replace('T', ' ').slice(0, 16) || '' }
</script>

<style scoped lang="scss">
.mail-search-shell { position: relative; width: 100%; max-width: 720px; z-index: 120; }
.mail-search-bar { align-items: center; display: flex; height: 40px; padding: 0 7px 0 13px; border: 1px solid color-mix(in srgb, var(--el-border-color) 76%, transparent); border-radius: 8px; color: var(--regular-text-color); background: color-mix(in srgb, var(--light-ill) 86%, transparent); box-shadow: 0 6px 20px color-mix(in srgb, var(--el-text-color-primary) 7%, transparent), inset 0 1px 0 rgba(255,255,255,.24); backdrop-filter: blur(18px) saturate(145%); transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.mail-search-bar.focused { border-color: color-mix(in srgb, var(--el-color-primary) 56%, var(--el-border-color)); background: color-mix(in srgb, var(--el-bg-color) 75%, transparent); box-shadow: 0 10px 28px color-mix(in srgb, var(--el-color-primary) 14%, transparent), inset 0 1px 0 rgba(255,255,255,.3); }
.search-icon { flex: 0 0 auto; color: var(--el-text-color-regular); }
.mail-search-input { width: 100%; min-width: 0; height: 38px; padding: 0 10px; color: var(--el-text-color-primary); font-size: 14px; background: transparent; }
.mail-search-input::placeholder { color: var(--secondary-text-color); }
.clear-button, .filter-button { position: relative; width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; color: var(--regular-text-color); border-radius: 6px; cursor: pointer; transition: background .18s ease, color .18s ease; }
.clear-button:hover, .filter-button:hover { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 11%, transparent); }
.filter-count { position: absolute; top: 2px; right: 1px; min-width: 14px; height: 14px; padding: 0 3px; display: grid; place-items: center; color: #fff; background: var(--el-color-primary); border-radius: 7px; font-size: 10px; font-weight: 700; line-height: 1; }
.mail-search-popover { margin-top: 7px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--el-border-color) 72%, transparent); border-radius: 8px; color: var(--el-text-color-primary); background: color-mix(in srgb, var(--el-bg-color) 84%, transparent); box-shadow: 0 18px 48px color-mix(in srgb, #000 20%, transparent), inset 0 1px 0 rgba(255,255,255,.25); backdrop-filter: blur(24px) saturate(150%); }
.filter-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 13px; border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 72%, transparent); }
.filter-grid label { min-width: 0; display: grid; gap: 5px; color: var(--regular-text-color); font-size: 11px; font-weight: 600; }
.filter-grid input, .filter-grid select { width: 100%; min-width: 0; height: 31px; padding: 0 8px; color: var(--el-text-color-primary); border: 1px solid color-mix(in srgb, var(--el-border-color) 80%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--light-ill) 82%, transparent); }
.filter-grid input:focus, .filter-grid select:focus { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 17%, transparent); }
.unit-input { position: relative; }.unit-input input { padding-right: 29px; }.unit-input b { position: absolute; right: 8px; top: 8px; color: var(--secondary-text-color); font-size: 10px; }
.search-results { max-height: min(440px, calc(100vh - 180px)); overflow: auto; padding: 7px; }.results-heading { padding: 5px 7px 7px; display: flex; align-items: center; gap: 6px; color: var(--secondary-text-color); font-size: 11px; font-weight: 700; }.loading-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-color-primary); animation: pulse 1s ease infinite; }
.search-result { width: 100%; min-height: 56px; padding: 7px; display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 9px; text-align: left; color: inherit; border-radius: 6px; cursor: pointer; transition: background .18s ease; }.search-result:hover, .search-result:focus-visible { background: color-mix(in srgb, var(--el-color-primary) 10%, transparent); }.result-avatar { width: 32px; height: 32px; display: grid; place-items: center; color: var(--el-color-primary-dark-2); background: var(--el-color-primary-light-9); border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent); border-radius: 50%; font-size: 13px; font-weight: 700; }.result-copy { min-width: 0; display: grid; gap: 1px; }.result-copy strong, .result-copy span, .result-copy small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.result-copy strong { font-size: 13px; }.result-copy span { font-size: 12px; }.result-copy small { color: var(--secondary-text-color); font-size: 10px; }.attachment-icon { color: var(--secondary-text-color); }
.no-results, .search-hint { min-height: 70px; padding: 18px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--secondary-text-color); font-size: 12px; }.search-hint { justify-content: flex-start; }
.search-panel-enter-active, .search-panel-leave-active { transition: opacity .16s ease, transform .16s ease; }.search-panel-enter-from, .search-panel-leave-to { opacity: 0; transform: translateY(-5px); }
@keyframes pulse { 50% { opacity: .25; transform: scale(.7); } }
@media (max-width: 767px) { .mail-search-shell { max-width: none; }.filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }.mail-search-popover { position: fixed; top: 51px; left: 8px; right: 8px; }.filter-grid .attachment-filter { grid-column: span 2; } }
@media (prefers-reduced-motion: reduce) { .mail-search-bar, .clear-button, .filter-button, .search-result, .search-panel-enter-active, .search-panel-leave-active { transition: none; }.loading-dot { animation: none; } }
</style>
