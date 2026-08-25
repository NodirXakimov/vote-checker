<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineController,
  BarController,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type Plugin,
} from 'chart.js'
import { fetchStats, toCumulative, toDaily, type StatsData } from '@/lib/stats'
import { assignColors, OTHER_COLOR, TRACK_COLOR } from '@/lib/palette'
import { INITIATIVE_ID } from '@/lib/config'

ChartJS.register(
  LineController, BarController, LineElement, PointElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
)

const data = ref<StatsData | null>(null)
const loading = ref(false)
const errorMsg = ref('')
// '' = every day (the default view).
const selectedDay = ref('')

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    data.value = await fetchStats()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
  loading.value = false
}

onMounted(load)

// -- derived ----------------------------------------------------------------

const initiatives = computed(() => data.value?.initiatives ?? [])

const ranked = computed(() =>
  [...initiatives.value].sort((a, b) => b.total - a.total)
)

// The palette has eight validated slots and a 9th hue would be indistinguishable
// from an existing one under colorblindness. Past that the charts show the top
// eight by total (ours always among them) and the table below carries everyone.
const CHART_LIMIT = 8

const chartIds = computed(() => {
  const top = ranked.value.slice(0, CHART_LIMIT).map((i) => i.id)
  const mine = ours.value?.id
  if (mine && !top.includes(mine)) top[CHART_LIMIT - 1] = mine
  return top
})

const availableDays = computed(() => {
  const days = new Set((data.value?.hourly ?? []).map((h) => h.hour.slice(0, 10)))
  return [...days].sort().reverse()
})

// A refresh can retire the selected day; fall back to the full view rather than
// rendering an empty chart.
watch(availableDays, (days) => {
  if (selectedDay.value && !days.includes(selectedDay.value)) selectedDay.value = ''
})

// Per-day counts for the table. Unlike the charts this covers every initiative.
const tableDaily = computed(() => {
  if (!data.value) return { days: [] as string[], byKey: new Map<string, number>() }
  const ids = initiatives.value.map((i) => i.id)
  const result = toDaily(data.value.hourly, ids)
  const byKey = new Map<string, number>()
  result.series.forEach((serie) => {
    serie.points.forEach((votes, i) => {
      byKey.set(serie.id + '|' + result.days[i], votes)
    })
  })
  return { days: result.days, byKey }
})

function dayVotes(id: string, day: string): number {
  return tableDaily.value.byKey.get(id + '|' + day) ?? 0
}

const dayPeak = computed(() =>
  Math.max(1, ...[...tableDaily.value.byKey.values()])
)

// Magnitude reads as tint intensity, one hue. A flat "positive" green would be
// the same on every cell and carry no information -- nothing here is ever negative.
function dayTint(value: number): string {
  if (!value) return 'transparent'
  const alpha = 0.06 + (value / dayPeak.value) * 0.26
  return 'rgba(42, 120, 214, ' + alpha.toFixed(3) + ')'
}

const hiddenCount = computed(() => Math.max(0, initiatives.value.length - chartIds.value.length))

// Slots are pinned by sorted id within the charted set, so re-sorting the ranking
// never repaints a series.
const colors = computed(() => assignColors(chartIds.value))

function colorOf(id: string): string {
  return colors.value[id] ?? OTHER_COLOR
}

const maxTotal = computed(() =>
  Math.max(1, ...initiatives.value.map((i) => i.total))
)

const leader = computed(() => ranked.value[0] ?? null)

const anyIncomplete = computed(() => initiatives.value.some((i) => !i.complete))

const ours = computed(() => initiatives.value.find((i) => i.id === INITIATIVE_ID) ?? null)

const ourRank = computed(() => {
  const mine = ours.value
  if (!mine) return null
  return ranked.value.findIndex((i) => i.id === mine.id) + 1
})

function shortHour(hour: string): string {
  const d = new Date(hour)
  if (isNaN(d.getTime())) return hour
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  return dd + '.' + mm + ' ' + hh + ':00'
}

function shortDay(day: string): string {
  const parts = day.split('-')
  return parts[2] + '.' + parts[1]
}

function labelOf(id: string): string {
  const found = initiatives.value.find((i) => i.id === id)
  return found ? found.label : id.slice(0, 8)
}

