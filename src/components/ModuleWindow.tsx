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
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)

  const bringToFront = () => actions.bringToFront(layout.moduleId)

  const onHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (isLocked) return
    e.preventDefault()
    bringToFront()
    const pos = layout.position ?? { x: 100, y: 100 }
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      actions.updateModulePosition({
        moduleId: layout.moduleId,
        position: {
          x: Math.max(0, dragRef.current.px + ev.clientX - dragRef.current.sx),
          y: Math.max(0, dragRef.current.py + ev.clientY - dragRef.current.sy),
        }
      })
    }
    const up = () => { dragRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const resizeHandles = isLocked ? undefined : {
    right: <span className="module-resize module-resize-right" aria-hidden="true" />,
    bottom: <span className="module-resize module-resize-bottom" aria-hidden="true" />,
    bottomRight: <span className="module-resize module-resize-diagonal" aria-hidden="true" />,
  }

  if (layout.minimized) {
    return (
      <div className="module-chip"
        style={{ left: layout.position?.x ?? 100, top: layout.position?.y ?? 100, zIndex: layout.zIndex }}
        onClick={() => actions.restoreModule(layout.moduleId)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') actions.restoreModule(layout.moduleId) }}
        role="button" tabIndex={0}>
        <config.icon size={14} aria-hidden="true" />
        <span>{config.title}{chipLabel && <strong style={{ marginLeft: 4 }}>{chipLabel}</strong>}</span>
      </div>
    )
  }

  const header = (
    <header className="module-header" onMouseDown={onHeaderMouseDown}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)', cursor: isLocked ? 'default' : 'grab', userSelect: 'none', flexShrink: 0, background: 'var(--surface-primary)', minHeight: 44 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {config.title}
      </span>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <WinBtn label="Minimera" onClick={() => actions.minimizeModule(layout.moduleId)}><Minus size={14} /></WinBtn>
        {config.supportsFullscreen && (
          <WinBtn label={isFullscreen ? 'Avsluta helskärm' : 'Helskärm'} onClick={() => actions.toggleModuleFullscreen(layout.moduleId)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </WinBtn>
        )}
        <WinBtn label="Stäng" onClick={() => actions.closeModule(layout.moduleId)} danger><X size={14} /></WinBtn>
      </div>
    </header>
  )

  const content = <div className="module-content">{children}</div>

  if (isFullscreen) {
    return (
      <div className={clsx('module-window', 'module-window-fullscreen', { 'is-active': isActive })}
        style={{ zIndex: layout.zIndex, overflow: 'hidden' }} onMouseDown={bringToFront}>
        {header}{content}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={clsx('module-window', { 'is-active': isActive })}
        style={{ position: 'fixed', inset: '1rem', width: 'auto', zIndex: layout.zIndex, overflow: 'hidden' }}
        onMouseDown={bringToFront}>
        {header}{content}
      </div>
    )
  }

  return (
    <Rnd
      className={clsx('module-window', { 'is-active': isActive, 'is-locked': isLocked })}
      style={{ zIndex: layout.zIndex, overflow: 'hidden' }}
      position={layout.position ?? { x: 100, y: 100 }}
      size={currentSize}
      minWidth={MIN_WIDTH} minHeight={MIN_HEIGHT}
      maxWidth={viewportLimits.maxWidth} maxHeight={viewportLimits.maxHeight}
      bounds="parent"
      disableDragging={true}
      enableResizing={isLocked ? DISABLED_HANDLES : RESIZE_HANDLES}
      resizeHandleComponent={resizeHandles}
      onMouseDown={bringToFront}
      onResize={(_e, _d, ref, _delta, pos) => {
        if (isLocked) return
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: ref.offsetWidth, height: ref.offsetHeight } })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: pos ?? layout.position })
      }}
      onResizeStop={(_e, _d, ref, _delta, pos) => {
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: ref.offsetWidth, height: ref.offsetHeight } })
        actions.updateModulePosition({ moduleId: layout.moduleId, position: pos ?? layout.position })
      }}
    >
      {header}{content}
    </Rnd>
  )
}

interface WinBtnProps { label: string; onClick: () => void; danger?: boolean; children: ReactNode }
function WinBtn({ label, onClick, danger, children }: WinBtnProps) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      style={{ width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = danger ? 'rgba(180,60,50,0.10)' : 'var(--surface-hover)'; el.style.color = danger ? '#B43C32' : 'var(--text-primary)' }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.color = 'var(--text-tertiary)' }}>
      {children}
    </button>
  )
}

interface ViewportLimits { maxWidth: number; maxHeight: number }
const getVL = (): ViewportLimits => typeof window === 'undefined' ? { maxWidth: 1200, maxHeight: 800 } : { maxWidth: Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.9)), maxHeight: Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.9)) }
function useViewportLimits() {
  const [l, setL] = useState<ViewportLimits>(getVL)
  useEffect(() => { const h = () => setL(getVL()); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return l
}
