// Which initiative this deployment shows. The votes table holds rows for every
// initiative, so this filter is what makes the site single-purpose.
export const INITIATIVE_ID = import.meta.env.VITE_INITIATIVE_ID as string

// There is no initiatives table to join against (initiative_id is free-form
// text), so the display name is configured alongside the id.
export const INITIATIVE_NAME = import.meta.env.VITE_INITIATIVE_NAME as string

if (!INITIATIVE_ID) {
  throw new Error(
    'Missing VITE_INITIATIVE_ID. Without it the page would list votes from ' +
    'every initiative. Set it in .env — see .env.example.'
  )
}
