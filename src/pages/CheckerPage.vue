<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import AppPagination from '@/components/AppPagination.vue'
import { formatDateTime } from '@/utils/formatDateTime'
import { INITIATIVE_ID, INITIATIVE_NAME } from '@/lib/config'

// -- adjust these to match your Supabase table ------------------------------
const TABLE = 'votes'
const COL_PHONE = 'phone_number'
const COL_DATE = 'vote_date'
const COL_INITIATIVE = 'initiative_id'
const PAGE_SIZE = 10
// ---------------------------------------------------------------------------

interface Row {
  id: number
  [key: string]: unknown
}

interface Part {
  text: string
  match: boolean
}

const query = ref('')
const rows = ref<Row[]>([])
const allCount = ref(0)
const filteredCount = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const loadingAll = ref(false)
const allTotalPages = ref(0)
const totalPages = ref(0)
const errorMsg = ref('')

let debounceTimer: ReturnType<typeof setTimeout>
// Incremented per request so a slow earlier response cannot overwrite a newer one.
let requestId = 0

async function fetchAllCount() {
  loadingAll.value = true
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq(COL_INITIATIVE, INITIATIVE_ID)

  if (error) {
    errorMsg.value = error.message
  } else {
    allCount.value = count ?? 0
    allTotalPages.value = Math.ceil((count ?? 0) / PAGE_SIZE)
  }
  loadingAll.value = false
}

async function fetchData() {
  const id = ++requestId
  loading.value = true
  errorMsg.value = ''

  const from = (currentPage.value - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let req = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq(COL_INITIATIVE, INITIATIVE_ID)
    .order(COL_DATE, { ascending: false })
    .range(from, to)

  const candidates = phoneQueryCandidates(query.value)
  if (candidates.length) {
    req = req.or(candidates.map((c) => `${COL_PHONE}.ilike.%${c}%`).join(','))
  }

  const { data, count, error } = await req

  // A newer request started while this one was in flight -- discard this result.
  if (id !== requestId) return

  if (error) {
    errorMsg.value = error.message
    rows.value = []
    filteredCount.value = 0
    totalPages.value = 0
  } else {
    rows.value = (data as Row[]) ?? []
    filteredCount.value = count ?? 0
    totalPages.value = Math.ceil((count ?? 0) / PAGE_SIZE)
  }

  loading.value = false
}

watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    // Resetting the page triggers the currentPage watcher, which fetches.
    // Only fetch directly when already on page 1, otherwise we fire twice.
    if (currentPage.value !== 1) {
      currentPage.value = 1
    } else {
      fetchData()
    }
  }, 400)
})

watch(currentPage, fetchData)

onMounted(() => {
  fetchAllCount()
  fetchData()
})

function onPageChange(page: number) {
  currentPage.value = page
}

// Numbers are stored as dash-separated digit pairs (e.g. "90-12-34-56"), so a
// typed substring can start on either an even or an odd offset. Build both
// alignments and match either one.
function phoneQueryCandidates(input: string): string[] {
  const digits = input.replace(/\D/g, '')
  if (!digits) return []

  const even = digits.match(/.{1,2}/g)!.join('-')
  if (digits.length === 1) return [even]

  const odd = digits[0] + '-' + digits.slice(1).match(/.{1,2}/g)!.join('-')
  return even === odd ? [even] : [even, odd]
}

// Splits text into matched/unmatched parts so the template can render <mark>
// elements without v-html (which would inject unescaped database text).
function highlightParts(text: string): Part[] {
  const candidates = phoneQueryCandidates(query.value)
  const needle = candidates.find((c) => text.includes(c))
  if (!needle) return [{ text, match: false }]

  const parts: Part[] = []
  let i = 0
  for (;;) {
    const idx = text.indexOf(needle, i)
    if (idx === -1) break
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false })
    parts.push({ text: needle, match: true })
    i = idx + needle.length
  }
  if (i < text.length) parts.push({ text: text.slice(i), match: false })
  return parts
}

