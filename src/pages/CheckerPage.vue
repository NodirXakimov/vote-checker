<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import AppPagination from '@/components/AppPagination.vue'
import { formatDateTime } from "@/utils/formatDateTime.ts";

// ── adjust these to match your Supabase table ──────────────────────────────
const TABLE = 'votes'
const COL_PHONE = 'phone_number'
const COL_DATE = 'vote_date'
const PAGE_SIZE = 10
// ───────────────────────────────────────────────────────────────────────────

interface Row {
  id: number
  [key: string]: unknown
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

let debounceTimer: ReturnType<typeof setTimeout>

async function fetchAllCount() {
  loadingAll.value = true
  const { count } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })

  allCount.value = count ?? 0
  allTotalPages.value = Math.ceil((count ?? 0) / PAGE_SIZE)
  loadingAll.value = false
}

async function fetchData() {
  loading.value = true

  const from = (currentPage.value - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let req = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order(COL_DATE, { ascending: false })
    .range(from, to)

  const formatted = formatPhoneQuery(query.value)
  if (formatted) {
    req = req.ilike(COL_PHONE, `%${formatted}%`)
  }

  const { data, count, error } = await req

  if (!error) {
    rows.value = (data as Row[]) ?? []
    filteredCount.value = count ?? 0
    totalPages.value = Math.ceil((count ?? 0) / PAGE_SIZE)
  }

  loading.value = false
}

watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    fetchData()
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

// Groups digits into pairs joined by dashes to match stored format (e.g. "5518" → "55-18")
function formatPhoneQuery(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  return digits.match(/.{1,2}/g)!.join('-')
}

function highlightMatch(text: string): string {
  const q = formatPhoneQuery(query.value)
  if (!q) return text
  return text.replace(new RegExp(`(${q.replace(/[-]/g, '\\-')})`, 'gi'), '<mark class="highlight">$1</mark>')
}

</script>

<template>
  <div class="page-wrapper">
    <header>
      <h1>📞 Телефон рақамлар</h1>
      <h2>(Гулистон МФЙ)</h2>
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
          <tr v-if="loading">
            <td colspan="3" class="loading-cell">
              <span class="spinner"></span>
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="3" style="text-align:center; color:#9ca3af">Маълумот топилмади</td>
          </tr>
          <tr v-else v-for="(row, index) in rows" :key="row.id">
            <td>{{ (currentPage - 1) * 10 + index + 1 }}</td>
            <td v-html="highlightMatch(String(row[COL_PHONE] ?? ''))"></td>
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

:deep(.highlight) {
  background: #fde68a;
  padding: 2px 3px;
  border-radius: 3px;
}

@media (max-width: 600px) {

  th:nth-child(1),
  td:nth-child(1) {
    display: none;
  }

  h1 {
    font-size: 20px;
  }

}

</style>
