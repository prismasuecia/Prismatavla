import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Rnd } from 'react-rnd'
import { Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useBoardStore, type ModuleWindowLayout } from '../store/useBoardStore'
import type { ModuleConfig } from '../modules/moduleRegistry'
import { useIsMobile } from '../hooks/useIsMobile'

interface ModuleWindowProps {
  layout: ModuleWindowLayout
  config: ModuleConfig
  children: ReactNode
  chipLabel?: string
}

const MIN_WIDTH = 360
const MIN_HEIGHT = 280

const RESIZE_HANDLES = {
  top: false, topRight: false, right: true,
  bottomRight: true, bottom: true, bottomLeft: false,
  left: false, topLeft: false,
}

const DISABLED_HANDLES = {
  top: false, topRight: false, right: false,
  bottomRight: false, bottom: false, bottomLeft: false,
  left: false, topLeft: false,
}

export function ModuleWindow({ layout, config, children, chipLabel }: ModuleWindowProps) {
  const actions = useBoardStore((state) => state.actions)
  const projectorMode = useBoardStore((state) => state.projectorMode)
  const activeModuleId = useBoardStore((state) => state.moduleWindows.activeModuleId)
  const isMobile = useIsMobile()
  const isFullscreen = Boolean(layout.fullscreen)
  const isLocked = projectorMode || isMobile || (config.supportsFullscreen && isFullscreen)
  const isActive = activeModuleId === layout.moduleId
  const fallbackSize = config.defaultSize ?? { width: MIN_WIDTH, height: MIN_HEIGHT }
  const currentSize = {
    width: layout.size?.width ?? fallbackSize.width,
    height: layout.size?.height ?? fallbackSize.height,
  }
  const viewportLimits = useViewportLimits()
  const rndRef = useRef<Rnd>(null)

  // Sätt drag-handle klassen på Rnd's interna wrapper-div via ref
  useEffect(() => {
    if (rndRef.current && !isLocked) {
      const el = rndRef.current.getSelfElement()
      if (el) el.classList.add('drag-handle')
    }
  }, [isLocked])

  const resizeHandles = isLocked ? undefined : {
    right: <span className="module-resize module-resize-right" aria-hidden="true" />,
    bottom: <span className="module-resize module-resize-bottom" aria-hidden="true" />,
    bottomRight: <span className="module-resize module-resize-diagonal" aria-hidden="true" />,
  }

  const handleRestore = () => actions.restoreModule(layout.moduleId)
  const handleMinimize = () => actions.minimizeModule(layout.moduleId)
  const handleClose = () => actions.closeModule(layout.moduleId)
  const handleToggleFullscreen = () => actions.toggleModuleFullscreen(layout.moduleId)
  const handleBringToFront = () => actions.bringToFront(layout.moduleId)

  if (layout.minimized) {
    return (
      <div
        className="module-chip"
        style={{ left: layout.position?.x ?? 100, top: layout.position?.y ?? 100, zIndex: layout.zIndex }}
        onClick={handleRestore}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRestore() }}
        role="button"
        tabIndex={0}
      >
        <config.icon size={14} aria-hidden="true" />
        <span>{config.title}{chipLabel && <strong style={{ marginLeft: 4 }}>{chipLabel}</strong>}</span>
      </div>
    )
  }

  const shellContent = (
    <>
      <header className="module-header drag-handle">
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {config.title}
        </span>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <WinBtn aria-label="Minimera" onClick={handleMinimize}><Minus size={14} /></WinBtn>
          {config.supportsFullscreen && (
            <WinBtn aria-label={isFullscreen ? 'Avsluta' : 'Helskärm'} onClick={handleToggleFullscreen}>
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </WinBtn>
          )}
          <WinBtn aria-label="Stäng" onClick={handleClose} danger><X size={14} /></WinBtn>
        </div>
      </header>
      <div className="module-content">
        {children}
      </div>
    </>
  )

  if (isFullscreen) {
    return (
      <div className={clsx('module-window', 'module-window-fullscreen', { 'is-active': isActive })} style={{ zIndex: layout.zIndex }} onMouseDown={handleBringToFront}>
        {shellContent}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={clsx('module-window', { 'is-active': isActive })} style={{ position: 'fixed', inset: '1rem', width: 'auto', zIndex: layout.zIndex }} onMouseDown={handleBringToFront}>
        {shellContent}
      </div>
    )
  }

  return (
    <Rnd
      ref={rndRef}
      className={clsx('module-window', { 'is-active': isActive, 'is-locked': isLocked })}
      style={{ zIndex: layout.zIndex }}
      position={layout.position ?? { x: 100, y: 100 }}
      size={currentSize}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      maxWidth={viewportLimits.maxWidth}
      maxHeight={viewportLimits.maxHeight}
      bounds="parent"
      disableDragging={isLocked}
      enableResizing={isLocked ? DISABLED_HANDLES : RESIZE_HANDLES}
      resizeHandleComponent={resizeHandles}
      dragHandleClassName="drag-handle"
      onMouseDown={handleBringToFront}
      onDrag={(_event, data) => {
        if (isLocked) return
        actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: data.x, y: data.y } })
      }}
      onDragStop={(_event, data) => {
        actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: data.x, y: data.y } })
      }}
      onResize={(_event, _direction, ref, _delta, position) => {
        if (isLocked) return
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: ref.offsetWidth, height: ref.offsetHeight } })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: position ?? layout.position })
      }}
      onResizeStop={(_event, _direction, ref, _delta, position) => {
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: ref.offsetWidth, height: ref.offsetHeight } })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: position ?? layout.position })
      }}
    >
      {shellContent}
    </Rnd>
  )
}

interface WinBtnProps { 'aria-label': string; onClick: () => void; danger?: boolean; children: ReactNode }
function WinBtn({ 'aria-label': label, onClick, danger, children }: WinBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = danger ? 'rgba(180,60,50,0.10)' : 'var(--surface-hover)'; el.style.color = danger ? '#B43C32' : 'var(--text-primary)'; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.color = 'var(--text-tertiary)'; }}
    >
      {children}
    </button>
  )
}

interface ViewportLimits { maxWidth: number; maxHeight: number }
const getViewportLimits = (): ViewportLimits => {
  if (typeof window === 'undefined') return { maxWidth: 1200, maxHeight: 800 }
  return { maxWidth: Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9)), maxHeight: Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.9)) }
}
function useViewportLimits() {
  const [limits, setLimits] = useState<ViewportLimits>(() => getViewportLimits())
  useEffect(() => {
    const h = () => setLimits(getViewportLimits())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return limits
}