</script>

<template>
  <div class="page-wrapper">
    <header>
      <h1>📞 Телефон рақамлар</h1>
      <h2>({{ INITIATIVE_NAME || 'Нишон тумани, Гулистон МФЙ' }})</h2>
      <div class="stats">
        <span>Жами: <span v-if="loadingAll" class="stat-loading">...</span><template v-else>{{ allCount }}</template></span>
        <span v-if="query">Топилди: <span v-if="loading" class="stat-loading">...</span><template v-else>{{ filteredCount }}</template></span>
      </div>
    </header>

    <div class="search-box">
      <label for="searchInput" style="visibility: hidden"></label>
      <input
        id="searchInput"
        v-model="query"
        type="tel"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="Телефон рақам бўйича қидириш..."
      />
      <button v-if="query" class="clear-btn" @click="query = ''" aria-label="Тозалаш">✕</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Телефон рақам</th>
            <th>Сана</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="errorMsg">
            <td colspan="3" class="error-cell">
              <p class="error-title">Хатолик юз берди</p>
              <p class="error-hint">{{ errorMsg }}</p>
            </td>
          </tr>
          <tr v-else-if="loading">
            <td colspan="3" class="loading-cell">
              <span class="spinner"></span>
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="3" class="empty-cell">
              <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                <p class="empty-title">Маълумот топилмади</p>
                <p v-if="query" class="empty-hint">«{{ query }}» бўйича натижа йўқ</p>
              </div>
            </td>
          </tr>
          <tr v-else v-for="(row, index) in rows" :key="row.id">
            <td>{{ (currentPage - 1) * PAGE_SIZE + index + 1 }}</td>
            <td>
              <template v-for="(part, i) in highlightParts(String(row[COL_PHONE] ?? ''))" :key="i"
                ><mark v-if="part.match" class="highlight">{{ part.text }}</mark
                ><template v-else>{{ part.text }}</template
              ></template>
            </td>
            <td>{{ formatDateTime(String(row[COL_DATE] ?? '')) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppPagination :current-page="currentPage" :total-pages="totalPages" @change="onPageChange" />
  </div>
</template>

<style scoped>

.page-wrapper {
  max-width: 900px;
  margin: auto;
}

header {
  margin-bottom: 20px;
}

h1 {
  font-size: 22px;
  text-align: center;
}

h2 {
  font-size: 16px;
  text-align: center;
  margin-bottom: 10px;
  color: #2563eb;
}

.stats {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #6b7280;
}

.stat-loading {
  display: inline-block;
  color: #d1d5db;
  letter-spacing: 2px;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.loading-cell {
  text-align: center;
  padding: 32px !important;
}

.spinner {
  display: inline-block;
  width: 28px;
  height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}


.search-box {
  position: relative;
  margin-bottom: 15px;
}

.search-box input {
  width: 100%;
  padding: 14px 44px 14px 14px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-size: 16px;
  transition: 0.2s;
  background-color: white;
}

.clear-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  border-radius: 50%;
  transition: 0.15s;
}

.clear-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.search-box input:focus {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.table-wrapper {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f9fafb;
}

th, td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

tbody tr:hover {
  background: #f8fafc;
}

.highlight {
  background: #fde68a;
  padding: 2px 3px;
  border-radius: 3px;
}

.empty-cell {
  padding: 40px 14px !important;
}

.error-cell {
  padding: 32px 14px !important;
  text-align: center;
}

.error-title {
  font-size: 15px;
  font-weight: 500;
  color: #b91c1c;
  margin: 0 0 4px;
}

.error-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  word-break: break-word;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: #d1d5db;
  margin-bottom: 4px;
}

.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
  margin: 0;
}

.empty-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

@media (max-width: 600px) {

  th:nth-child(1),
  td:nth-child(1):not(.loading-cell):not(.empty-cell) {
    display: none;
  }

  /* Sits beside the absolutely positioned burger button; the side padding keeps
     long titles from sliding under it. */
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
