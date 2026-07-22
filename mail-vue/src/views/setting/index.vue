<template>
  <div class="box">
    <div class="container">
      <div class="title">{{$t('profile')}}</div>
      <div class="item">
        <div>{{$t('username')}}</div>
        <div>
          <span v-if="setNameShow" class="edit-name-input">
            <el-input v-model="accountName"  ></el-input>
            <span class="edit-name" @click="setName">
             {{$t('save')}}
            </span>
          </span>
          <span v-else class="user-name">
            <span >{{ userStore.user.name }}</span>
            <span class="edit-name" @click="showSetName">
             {{$t('change')}}
            </span>
          </span>
        </div>
      </div>
      <div class="item">
        <div>{{$t('emailAccount')}}</div>
        <div>{{ userStore.user.email }}</div>
      </div>
      <div class="item">
        <div>{{$t('password')}}</div>
        <div>
          <el-button type="primary" @click="pwdShow = true">{{$t('changePwdBtn')}}</el-button>
        </div>
      </div>
    </div>
    <div class="language">
      <div class="title">{{$t('language')}}</div>
      <el-select
          :model-value="langSelect"
          class="language-select"
          placeholder="Select"
          @change="changeLang"
      >
        <el-option label="中文" value="zh" @pointerdown.prevent.stop="changeLang('zh')"/>
        <el-option label="English" value="en" @pointerdown.prevent.stop="changeLang('en')"/>
      </el-select>
    </div>
    <div class="telegram-setting" v-if="telegram">
      <div class="title">Telegram 推送</div>
      <template v-if="telegram.authorized">
        <div class="telegram-status">
          <span>{{ telegram.chatId ? '已绑定私聊' : '尚未绑定私聊' }}</span>
          <el-switch :disabled="!telegram.chatId || telegramLoading" :model-value="Boolean(telegram.pushEnabled)" @change="changeTelegramPush" />
        </div>
        <div class="telegram-hint">
          1. 点击「绑定 Telegram」生成绑定链接（10 分钟内有效）<br>
          2. 点击「打开机器人绑定」，浏览器会跳转到站长配置的机器人<br>
          3. 在 Telegram 点 Start / 开始 后，回到这里打开推送开关
        </div>
        <div v-if="!telegram.botUsername" class="telegram-disabled">
          站长尚未配置机器人链接，暂时只能手动复制绑定命令。
        </div>
        <div v-if="bindingCode" class="telegram-bind-code">
          <code>/start bind_{{ bindingCode }}</code>
          <el-button size="small" @click="copyBindingCommand">复制命令</el-button>
        </div>
        <div class="telegram-actions">
          <el-button type="primary" :loading="telegramLoading" @click="createBinding">
            {{ telegram.chatId ? '重新绑定' : '绑定 Telegram' }}
          </el-button>
          <el-button
            v-if="bindingBotLink"
            type="success"
            :disabled="telegramLoading"
            @click="openBotBinding"
          >
            打开机器人绑定
          </el-button>
          <el-button v-if="telegram.chatId" :disabled="telegramLoading" @click="removeTelegramBinding">解除绑定</el-button>
        </div>
      </template>
      <div v-else class="telegram-disabled">站长尚未为该账号授权 Telegram 推送。</div>
    </div>
    <div class="del-email" v-perm="'my:delete'">
      <div class="title">{{$t('deleteUser')}}</div>
      <div style="color: var(--regular-text-color);">
        {{$t('delAccountMsg')}}
      </div>
      <div>
        <el-button type="primary" @click="deleteConfirm">{{$t('deleteUserBtn')}}</el-button>
      </div>
    </div>
    <el-dialog v-model="pwdShow" :title="$t('changePassword')" width="340">
      <div class="update-pwd">
        <el-input type="password" :placeholder="$t('newPassword')" v-model="form.password" autocomplete="off"/>
        <el-input type="password" :placeholder="$t('confirmPassword')" v-model="form.newPwd" autocomplete="off"/>
        <el-button type="primary" :loading="setPwdLoading" @click="submitPwd">{{$t('save')}}</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import {reactive, ref, defineOptions} from 'vue'
import {createTelegramBinding, resetPassword, setTelegramPush, telegramConfig, unbindTelegram, userDelete} from "@/request/my.js";
import {useUserStore} from "@/store/user.js";
import router from "@/router/index.js";
import {accountSetName} from "@/request/account.js";
import {useAccountStore} from "@/store/account.js";
import {useI18n} from "vue-i18n";
import {useSettingStore} from "@/store/setting.js";

const { t } = useI18n()
const accountStore = useAccountStore()
const settingStore = useSettingStore()
const userStore = useUserStore();
const setPwdLoading = ref(false)
const setNameShow = ref(false)
const accountName = ref(null)
const langSelect = ref(settingStore.lang)
const telegram = ref(null)
const bindingCode = ref('')
const bindingBotLink = ref('')
const telegramLoading = ref(false)

