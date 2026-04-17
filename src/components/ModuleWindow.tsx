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
  top: false,
  topRight: false,
  right: true,
  bottomRight: true,
  bottom: true,
  bottomLeft: false,
  left: false,
  topLeft: false,
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
  const resizeHandles = isLocked
    ? undefined
    : {
        right: <span className="module-resize module-resize-right" aria-hidden="true" />,
        bottom: <span className="module-resize module-resize-bottom" aria-hidden="true" />,
        bottomRight: <span className="module-resize module-resize-diagonal" aria-hidden="true" />,
      }

  const handleRestore = () => actions.restoreModule(layout.moduleId)
  const handleToggleFullscreen = config.supportsFullscreen ? () => actions.toggleModuleFullscreen(layout.moduleId) : undefined
  const handleClose = () => actions.closeModule(layout.moduleId)
  const handleMinimize = () => actions.minimizeModule(layout.moduleId)
  const handleBringToFront = () => actions.bringModuleToFront(layout.moduleId)

  if (layout.minimized) {
    return (
      <div
        className="module-chip"
        style={{ left: layout.position.x, top: layout.position.y, zIndex: layout.zIndex }}
        role="button"
        tabIndex={0}
        onClick={handleRestore}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleRestore()
          }
        }}
      >
        <span>{config.title}</span>
        {chipLabel && <strong>{chipLabel}</strong>}
        <Maximize2 aria-hidden="true" size={16} />
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
        data-locked="true"
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
      size={currentSize}
      position={layout.position}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      maxWidth={viewportLimits.maxWidth}
      maxHeight={viewportLimits.maxHeight}
      bounds="window"
      disableDragging={isLocked}
      enableResizing={isLocked ? disabledHandles : RESIZE_HANDLES}
      resizeHandleComponent={resizeHandles}
      cancel=".module-content,.module-actions,button,input,textarea,select"
      onMouseDown={handleBringToFront}
      onDrag={(_event, data) => {
        if (isLocked) return
        actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: data.x, y: data.y } })
      }}
      onDragStop={(_event, data) =>
        actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: data.x, y: data.y } })
      }
      onResize={(_event, _direction, ref, _delta, position) => {
        if (isLocked) return
        const nextPosition = position ?? layout.position
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: ref.offsetWidth, height: ref.offsetHeight } })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: nextPosition })
      }}
      onResizeStop={(_event, _direction, ref, _delta, position) => {
        const nextPosition = position ?? layout.position
        actions.updateModuleSize({
          moduleId: layout.moduleId,
          size: { width: ref.offsetWidth, height: ref.offsetHeight },
        })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: nextPosition })
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

interface ModuleWindowShellProps {
  title: string
  children: ReactNode
  onMinimize: () => void
  onClose: () => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  supportsFullscreen: boolean
}

function ModuleWindowShell({
  title,
  children,
  onMinimize,
  onClose,
  onToggleFullscreen,
  isFullscreen,
  supportsFullscreen,
}: ModuleWindowShellProps) {
  return (
    <div className="module-surface">
      <header className="module-header">
        <strong>{title}</strong>
        <div className="module-actions">
          <button type="button" aria-label="Minimera" onClick={onMinimize}>
            <Minus size={16} aria-hidden="true" />
          </button>
          {supportsFullscreen && onToggleFullscreen && (
            <button type="button" aria-label={isFullscreen ? 'Avsluta helskÃÂÃÂ¤rm' : 'Visa helskÃÂÃÂ¤rm'} onClick={onToggleFullscreen}>
              {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
          )}
          <button type="button" aria-label="StÃÂÃÂ¤ng" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="module-content">{children}</div>
    </div>
  )
}

const disabledHandles = {
  top: false,
  topRight: false,
  right: false,
  bottomRight: false,
  bottom: false,
  bottomLeft: false,
  left: false,
  topLeft: false,
}

interface ViewportLimits {
  maxWidth: number
  maxHeight: number
}

const getViewportLimits = (): ViewportLimits => {
  if (typeof window === 'undefined') {
    return {
      maxWidth: 1200,
      maxHeight: 800,
    }
  }
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