// Draws each series name at its final point. Direct labels are required relief
// for the palette slots that fall below 3:1 contrast on a light surface.
// The text itself wears an ink token; a colored dot beside it carries identity.
const lastPointLabels: Plugin<'line'> = {
  id: 'lastPointLabels',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx
    ctx.save()
    ctx.font = '500 11px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    const entries: { x: number; y: number; text: string; color: string }[] = []
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return
      const last = meta.data[meta.data.length - 1]
      if (!last) return

      entries.push({
        x: last.x,
        y: last.y,
        text: String(ds.label || ''),
        color: (ds.borderColor as string) || '#374151',
      })
    })

    // Lines that end close together would stack their labels on top of each
    // other, so push them apart top-down and pull the overflow back up.
    const GAP = 15
    const top = chart.chartArea.top + 6
    const bottom = chart.chartArea.bottom - 6
    entries.sort((a, b) => a.y - b.y)
    entries.forEach((e, i) => {
      const prev = entries[i - 1]
      e.y = Math.max(e.y, top, prev ? prev.y + GAP : top)
    })
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (!e) continue
      const next = entries[i + 1]
      const ceiling = next ? next.y - GAP : bottom
      if (e.y > ceiling) e.y = ceiling
    }

    entries.forEach((e) => {
      ctx.fillStyle = e.color
      ctx.beginPath()
      ctx.arc(e.x + 12, e.y, 3.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#374151'
      ctx.fillText(e.text, e.x + 20, e.y)
    })
    ctx.restore()
  },
}

// Value on top of each bar. Skipped for zero (nothing to report) and for bars
// too narrow to hold the number without colliding with their neighbour.
const barValueLabels: Plugin<'bar'> = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx
    ctx.save()
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return
      meta.data.forEach((bar, j) => {
        const value = Number((ds.data as number[])[j] ?? 0)
        if (!value) return
        const width = (bar as unknown as { width?: number }).width ?? 0
        if (width && width < 16) return
        ctx.fillText(value.toLocaleString('uz-UZ'), bar.x, bar.y - 4)
      })
    })
    ctx.restore()
  },
}

const cumulative = computed(() => {
  if (!data.value) return { labels: [] as string[], datasets: [] }
  const result = toCumulative(data.value.hourly, chartIds.value)
  return {
    labels: result.hours.map(shortHour),
    datasets: result.series.map((s) => ({
      label: labelOf(s.id),
      data: s.points,
      borderColor: colorOf(s.id),
      backgroundColor: colorOf(s.id),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.25,
    })),
  }
})

const daily = computed(() => {
  if (!data.value) return { labels: [] as string[], datasets: [] }
  const result = toDaily(data.value.hourly, chartIds.value)

  const keep = selectedDay.value
    ? result.days.map((d) => d === selectedDay.value)
    : result.days.map(() => true)

  return {
    labels: result.days.filter((_, i) => keep[i]).map(shortDay),
    datasets: result.series.map((s) => ({
      label: labelOf(s.id),
      data: s.points.filter((_, i) => keep[i]),
      backgroundColor: colorOf(s.id),
      borderRadius: 4,
      // 2px surface gap between adjacent bars.
      borderColor: '#ffffff',
      borderWidth: { top: 0, right: 1, bottom: 0, left: 1 },
    })),
  }
})

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 96 } },
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } },
    },
    tooltip: { padding: 10, boxPadding: 4 },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, autoSkip: true, maxRotation: 0, font: { size: 11 }, color: '#6b7280' },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: '#f1f2f6' },
      ticks: { maxTicksLimit: 10, font: { size: 11 }, color: '#6b7280' },
    },
  },
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 22 } },
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } },
    },
    tooltip: { padding: 10, boxPadding: 4 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#6b7280' } },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: '#f1f2f6' },
      ticks: { font: { size: 11 }, color: '#6b7280' },
    },
  },
}

function pct(value: number, of: number): string {
  return Math.round((value / Math.max(1, of)) * 100) + '%'
}

function formatStamp(value: string): string {
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleString('uz-UZ')
}
</script>

