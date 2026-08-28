import { supabase } from '@/lib/supabase'

// These read the aggregate views created by db/stats.sql. They deliberately do
// not touch `votes` — once RLS is locked to one initiative the raw rows are not
// readable anyway, and aggregates never expose a phone number.
const V_INFO = 'initiative_info'
const V_TOTALS = 'vote_stats_totals'
const V_HOURLY = 'vote_stats_hourly'

export interface InitiativeInfo {
  initiative_id: string
  label: string
  total_elements: number
  is_initial_done: boolean
  last_scraped_at: string | null
}

export interface VoteTotal {
  initiative_id: string
  votes: number
  first_vote: string
  last_vote: string
}

export interface HourlyBucket {
  initiative_id: string
  hour: string
  votes: number
}

export interface Initiative {
  id: string
  label: string
  /** Rows actually present in `votes`. */
  collected: number
  /** True population size reported by the scraper. */
  total: number
  complete: boolean
  lastVote: string | null
}

export interface StatsData {
  initiatives: Initiative[]
  hourly: HourlyBucket[]
  lastScrapedAt: string | null
}

/**
 * PostgREST caps a response at 1000 rows and returns the first page silently —
 * no error, no flag. `vote_stats_hourly` passed that cap, so an unpaged
 * ascending fetch dropped the newest buckets and the chart looked like voting
 * had stopped. Page through explicitly instead.
 *
 * Ordered by (hour, initiative_id): hour alone has ties, and ties reorder
 * between requests, which would duplicate some buckets and skip others.
 */
const PAGE_SIZE = 1000

async function fetchAllHourly(): Promise<HourlyBucket[]> {
  const rows: HourlyBucket[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(V_HOURLY)
      .select('*')
      .order('hour', { ascending: true })
      .order('initiative_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    const page = (data ?? []) as HourlyBucket[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function fetchStats(): Promise<StatsData> {
  const [info, totals, hourly] = await Promise.all([
    supabase.from(V_INFO).select('*'),
    supabase.from(V_TOTALS).select('*'),
    fetchAllHourly(),
  ])

  const failed = [info, totals].find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)

  const totalsById = new Map(
    ((totals.data ?? []) as VoteTotal[]).map((t) => [t.initiative_id, t])
  )

  const initiatives: Initiative[] = ((info.data ?? []) as InitiativeInfo[]).map((i) => {
    const t = totalsById.get(i.initiative_id)
    const collected = t?.votes ?? 0
    return {
      id: i.initiative_id,
      label: i.label,
      collected,
      // total_elements is what the scraper says exists. Fall back to the
      // collected count if it is missing, never the other way round.
      total: i.total_elements ?? collected,
      complete: i.is_initial_done,
      lastVote: t?.last_vote ?? null,
    }
  })

  const lastScrapedAt = ((info.data ?? []) as InitiativeInfo[])
    .map((i) => i.last_scraped_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null

  return {
    initiatives,
    hourly,
    lastScrapedAt,
  }
}

/** Hourly buckets → cumulative running total per initiative, on a shared axis. */
export function toCumulative(hourly: HourlyBucket[], ids: string[]) {
  const hours = [...new Set(hourly.map((h) => h.hour))].sort()
  const byKey = new Map(hourly.map((h) => [`${h.initiative_id}|${h.hour}`, h.votes]))

  const series = ids.map((id) => {
    let running = 0
    return {
      id,
      points: hours.map((hour) => {
        running += byKey.get(`${id}|${hour}`) ?? 0
        return running
      }),
    }
  })

  return { hours, series }
}

/** Hourly buckets → per-day counts per initiative. */
export function toDaily(hourly: HourlyBucket[], ids: string[]) {
  const dayOf = (hour: string) => hour.slice(0, 10)
  const days = [...new Set(hourly.map((h) => dayOf(h.hour)))].sort()

  const totals = new Map<string, number>()
  for (const h of hourly) {
    const key = `${h.initiative_id}|${dayOf(h.hour)}`
    totals.set(key, (totals.get(key) ?? 0) + h.votes)
  }

  const series = ids.map((id) => ({
    id,
    points: days.map((day) => totals.get(`${id}|${day}`) ?? 0),
  }))

  return { days, series }
}
