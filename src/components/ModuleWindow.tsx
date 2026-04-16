import { useEffect, useState, type ReactNode } from 'react'
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

const disabledHandles = {
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

  if (isFullscreen) {
    return (
      <div
        className={clsx('module-window', 'module-window-fullscreen', { 'is-active': isActive })}
        style={{ zIndex: layout.zIndex }}
        onMouseDown={handleBringToFront}
      >
        <ModuleWindowShell
          title={config.title}
          isFullscreen
          onMinimize={handleMinimize}
          onClose={handleClose}
          onToggleFullscreen={handleToggleFullscreen}
          supportsFullscreen={config.supportsFullscreen}
        >
          {children}
        </ModuleWindowShell>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div
        className={clsx('module-window', { 'is-active': isActive, 'is-locked': true })}
        style={{ position: 'fixed', inset: '1rem', width: 'auto', zIndex: layout.zIndex }}
        onMouseDown={handleBringToFront}
      >
        <ModuleWindowShell
          title={config.title}
          onMinimize={handleMinimize}
          onClose={handleClose}
          onToggleFullscreen={handleToggleFullscreen}
          supportsFullscreen={config.supportsFullscreen}
        >
          {children}
        </ModuleWindowShell>
      </div>
    )
  }

  return (
    <Rnd
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
      enableResizing={isLocked ? disabledHandles : RESIZE_HANDLES}
      resizeHandleComponent={resizeHandles}
      dragHandleClassName="module-header"
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
      <ModuleWindowShell
        title={config.title}
        onMinimize={handleMinimize}
        onClose={handleClose}
        onToggleFullscreen={handleToggleFullscreen}
        supportsFullscreen={config.supportsFullscreen}
      >
        {children}
      </ModuleWindowShell>
    </Rnd>
  )
}

interface ViewportLimits { maxWidth: number; maxHeight: number }

const getViewportLimits = (): ViewportLimits => {
  if (typeof window === 'undefined') return { maxWidth: 1200, maxHeight: 800 }
  return {
    maxWidth: Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9)),
    maxHeight: Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.9)),
  }
}

function useViewportLimits() {
  const [limits, setLimits] = useState<ViewportLimits>(() => getViewportLimits())
  useEffect(() => {
    const handleResize = () => setLimits(getViewportLimits())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return limits
}

interface ModuleWindowShellProps {
  title: string
  children: ReactNode
  onMinimize: () => void
  onClose: () => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  supportsFullscreen: boolean
}

function ModuleWindowShell({ title, children, onMinimize, onClose, onToggleFullscreen, isFullscreen, supportsFullscreen }: ModuleWindowShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header className="module-header">
        <span>{title}</span>
        <div>
          <button type="button" aria-label="Minimera" onClick={onMinimize}
            style={{ width:28, height:28, border:'none', background:'transparent', borderRadius:'var(--radius-sm)', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--surface-hover)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-tertiary)'}}
          ><Minus size={14} aria-hidden="true" /></button>
          {supportsFullscreen && onToggleFullscreen && (
            <button type="button" aria-label={isFullscreen ? 'Avsluta helskÃ¤rm' : 'HelskÃ¤rm'} onClick={onToggleFullscreen}
              style={{ width:28, height:28, border:'none', background:'transparent', borderRadius:'var(--radius-sm)', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--surface-hover)';(e.currentTarget as HTMLElement).style.color='var(--text-primary)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-tertiary)'}}
            >{isFullscreen ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}</button>
          )}
          <button type="button" aria-label="StÃ¤ng" onClick={onClose}
            style={{ width:28, height:28, border:'none', background:'transparent', borderRadius:'var(--radius-sm)', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(180,60,50,0.10)';(e.currentTarget as HTMLElement).style.color='#B43C32'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-tertiary)'}}
          ><X size={14} aria-hidden="true" /></button>
        </div>
      </header>
      <div className="module-content">{children}</div>
    </div>
  )
}
