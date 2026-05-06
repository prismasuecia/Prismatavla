import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
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

  // Drag state
  const dragRef = useRef<{ px: number; py: number; mx: number; my: number } | null>(null)
  const resizeRef = useRef<{ pw: number; ph: number; mx: number; my: number } | null>(null)

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (isLocked) return
    e.preventDefault()
    actions.bringModuleToFront(layout.moduleId)

    dragRef.current = {
      px: layout.position?.x ?? 100,
      py: layout.position?.y ?? 100,
      mx: e.clientX,
      my: e.clientY,
    }

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const newX = Math.max(0, dragRef.current.px + ev.clientX - dragRef.current.mx)
      const newY = Math.max(0, dragRef.current.py + ev.clientY - dragRef.current.my)
      actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: newX, y: newY } })
    }

    const up = () => {
      dragRef.current = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) return
    e.preventDefault()
    actions.bringModuleToFront(layout.moduleId)

    resizeRef.current = {
      pw: currentSize.width,
      ph: currentSize.height,
      mx: e.clientX,
      my: e.clientY,
    }

    const move = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const newW = Math.max(MIN_WIDTH, resizeRef.current.pw + ev.clientX - resizeRef.current.mx)
      const newH = Math.max(MIN_HEIGHT, resizeRef.current.ph + ev.clientY - resizeRef.current.my)
      actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: newW, height: newH } })
    }

    const up = () => {
      resizeRef.current = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const handleRestore = () => actions.restoreModule(layout.moduleId)
  const handleMinimize = () => actions.minimizeModule(layout.moduleId)
  const handleClose = () => actions.closeModule(layout.moduleId)
  const handleToggleFullscreen = () => actions.toggleModuleFullscreen(layout.moduleId)
  const handleBringToFront = () => actions.bringModuleToFront(layout.moduleId)

  if (layout.minimized) {
    return (
      <div
        className="module-chip"
        style={{ left: layout.position?.x ?? 100, top: layout.position?.y ?? 100, zIndex: layout.zIndex }}
        onClick={handleRestore}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleRestore()
        }}
        role="button"
        tabIndex={0}
      >
        <config.icon size={14} aria-hidden="true" />
        <span>
          {config.title}
          {chipLabel && <strong style={{ marginLeft: 4 }}>{chipLabel}</strong>}
        </span>
      </div>
    )
  }

  const header = (
    <div
      className="module-header"
      onPointerDown={onHeaderPointerDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 14px',
        minHeight: 44,
        flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-primary)',
        cursor: isLocked ? 'default' : 'grab',
        WebkitAppearance: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {config.title}
      </span>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <WinBtn label="Minimera" onClick={handleMinimize}>
          <Minus size={14} />
        </WinBtn>
        {config.supportsFullscreen && (
          <WinBtn
            label={isFullscreen ? 'Avsluta helskärm' : 'Helskärm'}
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </WinBtn>
        )}
        <WinBtn label="Stäng" onClick={handleClose} danger>
          <X size={14} />
        </WinBtn>
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <div
        className={clsx('module-window', 'module-window-fullscreen', { 'is-active': isActive })}
        style={{ zIndex: layout.zIndex }}
        onMouseDown={handleBringToFront}
      >
        {header}
        <div className="module-content">{children}</div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div
        className={clsx('module-window', { 'is-active': isActive })}
        style={{ position: 'fixed', inset: '1rem', width: 'auto', zIndex: layout.zIndex }}
        onMouseDown={handleBringToFront}
      >
        {header}
        <div className="module-content">{children}</div>
      </div>
    )
  }

  const x = layout.position?.x ?? 100
  const y = layout.position?.y ?? 100

  return (
    <div
      className={clsx('module-window', { 'is-active': isActive, 'is-locked': isLocked })}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: currentSize.width,
        height: currentSize.height,
        zIndex: layout.zIndex,
        overflow: 'hidden',
        touchAction: 'none',
      }}
      onMouseDown={handleBringToFront}
    >
      {header}
      <div className="module-content">{children}</div>
      {!isLocked && (
        <div
          className="module-resize module-resize-diagonal"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            touchAction: 'none',
          }}
          onPointerDown={onResizePointerDown}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

interface WinBtnProps {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}
function WinBtn({ label, onClick, danger, children }: WinBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: 'none',
        background: 'transparent',
        borderRadius: 6,
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = danger ? 'rgba(180,60,50,0.10)' : 'var(--surface-hover)'
        el.style.color = danger ? '#B43C32' : 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = 'transparent'
        el.style.color = 'var(--text-tertiary)'
      }}
    >
      {children}
    </button>
  )
}

interface ViewportLimits {
  maxWidth: number
  maxHeight: number
}
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
    const h = () => setLimits(getViewportLimits())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return limits
}
