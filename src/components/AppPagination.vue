<script setup lang="ts">
const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

function pages(): (number | '...')[] {
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]

  return [1, '...', current - 1, current, current + 1, '...', total]
}
</script>

<template>
  <div class="pagination" v-if="totalPages > 1">
    <button :disabled="currentPage === 1" @click="emit('change', currentPage - 1)">‹</button>

    <template v-for="page in pages()" :key="page">
      <span v-if="page === '...'" class="dots">…</span>
      <button
        v-else
        :class="{ active: page === currentPage }"
        @click="emit('change', page)"
      >{{ page }}</button>
    </template>

    <button :disabled="currentPage === totalPages" @click="emit('change', currentPage + 1)">›</button>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 16px;
}

button {
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: 0.15s;
}

button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

button.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

button:disabled {
  opacity: 0.35;
  cursor: default;
}

.dots {
  padding: 0 4px;
  color: #9ca3af;
  font-size: 14px;
}
</style>
