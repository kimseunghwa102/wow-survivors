/**
 * Save server URL (server/ folder, deployed on Render). Set to '' to run without saving.
 * e.g. 'https://wow-survivors-api.onrender.com'
 */
export const API_URL: string = (globalThis as any).__WOW_API__ ?? 'https://wow-survivors-api.onrender.com'
