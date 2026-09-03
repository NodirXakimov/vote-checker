<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signIn, isSignedIn } from '@/lib/auth'
import { INITIATIVE_NAME } from '@/lib/config'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const errorMsg = ref('')

// Where the guard wanted to go before it redirected here.
function target(): string {
  const to = route.query.redirect
  return typeof to === 'string' && to.startsWith('/') ? to : '/'
}

// Landing on /login with a live session (bookmark, back button) is not an error
// state -- just leave.
onMounted(() => {
  if (isSignedIn.value) router.replace(target())
})

async function onSubmit() {
  if (submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    await signIn(email.value.trim(), password.value)
    await router.replace(target())
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-wrapper">
    <h1>Кириш</h1>
    <p class="subtitle">{{ INITIATIVE_NAME }}</p>

    <form class="card" @submit.prevent="onSubmit">
      <label class="field">
        <span>Email</span>
        <input
          v-model="email"
          type="email"
          autocomplete="username"
          required
          :disabled="submitting"
        />
      </label>

      <label class="field">
        <span>Парол</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          :disabled="submitting"
        />
      </label>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Кирилмоқда…' : 'Кириш' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.page-wrapper {
  max-width: 380px;
  margin: auto;
}

h1 {
  font-size: 22px;
  text-align: center;
  margin-bottom: 4px;
}

.subtitle {
  margin: 0 0 20px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: #6b7280;
}

.field input {
  padding: 10px 12px;
  font-size: 15px;
  color: #111827;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  outline: none;
  transition: 0.15s;
}

.field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

button {
  padding: 11px 16px;
  font-size: 15px;
  font-weight: 500;
  color: white;
  background: #2563eb;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.15s;
}

button:hover:not(:disabled) {
  background: #1d4ed8;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  margin: 0;
  font-size: 14px;
  color: #b91c1c;
}

@media (max-width: 600px) {
  /* No burger on this page (the nav is hidden while signed out), but the title
     keeps the same height so the layout does not jump after signing in. */
  h1 {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 48px;
    font-size: 18px;
  }
}
</style>
