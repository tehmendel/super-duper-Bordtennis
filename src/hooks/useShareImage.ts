import { useCallback, useRef } from 'react'
import { toPng } from 'html-to-image'

export function useShareImage(filename: string) {
  const ref = useRef<HTMLDivElement>(null)

  const share = useCallback(async () => {
    if (!ref.current) return
    const dataUrl = await toPng(ref.current, { pixelRatio: 2 })

    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch {
      // fall through to download
    }

    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }, [filename])

  return { ref, share }
}
