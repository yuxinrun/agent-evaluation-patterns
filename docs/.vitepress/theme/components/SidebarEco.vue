<script setup lang="ts">
import { ecosystem } from '../../data/ecosystem'
import { useLang } from '../composables/useLang'

const { t } = useLang()
</script>

<template>
  <div class="a-sideeco">
    <div class="a-sideeco__t">{{ t('同一套企业 AI 技术栈', 'One enterprise AI stack') }}</div>
    <a
      v-for="item in ecosystem"
      :key="item.key"
      class="a-sideeco__link"
      :class="{ 'is-current': item.current }"
      :href="item.url"
      :target="item.current ? undefined : '_blank'"
      rel="noreferrer"
    >
      <span class="a-sideeco__dot"></span>
      <span>{{ item.name }}</span>
    </a>
  </div>
</template>
