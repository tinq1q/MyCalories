import { describe, expect, it } from 'vitest'
import { normalizeApiUrl } from './config'

describe('normalizeApiUrl', () => {
  it('falls back to the local server when the variable is missing or empty', () => {
    expect(normalizeApiUrl(undefined)).toBe('http://localhost:8000')
    // An empty GitHub variable arrives as '' — `??` would keep it and break every request.
    expect(normalizeApiUrl('')).toBe('http://localhost:8000')
  })
  it('drops trailing slashes so paths join cleanly', () => {
    expect(normalizeApiUrl('https://api.example.com/')).toBe('https://api.example.com')
    expect(normalizeApiUrl('https://api.example.com//')).toBe('https://api.example.com')
    expect(normalizeApiUrl('https://api.example.com')).toBe('https://api.example.com')
  })
})
