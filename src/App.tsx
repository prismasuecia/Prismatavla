/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { useBoardStore } from './store/useBoardStore'
import { ModuleLayer } from './components/ModuleLayer'
import { Dock } from './components/Dock'
import { TrafficBadge } from './components/TrafficBadge'
import { useTimerTicker } from './hooks/useTimerTicker'

const PROJECTOR_BOTTOM_THRESHOLD = 24
const DOCK_HIDE_DELAY = 1600
const ESCAPE_VISIBILITY_DURATION = 3000

function App() {
  useTimerTicker()
  const theme = useBoardStore((state) => state.theme)
  const projectorMode = useBoardStore((state) => state.projectorMode)
  const toggleProjector = useBoardStore((state) => state.actions.toggleProjector)
  const exitFullscreen = useBoardStore((state) => state.actions.exitFullscreen)
  const fullscreenModuleId = useBoardStore((state) => {
    const { openModuleIds, windowsById } = state.moduleWindows
    for (const moduleId of openModuleIds) {
      const layout = windowsById[moduleId]
      if (layout?.fullscreen) {
        return moduleId
      }
    }
    return undefined
  })
  const [dockVisible, setDockVisible] = useState(true)
  const dockVisibleRef = useRef(true)
  const hideTimeoutRef = useRef<number | null>(null)
  const pointerYRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const setDockVisibility = useCallback((visible: boolean) => {
    dockVisibleRef.current = visible
    setDockVisible(visible)
  }, [])

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const showDock = useCallback(
    (autoHideDelay?: number) => {
      clearHideTimeout()
      if (!dockVisibleRef.current) {
        setDockVisibility(true)
      }
      if (autoHideDelay) {
        hideTimeoutRef.current = window.setTimeout(() => {
          setDockVisibility(false)
          hideTimeoutRef.current = null
        }, autoHideDelay)
      }
    },
    [clearHideTimeout, setDockVisibility],
  )

  const scheduleHide = useCallback(
    (delay: number) => {
      clearHideTimeout()
      hideTimeoutRef.current = window.setTimeout(() => {
        setDockVisibility(false)
        hideTimeoutRef.current = null
      }, delay)
    },
    [clearHideTimeout, setDockVisibility],
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.projector = projectorMode ? 'on' : 'off'
    root.dataset.fullscreen = fullscreenModuleId ? 'on' : 'off'
  }, [theme, projectorMode, fullscreenModuleId])

  useEffect(() => {
    if (fullscreenModuleId) {
      setDockVisibility(false)
      return
    }
    if (!projectorMode) {
      setDockVisibility(true)
    }
  }, [fullscreenModuleId, projectorMode, setDockVisibility])

  useEffect(() => {
    if (!projectorMode || fullscreenModuleId) {
      clearHideTimeout()
      pointerYRef.current = null
      setDockVisibility(!fullscreenModuleId)
      return
    }

    setDockVisibility(false)
    pointerYRef.current = null

    const processPointer = (clientY: number) => {
      const distanceFromBottom = window.innerHeight - clientY
      if (distanceFromBottom <= PROJECTOR_BOTTOM_THRESHOLD) {
        showDock()
      } else if (dockVisibleRef.current) {
        scheduleHide(DOCK_HIDE_DELAY)
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      pointerYRef.current = event.clientY
      if (rafRef.current !== null) {
        return
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        if (pointerYRef.current != null) {
          processPointer(pointerYRef.current)
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      clearHideTimeout()
    }
  }, [projectorMode, fullscreenModuleId, clearHideTimeout, scheduleHide, setDockVisibility, showDock])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') {
        return
      }
      if (fullscreenModuleId) {
        exitFullscreen()
        return
      }
      if (projectorMode) {
        showDock(ESCAPE_VISIBILITY_DURATION)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenModuleId, exitFullscreen, projectorMode, showDock])

  const shouldAutoHideDock = projectorMode && !fullscreenModuleId
  const handleDockEnter = shouldAutoHideDock ? () => showDock() : undefined
  const handleDockLeave = shouldAutoHideDock ? () => scheduleHide(DOCK_HIDE_DELAY) : undefined
  const dockShouldBeVisible = fullscreenModuleId ? false : projectorMode ? dockVisible : true

  return (
    <div className="teacher-board">
      <ModuleLayer />
      <TrafficBadge />
      <Dock
        isVisible={dockShouldBeVisible}
        onPointerEnter={handleDockEnter}
        onPointerLeave={handleDockLeave}
      />
      {projectorMode && (
        <button type="button" className="projector-exit" onClick={toggleProjector}>
          Avsluta projektorläge
        </button>
      )}
    </div>
  )
}

export default App
