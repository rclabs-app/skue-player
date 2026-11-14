<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { getDeviceMac } from '../utils/device'
import { getLegalUrl } from '../utils/portal'
import { fetchLegalManifest, getCachedLegalManifest, hasConfirmedAcceptance, submitAcceptance } from '../utils/terms'
import type { LegalManifest } from '../utils/terms'

const props = defineProps<{ modelValue?: boolean; readOnly?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'accepted'): void }>()
const isOpen = ref(!props.readOnly)
const loading = ref(false)
const isAccepting = ref(false)
const fresh = ref(false)
const error = ref('')
const manifest = ref<LegalManifest | null>(null)
const acceptBtnRef = ref<HTMLButtonElement | null>(null)
let deviceId = ''
const platform = Capacitor.isNativePlatform() ? 'android' : 'web'
let disposed = false

async function focusAction() { await nextTick(); acceptBtnRef.value?.focus() }
async function checkVersion() {
  if (loading.value || isAccepting.value) return
  loading.value = true
  error.value = ''
  fresh.value = false
  try {
    if (!props.readOnly) deviceId = await getDeviceMac()
    manifest.value = await fetchLegalManifest()
    fresh.value = true
  } catch {
    manifest.value = getCachedLegalManifest()
    error.value = 'Sem conexão com os documentos atuais. Nenhum novo aceite foi confirmado. Tente novamente.'
  } finally {
    loading.value = false
  }
  if (disposed) return
  if (!props.readOnly) {
    isOpen.value = !manifest.value || !hasConfirmedAcceptance(deviceId, platform, manifest.value.version)
  }
  if (isOpen.value || props.modelValue) await focusAction()
}
function close() { isOpen.value = false; emit('update:modelValue', false) }
function openModal() { isOpen.value = true; void checkVersion() }
defineExpose({ openModal })
async function acceptTerms() {
  if (!manifest.value || !fresh.value || isAccepting.value || loading.value || props.readOnly) return
  isAccepting.value = true
  error.value = ''
  try {
    await submitAcceptance(deviceId, platform, manifest.value.version)
    close()
    emit('accepted')
  } catch {
    error.value = 'Aceite não confirmado. Verifique a conexão e tente novamente. A tentativa será reenviada sem duplicação.'
    // Recheck the required text on the next attempt; never silently accept a new version.
    fresh.value = false
  } finally { isAccepting.value = false }
}
function onVisible() { if (document.visibilityState === 'visible') void checkVersion() }
watch(() => props.modelValue, value => { if (value) void checkVersion() })
onMounted(() => {
  if (!props.readOnly || props.modelValue) void checkVersion()
  if (!props.readOnly) {
    window.addEventListener('online', checkVersion)
    document.addEventListener('visibilitychange', onVisible)
  }
})
onUnmounted(() => {
  disposed = true
  window.removeEventListener('online', checkVersion)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen || modelValue" class="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80" data-tv-modal>
      <section role="dialog" aria-modal="true" aria-labelledby="terms-title" class="bg-[#14161a] border border-white/10 rounded-2xl max-w-3xl w-full p-6 md:p-8 flex flex-col max-h-[90vh] text-gray-200">
        <header class="pb-4 border-b border-white/10 shrink-0">
          <h2 id="terms-title" class="text-lg font-semibold text-white">Termos, privacidade e aviso legal</h2>
          <p v-if="manifest" class="text-xs text-gray-400 mt-2">{{ manifest.status }} · Versão {{ manifest.version }}</p>
          <p class="text-sm mt-2">Leia os documentos antes de continuar. O aceite se refere aos Termos de Uso; a política informa o tratamento de dados.</p>
        </header>
        <div class="flex-1 overflow-y-auto py-4 space-y-6 text-sm leading-relaxed" tabindex="0" aria-label="Documentos para leitura">
          <template v-if="manifest">
            <article v-for="(doc, key) in manifest.documents" :key="key" class="space-y-3">
              <h3 class="text-lg font-semibold text-white">{{ doc.title }}</h3>
              <a :href="getLegalUrl(key)" target="_blank" rel="noopener noreferrer" class="underline focus-visible:ring-2">Abrir {{ doc.title }} no site</a>
              <section v-for="section in doc.sections" :key="section.title">
                <h4 class="font-semibold text-white">{{ section.title }}</h4>
                <p class="text-gray-300">{{ section.text }}</p>
              </section>
            </article>
          </template>
          <p v-else>{{ loading ? 'Consultando documentos…' : 'Os documentos precisam ser carregados para continuar.' }}</p>
        </div>
        <p v-if="error" role="alert" class="text-sm text-amber-200 py-3">{{ error }}</p>
        <footer class="pt-4 border-t border-white/10 flex flex-wrap justify-end gap-3 shrink-0">
          <button v-if="readOnly" ref="acceptBtnRef" type="button" @click="close" class="px-6 py-2 rounded bg-white text-black focus-visible:ring-2 focus-visible:ring-primary">Fechar</button>
          <button v-if="!fresh" ref="acceptBtnRef" type="button" :disabled="loading || isAccepting" @click="checkVersion" class="px-6 py-2 rounded bg-white text-black focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{{ loading ? 'Consultando…' : 'Tentar conexão' }}</button>
          <button v-if="!readOnly && fresh" ref="acceptBtnRef" type="button" :disabled="loading || isAccepting" @click="acceptTerms" class="px-6 py-2 rounded bg-white text-black focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{{ isAccepting ? 'Confirmando…' : 'Concordar com os Termos e continuar' }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