defineOptions({
  name: 'setting'
})

function showSetName() {
  accountName.value = userStore.user.name
  setNameShow.value = true
}

function setName() {

  if (!accountName.value) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameShow.value = false
  let name = accountName.value

  if (name === userStore.user.name) {
    return
  }

  userStore.user.name = accountName.value

  accountSetName(userStore.user.account.accountId,name).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })

    accountStore.changeUserAccountName = name

  }).catch(() => {
    userStore.user.name = name
  })
}

function changeLang(lang) {
  let setting = {}
  try {
    setting = JSON.parse(localStorage.getItem('setting') || '{}')
  } catch (e) {
    setting = {}
  }
  localStorage.setItem('setting', JSON.stringify({...setting, lang}))
  window.location.reload()
}

function loadTelegram() {
  telegramConfig().then(data => {
    telegram.value = data
  })
}

function createBinding() {
  telegramLoading.value = true
  createTelegramBinding().then((data) => {
    bindingCode.value = data.code
    bindingBotLink.value = data.botLink || ''
    if (telegram.value) {
      telegram.value.botUsername = data.botUsername || telegram.value.botUsername
      telegram.value.botLink = data.botUsername ? ('https://t.me/' + data.botUsername) : telegram.value.botLink
    }
    if (data.botLink) {
      ElMessage({ message: '绑定链接已生成，请点击「打开机器人绑定」', type: 'success', plain: true })
    } else {
      ElMessage({ message: '已生成绑定命令（站长尚未配置机器人链接）', type: 'warning', plain: true })
    }
  }).finally(() => {
    telegramLoading.value = false
  })
}

function openBotBinding() {
  if (!bindingBotLink.value) {
    ElMessage({ message: '暂无可用绑定链接，请先生成绑定或联系站长配置机器人', type: 'warning', plain: true })
    return
  }
  window.open(bindingBotLink.value, '_blank', 'noopener,noreferrer')
}

function copyBindingCommand() {
  navigator.clipboard.writeText('/start bind_' + bindingCode.value)
  ElMessage({ message: '绑定命令已复制，请在 10 分钟内发给机器人', type: 'success', plain: true })
}

function changeTelegramPush(enabled) {
  telegramLoading.value = true
  setTelegramPush(enabled).then(data => {
    telegram.value = data
  }).finally(() => {
    telegramLoading.value = false
  })
}

function removeTelegramBinding() {
  telegramLoading.value = true
  unbindTelegram().then(data => {
    telegram.value = data
    bindingCode.value = ''
    bindingBotLink.value = ''
  }).finally(() => {
    telegramLoading.value = false
  })
}

loadTelegram()

const pwdShow = ref(false)
const form = reactive({
  password: '',
  newPwd: '',
})

const deleteConfirm = () => {
  ElMessageBox.confirm(t('delAccountConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    userDelete().then(() => {
      localStorage.removeItem('token');
      router.replace('/login');
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  })
}


function submitPwd() {

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password.length < 6) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (form.password !== form.newPwd) {
    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  setPwdLoading.value = true
  resetPassword(form.password).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true,
    })
    pwdShow.value = false
    setPwdLoading.value = false
    form.password = ''
    form.newPwd = ''
  }).catch(() => {
    setPwdLoading.value = false
  })

}

</script>
<style scoped lang="scss">
.box {
  padding: 40px 40px;

  @media (max-width: 767px) {
    padding: 30px 30px;
  }

  .update-pwd {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .title {
    font-size: 18px;
    font-weight: bold;
  }

  .container {
    font-size: 14px;
    display: grid;
    gap: 20px;
    margin-bottom: 40px;

    .item {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 140px;
      position: relative;
      .user-name {
        display: grid;
        grid-template-columns: auto 1fr;
        span:first-child {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }

      .edit-name-input {
        position: absolute;
        bottom: -6px;
        .el-input {
          width: min(200px,calc(100vw - 222px));
        }
      }

      .edit-name {
        color: #4dabff;
        padding-left: 10px;
        cursor: pointer;
      }

      @media (max-width: 767px) {
        gap: 70px;
      }

      div:first-child {
        font-weight: bold;
      }

      div:last-child {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  .language {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 40px;

    .language-select {
      width: 100px;
    }
  }

  .telegram-setting {
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 40px;
  }

  .telegram-hint {
      color: var(--regular-text-color);
      line-height: 1.6;
      font-size: 13px;
    }

  .telegram-status, .telegram-actions, .telegram-bind-code {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .telegram-bind-code {
    padding: 10px 12px;
    border-left: 3px solid var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .telegram-bind-code code {
    overflow-wrap: anywhere;
  }

  .telegram-disabled {
    color: var(--regular-text-color);
  }

  .del-email {
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
}
</style>
