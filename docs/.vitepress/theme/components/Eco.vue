<script setup lang="ts">
import { ecosystem } from '../../data/ecosystem'
import { useLang } from '../composables/useLang'

const { t } = useLang()
</script>

<template>
  <div class="a-eco">
    <a
      v-for="item in ecosystem"
      :key="item.key"
      class="a-eco__card"
      :class="{ 'is-current': item.current }"
      :href="item.url"
      :target="item.current ? undefined : '_blank'"
      rel="noreferrer"
    >
      <span class="a-eco__glyph">{{ item.glyph }}</span>
      <span class="a-eco__body">
        <span class="a-eco__name">
          {{ item.name }}
          <span v-if="item.current" class="a-eco__here">{{ t('你在这里', 'you are here') }}</span>
        </span>
        <span class="a-eco__role">{{ t(item.zhRole, item.enRole) }}</span>
        <span class="a-eco__desc">{{ t(item.zhDesc, item.enDesc) }}</span>
      </span>
    </a>
  </div>
</template>