<template>
  <div class="page-wrapper">
    <header>
      <h1>
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Статистика</span>
      </h1>
      <div class="sub-row">
        <span v-if="data && data.lastScrapedAt" class="muted">
          Янгиланди: {{ formatStamp(data.lastScrapedAt) }}
        </span>
        <button class="ghost-btn" :disabled="loading" @click="load">Янгилаш</button>
      </div>
    </header>

    <div v-if="errorMsg" class="card error-card">
      <p class="error-title">Статистика юкланмади</p>
      <p class="error-hint">{{ errorMsg }}</p>
      <p class="error-hint">
        Кўринишлар яратилмаган бўлса, <code>db/stats.sql</code> ни ишга туширинг.
      </p>
    </div>

    <div v-else-if="loading && !data" class="card loading-card">
      <span class="spinner"></span>
    </div>

    <template v-else-if="data">
      <!-- The scraper backfills history, so a partial initiative's totals and its
           past hours both keep moving. Saying so beats a silently wrong chart. -->
      <div v-if="anyIncomplete" class="notice">
        <strong>Маълумотлар тўлиқ эмас.</strong>
        Айрим ташаббуслар ҳали юкланмоқда — уларнинг сонлари ва тарихи ўзгариб туради.
      </div>

      <div v-if="ours" class="kpi-row">
        <div class="kpi">
          <span class="kpi-label">Бизнинг ташаббус</span>
          <span class="kpi-value">{{ ours.total.toLocaleString('uz-UZ') }}</span>
          <span class="kpi-sub">{{ ours.label }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Ўрин</span>
          <span class="kpi-value">{{ ourRank }} / {{ initiatives.length }}</span>
          <span class="kpi-sub">жами овозлар бўйича</span>
        </div>
        <div v-if="leader" class="kpi">
          <span class="kpi-label">Етакчи</span>
          <span class="kpi-value">{{ leader.total.toLocaleString('uz-UZ') }}</span>
          <span class="kpi-sub">{{ leader.label }}</span>
        </div>
      </div>

      <!-- Ranking as plain HTML bars rather than a chart, so every value carries a
           visible label and the collected/total split stays legible. -->
      <section class="card">
        <h2>Жами овозлар</h2>
        <p class="card-hint">Тўлиқ узунлик — скрапер аниқлаган умумий сон.</p>
        <div class="rank-list">
          <div v-for="(item, index) in ranked" :key="item.id" class="rank-row">
            <div class="rank-head">
              <span class="rank-name">
                <span class="rank-num">{{ index + 1 }}</span>
                <span class="swatch" :style="{ background: colorOf(item.id) }"></span>
                {{ item.label }}
                <span v-if="item.id === INITIATIVE_ID" class="tag">биз</span>
              </span>
              <span class="rank-value">{{ item.total.toLocaleString('uz-UZ') }}</span>
            </div>
            <div class="track" :style="{ '--track': TRACK_COLOR }">
              <div
                class="track-total"
                :style="{
                  width: pct(item.total, maxTotal),
                  background: colorOf(item.id),
                  opacity: item.complete ? 1 : 0.28,
                }"
              ></div>
              <div
                v-if="!item.complete"
                class="track-collected"
                :style="{ width: pct(item.collected, maxTotal), background: colorOf(item.id) }"
              ></div>
            </div>
            <p v-if="!item.complete" class="rank-note">
              {{ item.collected.toLocaleString('uz-UZ') }} та юкланди
              ({{ pct(item.collected, item.total) }}) — юкланмоқда
            </p>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Вақт бўйича ўсиш</h2>
        <p class="card-hint">
          Соатлик кесимда тўпланган йиғинди.
          <template v-if="hiddenCount"> Энг кўп овозли {{ chartIds.length }} та ташаббус кўрсатилган; қолган {{ hiddenCount }} таси қуйидаги жадвалда.</template>
        </p>
        <div class="chart-box chart-box--tall">
          <Line :data="cumulative" :options="lineOptions" :plugins="[lastPointLabels]" />
        </div>
      </section>

      <section class="card">
        <h2>Кунлик овозлар</h2>
        <p class="card-hint">
          Ҳар куни нечта овоз қўшилгани.
          <template v-if="hiddenCount"> Энг кўп овозли {{ chartIds.length }} та ташаббус кўрсатилган.</template>
        </p>
        <!-- Filters sit in one row directly above the chart they act on. -->
        <div class="filter-row">
          <button
            class="chip"
            :class="{ active: selectedDay === '' }"
            @click="selectedDay = ''"
          >Барчаси</button>
          <button
            v-for="day in availableDays"
            :key="day"
            class="chip"
            :class="{ active: selectedDay === day }"
            @click="selectedDay = day"
          >{{ shortDay(day) }}</button>
        </div>
        <div class="chart-box">
          <Bar :data="daily" :options="barOptions" :plugins="[barValueLabels]" />
        </div>
      </section>

      <section class="card">
        <h2>Жадвал</h2>
        <p class="card-hint">Шу билан бирга барча сонлар.</p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-name">Ташаббус</th>
                <th>Жами</th>
                <th>Юкланди</th>
                <th>Ҳолат</th>
                <th v-for="day in tableDaily.days" :key="day" class="col-day">
                  {{ shortDay(day) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in ranked" :key="item.id">
                <td class="col-num">{{ index + 1 }}</td>
                <td class="col-name">
                  <span class="swatch" :style="{ background: colorOf(item.id) }"></span>
                  {{ item.label }}
                </td>
                <td>{{ item.total.toLocaleString('uz-UZ') }}</td>
                <td>{{ item.collected.toLocaleString('uz-UZ') }}</td>
                <td>{{ item.complete ? 'Тўлиқ' : 'Юкланмоқда' }}</td>
                <td
                  v-for="day in tableDaily.days"
                  :key="day"
                  class="col-day"
                  :style="{ background: dayTint(dayVotes(item.id, day)) }"
                >
                  <span v-if="dayVotes(item.id, day)" class="day-gain">
                    +{{ dayVotes(item.id, day).toLocaleString('uz-UZ') }}
                  </span>
                  <span v-else class="day-zero">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-wrapper {
  max-width: 1140px;
  margin: auto;
}

header {
  margin-bottom: 16px;
}

h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 22px;
}

.title-icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}

