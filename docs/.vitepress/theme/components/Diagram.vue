<script setup lang="ts">
import { computed } from 'vue'
import { diagrams } from '../../data/diagrams'
import { useLang } from '../composables/useLang'
import DFlow from './diagrams/DFlow.vue'
import DLayers from './diagrams/DLayers.vue'
import DSequence from './diagrams/DSequence.vue'
import DLifecycle from './diagrams/DLifecycle.vue'
import DCompare from './diagrams/DCompare.vue'
import DHub from './diagrams/DHub.vue'
import DMatrix from './diagrams/DMatrix.vue'

const props = defineProps<{ id: string }>()
const { lang, t } = useLang()

const spec = computed(() => diagrams[props.id])
const payload = computed(() => (spec.value ? (spec.value as any)[lang.value] : null))
const caption = computed(() => (spec.value ? (spec.value.caption as any)[lang.value] : ''))

const views: Record<string, any> = {
  flow: DFlow,
  layers: DLayers,
  sequence: DSequence,
  lifecycle: DLifecycle,
  compare: DCompare,
  hub: DHub,
  matrix: DMatrix,
}
const view = computed(() => (spec.value ? views[spec.value.kind] : null))
</script>

<template>
  <figure v-if="spec" class="a-diagram">
    <component :is="view" v-bind="payload" />
    <figcaption class="a-diagram__caption">{{ caption }}</figcaption>
  </figure>
  <p v-else class="a-diagram__caption">{{ t('图解缺失', 'Missing diagram') }}: {{ id }}</p>
</template>
