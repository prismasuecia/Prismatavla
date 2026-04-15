import { useEffect } from 'react'
import { useBoardStore } from '../store/useBoardStore'

export function useTimerTicker() {
  const isRunning = useBoardStore((state) => state.timer.isRunning)
  const syncTimer = useBoardStore((state) => state.actions.syncTimer)

  useEffect(() => {
    if (!isRunning) {
      syncTimer(Date.now())
      return
    }
    let raf: number
    const step = () => {
      syncTimer(Date.now())
      raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [isRunning, syncTimer])
}
