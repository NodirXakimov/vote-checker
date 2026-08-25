import { supabase } from '@/lib/supabase'
import { INITIATIVE_ID } from '@/lib/config'

// Reads/writes the objects created by db/visits.sql.
const T_VIEWS = 'page_views'
const V_STATS = 'visit_stats'

const SESSION_KEY = 'vc_visitor'

/**
 * Stable per-browser id. localStorage rather than sessionStorage so a returning
 * reader counts as one visitor, not one per tab. Private-mode browsers throw on
 * access, in which case the view is still logged with a null session_id — it
 * counts toward views but not toward visitors.
 */
function visitorId(): string | null {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/**
 * Fire-and-forget page view log.
 *
 * Deliberately swallows every error, unlike the rest of the app's Supabase
 * calls: a failed analytics insert must never surface to a reader or block a
 * route change. There is nothing the user could do about it and nothing the
 * page needs from the result.
 */
export function trackView(path: string): void {
  void supabase
    .from(T_VIEWS)
    .insert({
      initiative_id: INITIATIVE_ID,
      path,
      session_id: visitorId(),
    })
    .then(() => undefined, () => undefined)
}

export interface VisitBucket {
  initiative_id: string
  hour: string
  views: number
  visitors: number
}

export interface VisitData {
  /** Hourly buckets for this initiative, oldest first. */
  hourly: VisitBucket[]
  views: number
  /**
   * Sum of per-hour distinct counts, so one visitor active across several hours
   * is counted once per hour. An exact distinct would need a second view; this
   * is close enough for a headline number and is labelled as approximate.
   */
  visitors: number
}

export async function fetchVisits(): Promise<VisitData> {
  const { data, error } = await supabase
    .from(V_STATS)
    .select('*')
    .eq('initiative_id', INITIATIVE_ID)
    .order('hour', { ascending: true })

  if (error) throw new Error(error.message)

  const hourly = (data ?? []) as VisitBucket[]
  return {
    hourly,
    views: hourly.reduce((sum, b) => sum + b.views, 0),
    visitors: hourly.reduce((sum, b) => sum + b.visitors, 0),
  }
}
