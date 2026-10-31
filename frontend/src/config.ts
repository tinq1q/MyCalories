// `||` (not `??`) so an empty string also falls back; trailing slashes are
// removed because API paths are appended as `${API_URL}/api/...`.
export function normalizeApiUrl(raw: string | undefined): string {
  return (raw || 'http://localhost:8000').replace(/\/+$/, '')
}

export const API_URL: string = normalizeApiUrl(import.meta.env.VITE_API_URL)

// Hook for the future "photo of food" feature: the camera button in the search
// row stays hidden until recognition is implemented.
export const PHOTO_ENABLED = false
