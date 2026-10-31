import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './useExport'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('downloadBlob', () => {
  it('keeps the blob URL alive long enough for the browser to start the download', () => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    URL.revokeObjectURL = revoke
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadBlob(new Blob(['x']), 'a.txt')
    expect(click).toHaveBeenCalledTimes(1)
    // Revoking right after click() can cancel the download in some browsers.
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(29_999)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
