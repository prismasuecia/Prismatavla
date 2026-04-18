import { useRef, useState, useEffect, type ReactNode } from 'react'
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

const MIN_W = 320
const MIN_H = 240

export function ModuleWindow({ layout, config, children, chipLabel }: ModuleWindowProps) {
  const actions = useBoardStore(s => s.actions)
  const projectorMode = useBoardStore(s => s.projectorMode)
  const activeModuleId = useBoardStore(s => s.moduleWindows.activeModuleId)
  const isMobile = useIsMobile()
  const isFullscreen = Boolean(layout.fullscreen)
  const isLocked = projectorMode || isMobile || (config.supportsFullscreen && isFullscreen)
  const isActive = activeModuleId === layout.moduleId

  const pos = layout.position ?? { x: 80, y: 80 }
  const sz = layout.size ?? config.defaultSize ?? { width: 400, height: 320 }
  const w = Math.max(MIN_W, sz.width)
  const h = Math.max(MIN_H, sz.height)

  // Drag med document-level listeners — fungerar även utan setPointerCapture
  const dragRef = useRef<{ px: number; py: number; mx: number; my: number } | null>(null)

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (isLocked) return
    e.preventDefault()
    actions.bringToFront(layout.moduleId)
    dragRef.current = { px: pos.x, py: pos.y, mx: e.clientX, my: e.clientY }

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return
      actions.updateModulePosition({
        moduleId: layout.moduleId,
        position: {
          x: Math.max(0, dragRef.current.px + ev.clientX - dragRef.current.mx),
          y: Math.max(0, dragRef.current.py + ev.clientY - dragRef.current.my),
        }
      })
    }
    const up = () => {
      dragRef.current = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  // Resize med document-level listeners
  const resizeRef = useRef<{ dir: string; sw: number; sh: number; mx: number; my: number } | null>(null)

  const makeResizeHandlers = (dir: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => {
      if (isLocked) return
      e.preventDefault()
      e.stopPropagation()
      actions.bringToFront(layout.moduleId)
      resizeRef.current = { dir, sw: w, sh: h, mx: e.clientX, my: e.clientY }

      const move = (ev: PointerEvent) => {
        if (!resizeRef.current) return
        const dx = ev.clientX - resizeRef.current.mx
        const dy = ev.clientY - resizeRef.current.my
        const nw = (dir === 'e' || dir === 'se') ? Math.max(MIN_W, resizeRef.current.sw + dx) : w
        const nh = (dir === 's' || dir === 'se') ? Math.max(MIN_H, resizeRef.current.sh + dy) : h
        actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: nw, height: nh } })
      }
      const up = () => {
        resizeRef.current = null
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
    }
  })

  if (layout.minimized) {
    return (
      <div className="module-chip"
        style={{ left: pos.x, top: pos.y, zIndex: layout.zIndex }}
        onClick={() => actions.restoreModule(layout.moduleId)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') actions.restoreModule(layout.moduleId) }}
        role="button" tabIndex={0}>
        <config.icon size={14} aria-hidden />
        <span>{config.title}{chipLabel && <strong style={{ marginLeft: 4 }}>{chipLabel}</strong>}</span>
      </div>
    )
  }

  const windowStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', top: '5%', left: '5%', width: '90vw', height: '90vh', zIndex: layout.zIndex, overflow: 'hidden', boxSizing: 'border-box' }
    : isMobile
    ? { position: 'fixed', inset: '1rem', width: 'auto', height: 'auto', zIndex: layout.zIndex, overflow: 'hidden', boxSizing: 'border-box' }
    : { position: 'absolute', left: pos.x, top: pos.y, width: w, height: h, zIndex: layout.zIndex, overflow: 'hidden', boxSizing: 'border-box' }

  return (
    <div
      className={clsx('module-window', { 'is-active': isActive, 'is-locked': isLocked })}
      style={windowStyle}
      onPointerDown={() => actions.bringToFront(layout.moduleId)}
    >
      <header
        className="module-header"
        onPointerDown={onHeaderPointerDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', minHeight: 44, flexShrink: 0,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-primary)',
          cursor: isLocked ? 'default' : 'grab',
          userSelect: 'none', touchAction: 'none',
        }}
      >
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

      <div className="module-content">{children}</div>

      {!isLocked && !isFullscreen && !isMobile && (
        <>
          <span className="module-resize module-resize-right"
            {...makeResizeHandlers('e')}
            style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'ew-resize', touchAction: 'none' }}
          />
          <span className="module-resize module-resize-bottom"
            {...makeResizeHandlers('s')}
            style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 8, cursor: 'ns-resize', touchAction: 'none' }}
          />
          <span className="module-resize module-resize-diagonal"
            {...makeResizeHandlers('se')}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, cursor: 'nwse-resize', touchAction: 'none' }}
          />
        </>
      )}
    </div>
  )
}

function WinBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      style={{ width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = danger ? 'rgba(180,60,50,0.10)' : 'var(--surface-hover)'; el.style.color = danger ? '#B43C32' : 'var(--text-primary)' }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.color = 'var(--text-tertiary)' }}>
      {children}
    </button>
  )
}