.sub-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.muted {
  font-size: 13px;
  color: #6b7280;
}

.ghost-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #374151;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.15s;
}

.ghost-btn:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.ghost-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.card h2 {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.card-hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 2px 0 14px;
}

.notice {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #92400e;
  margin-bottom: 16px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.kpi-label {
  font-size: 12px;
  color: #9ca3af;
}

.kpi-value {
  font-size: 26px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.kpi-sub {
  font-size: 12px;
  color: #6b7280;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rank-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.rank-name {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 17px;
  color: #374151;
}

/* Swatch scales with the larger name text; the table's stays as it was. */
.rank-name .swatch {
  width: 12px;
  height: 12px;
}

.rank-value {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

.rank-num {
  min-width: 22px;
  font-size: 15px;
  font-weight: 600;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}

.col-num {
  width: 1%;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
}

.track {
  position: relative;
  height: 14px;
  background: var(--track);
  border-radius: 6px;
  overflow: hidden;
}

.track-total,
.track-collected {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 6px;
}

.rank-note {
  font-size: 14px;
  color: #9ca3af;
  margin-top: 6px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.chip {
  padding: 5px 11px;
  font-size: 13px;
  color: #6b7280;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  cursor: pointer;
  transition: 0.15s;
  font-variant-numeric: tabular-nums;
}

.chip:hover:not(.active) {
  border-color: #2563eb;
  color: #2563eb;
}

.chip.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.chart-box {
  position: relative;
  height: 340px;
}

/* The cumulative chart carries a direct label per series, so it needs more
   vertical room before those labels start colliding. */
.chart-box--tall {
  height: 460px;
}

.table-scroll {
  overflow-x: auto;
  margin-top: 14px;
}

/* Day columns push the table past the card width, so identity stays pinned
   while the daily figures scroll under it. */
.col-name {
  position: sticky;
  left: 0;
  z-index: 1;
  background: white;
}

.col-day {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.day-gain {
  color: #1f2937;
  font-weight: 500;
}

.day-zero {
  color: #d1d5db;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}

th {
  font-weight: 500;
  color: #6b7280;
}

td .swatch {
  display: inline-block;
  margin-right: 6px;
}

.loading-card {
  display: flex;
  justify-content: center;
  padding: 40px;
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

.error-card {
  text-align: center;
}

.error-title {
  font-size: 15px;
  font-weight: 500;
  color: #b91c1c;
  margin-bottom: 4px;
}

.error-hint {
  font-size: 13px;
  color: #9ca3af;
  word-break: break-word;
}

.error-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #f3f4f6;
  padding: 1px 5px;
  border-radius: 4px;
}

@media (max-width: 600px) {
  /* Shares a row with the absolutely positioned burger button. */
  h1 {
    min-height: 40px;
    padding: 0 48px;
    font-size: 18px;
  }

  .kpi-row {
    grid-template-columns: 1fr;
  }

  .kpi {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px;
  }

  .kpi-value {
    font-size: 20px;
  }

  .rank-name {
    font-size: 15px;
  }

  .rank-value {
    font-size: 17px;
  }

  .chart-box {
    height: 240px;
  }

  .chart-box--tall {
    height: 340px;
  }
}
</style>
