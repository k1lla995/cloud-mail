<template>
  <el-scrollbar class="scroll">
    <div>
      <div class="title" >
        <Icon icon="mdi:email-outline" width="24" height="24" />
        <div>{{settingStore.settings.title}}</div>
      </div>
      <el-menu :collapse="false" style="margin-top: 10px">
        <el-menu-item @click="router.push({name: 'email'})" index="email"
                      :class="route.meta.name === 'email' ? 'choose-item' : ''">
          <Icon icon="hugeicons:mailbox-01" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('inbox')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'send'})" index="send" v-perm="'email:send'"
                      :class="route.meta.name === 'send' ? 'choose-item' : ''">
          <Icon icon="cil:send" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('sent')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'contact'})" index="contact"
                      :class="route.meta.name === 'contact' ? 'choose-item' : ''">
          <Icon class="contact-menu-icon" icon="fluent:person-add-20-regular" width="21" height="21" />
          <span class="menu-name" style="margin-left: 20px">{{$t('contacts')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'draft'})" index="draft" v-perm="'email:send'"
                      :class="route.meta.name === 'draft' ? 'choose-item' : ''">
          <Icon icon="ep:document" width="19" height="19" />
          <span class="menu-name" style="margin-left: 22px">{{$t('drafts')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'star'})" index="star"
                      :class="route.meta.name === 'star' ? 'choose-item' : ''">
          <Icon icon="solar:star-line-duotone" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('starred')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'setting'})" index="setting"
                      :class="route.meta.name === 'setting' ? 'choose-item' : ''">
          <Icon icon="fluent:settings-48-regular" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{$t('settings')}}</span>
        </el-menu-item>
      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";

const settingStore = useSettingStore();
const route = useRoute();

</script>

<style lang="scss" scoped>

.title {
  margin: 15px 10px;
  height: 45px;
  border-radius: 6px;
  display: flex;
  position: relative;
  font-size: 16px;
  font-weight: bold;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-dark-2));
  transition: all 0.3s ease;
  max-width: 240px;
  padding: 0 10px;
  > div {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: calc(240px - 20px - 30px);
  }

  :deep(.el-icon) {
    flex-shrink: 0;
    font-size: 20px;
  }

  .user-right-icon {
    align-self: center;
    position: absolute;
    font-size: 12px;
    right: 8px;
    color: #ffffff;
  }

}


.el-menu-item {
  margin: 5px 10px !important;
  border-radius: 6px;
  height: 36px;
  padding: 10px !important;
}

:deep(.el-menu-item.choose-item) {
  font-weight: bold;
  color: var(--aside-active-color) !important;
  background: var(--aside-active-background) !important;
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

@media (hover: hover) {
  .el-menu-item:hover {
    color: var(--aside-text-color) !important;
    background: var(--aside-item-hover) !important;
  }
}

.menu-name {
  user-select: none;
}

.contact-menu-icon {
  color: currentColor;
}


:deep(.el-scrollbar__wrap--hidden-default ) {
  background: transparent !important;
}

:deep(.el-menu-item) {
  color: var(--aside-text-color) !important;
  background: transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}

:deep(.el-menu) {
  background: transparent;
}

.el-menu {
  border-right: 0;
  width: 260px;
}

:deep(.el-divider__text) {
  background: transparent;
  color: var(--aside-text-color);
}

.scroll {
  height: 100%;
  background: var(--aside-backgound);
  border-right: 1px solid var(--aside-border-color);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}
</style>
