import { useCallback, useEffect, useRef, useState } from 'react'

export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      ref.current?.requestFullscreen()
    }
  }, [])

  return { ref, isFullscreen, toggle }
}
