/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect } from 'react'
import './App.css'
import './material.css'
import { Columns2 } from 'lucide-react'
import { useBoardStore, type ModuleWindowLayout } from './store/useBoardStore'
import { ModuleLayer } from './components/ModuleLayer'
import { Dock } from './components/Dock'
import { TrafficBadge } from './components/TrafficBadge'
import { useTimerTicker } from './hooks/useTimerTicker'
import { StudentPollPage } from './pages/StudentPollPage'
import { Feedback } from './components/Feedback'

function App() {
  useTimerTicker()
  const theme = useBoardStore((state) => state.theme)
  const exitFullscreen = useBoardStore((state) => state.actions.exitFullscreen)
  const windows = useBoardStore((state) => state.moduleWindows)
  const windowActions = useBoardStore((state) => state.actions)
  const visibleWindows = windows.openModuleIds
    .map((id) => windows.windowsById[id])
    .filter((layout): layout is ModuleWindowLayout => Boolean(layout && !layout.minimized && !layout.fullscreen))
  const arrangePair = () => {
    if (visibleWindows.length !== 2 || window.innerWidth < 840) return
    const gap = 24
    const available = window.innerWidth - 72
    const instruction = visibleWindows.find((layout) => layout.moduleId === 'instructioncards')
    const ordered = instruction ? [instruction, ...visibleWindows.filter((layout) => layout !== instruction)] : visibleWindows
    const leftWidth = Math.round(available * (instruction ? 0.57 : 0.5))
    const widths = [leftWidth, available - leftWidth]
    let x = gap
    ordered.forEach((layout, index) => {
      windowActions.updateModuleSize({ moduleId: layout.moduleId, size: { width: widths[index], height: window.innerHeight - 124 } })
      windowActions.updateModulePosition({ moduleId: layout.moduleId, position: { x, y: 60 } })
      x += widths[index] + gap
    })
  }
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

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.fullscreen = fullscreenModuleId ? 'on' : 'off'
  }, [theme, fullscreenModuleId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') {
        return
      }
      if (fullscreenModuleId) {
        exitFullscreen()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenModuleId, exitFullscreen])

  const path = typeof window === 'undefined' ? '' : window.location.pathname
  if (path.endsWith('/rod') || path.endsWith('/rod/')) {
    return <StudentPollPage />
  }

  return (
    <div className="teacher-board">
      {!fullscreenModuleId && <header className="board-identity">
        <span>PRISMA TAVLA</span>
        <Feedback />
        {visibleWindows.length === 2 && <button className="board-arrange" type="button" onClick={arrangePair} title="Ordna verktygen bredvid varandra" aria-label="Ordna verktygen bredvid varandra"><Columns2 size={22} /></button>}
      </header>}
      <ModuleLayer />
      <TrafficBadge />
      <Dock isVisible={!fullscreenModuleId} />
    </div>
  )
}

export default App
