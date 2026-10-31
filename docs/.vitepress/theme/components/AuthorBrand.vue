<script setup lang="ts">
import { withBase } from 'vitepress'
import { siteMeta } from '../../data/ecosystem'
import { useLang } from '../composables/useLang'

const { isEn } = useLang()
</script>

<template>
  <div class="a-footer__brand">
    <a class="a-footer__brandid" :href="siteMeta.authorUrl" target="_blank" rel="noreferrer">
      <img
        :src="withBase('/yuxin-logo.png')"
        alt="鱼心快跑"
        height="44"
        width="66"
        loading="lazy"
      />
      <span class="a-footer__brandtext">
        <span class="a-footer__brandname">鱼心快跑</span>
        <span class="a-footer__slogan">
          {{ isEn ? 'Yuxin Rush, Bugs Gone' : '鱼心快跑，Bug追不到' }}
        </span>
      </span>
    </a>
  </div>
</template>
