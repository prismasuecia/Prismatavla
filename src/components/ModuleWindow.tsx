import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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

  const pos = layout.position ?? { x: 100, y: 100 }
  const size = layout.size ?? config.defaultSize ?? { width: MIN_WIDTH, height: MIN_HEIGHT }
  const w = Math.max(MIN_WIDTH, size.width)
  const h = Math.max(MIN_HEIGHT, size.height)

  // Drag
  const dragRef = useRef<{sx:number;sy:number;px:number;py:number}|null>(null)
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (isLocked) return
    e.preventDefault()
    actions.bringToFront(layout.moduleId)
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
  }, [isLocked, pos.x, pos.y, layout.moduleId, actions])

  // Resize
  const resizeRef = useRef<{dir:string;sx:number;sy:number;sw:number;sh:number;px:number;py:number}|null>(null)
  const onResizeMouseDown = useCallback((dir: string) => (e: React.MouseEvent) => {
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()
    actions.bringToFront(layout.moduleId)
    resizeRef.current = { dir, sx: e.clientX, sy: e.clientY, sw: w, sh: h, px: pos.x, py: pos.y }
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const { dir: d, sx, sy, sw, sh, px, py } = resizeRef.current
      let nw = sw, nh = sh, nx = px, ny = py
      if (d.includes('e')) nw = Math.max(MIN_WIDTH, sw + ev.clientX - sx)
      if (d.includes('s')) nh = Math.max(MIN_HEIGHT, sh + ev.clientY - sy)
      if (d.includes('se')) { nw = Math.max(MIN_WIDTH, sw + ev.clientX - sx); nh = Math.max(MIN_HEIGHT, sh + ev.clientY - sy) }
      actions.updateModuleSize({ moduleId: layout.moduleId, size: { width: nw, height: nh } })
      if (nx !== px || ny !== py) actions.updateModulePosition({ moduleId: layout.moduleId, position: { x: nx, y: ny } })
    }
    const up = () => { resizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [isLocked, w, h, pos.x, pos.y, layout.moduleId, actions])

  if (layout.minimized) {
    return (
      <div className="module-chip"
        style={{ left: pos.x, top: pos.y, zIndex: layout.zIndex }}
        onClick={() => actions.restoreModule(layout.moduleId)}
        onKeyDown={(e) => { if (e.key==='Enter'||e.key===' ') actions.restoreModule(layout.moduleId) }}
        role="button" tabIndex={0}>
        <config.icon size={14} aria-hidden="true" />
        <span>{config.title}{chipLabel && <strong style={{marginLeft:4}}>{chipLabel}</strong>}</span>
      </div>
    )
  }

  const windowStyle: React.CSSProperties = isFullscreen
    ? { position:'fixed', top:'5%', left:'5%', width:'90vw', height:'90vh', zIndex: layout.zIndex, overflow:'hidden' }
    : isMobile
    ? { position:'fixed', inset:'1rem', width:'auto', height:'auto', zIndex: layout.zIndex, overflow:'hidden' }
    : { position:'absolute', left: pos.x, top: pos.y, width: w, height: h, zIndex: layout.zIndex, overflow:'hidden' }

  return (
    <div
      className={clsx('module-window', { 'is-active': isActive, 'is-locked': isLocked })}
      style={windowStyle}
      onMouseDown={() => actions.bringToFront(layout.moduleId)}
    >
      {/* Header */}
      <header className="module-header"
        onMouseDown={onHeaderMouseDown}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderBottom:'1px solid var(--border-subtle)', cursor: isLocked ? 'default' : 'grab', userSelect:'none', flexShrink:0, background:'var(--surface-primary)', minHeight:44 }}>
        <span style={{ fontSize:'var(--text-sm)', fontWeight:500, color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {config.title}
        </span>
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          <WinBtn label="Minimera" onClick={() => actions.minimizeModule(layout.moduleId)}><Minus size={14}/></WinBtn>
          {config.supportsFullscreen && (
            <WinBtn label={isFullscreen ? 'Avsluta helskärm' : 'Helskärm'} onClick={() => actions.toggleModuleFullscreen(layout.moduleId)}>
              {isFullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
            </WinBtn>
          )}
          <WinBtn label="Stäng" onClick={() => actions.closeModule(layout.moduleId)} danger><X size={14}/></WinBtn>
        </div>
      </header>

      {/* Content */}
      <div className="module-content">{children}</div>

      {/* Resize handles */}
      {!isLocked && !isFullscreen && !isMobile && (
        <>
          <div onMouseDown={onResizeMouseDown('e')} style={{ position:'absolute', right:0, top:0, width:6, height:'100%', cursor:'ew-resize' }} />
          <div onMouseDown={onResizeMouseDown('s')} style={{ position:'absolute', bottom:0, left:0, width:'100%', height:6, cursor:'ns-resize' }} />
          <div onMouseDown={onResizeMouseDown('se')} style={{ position:'absolute', bottom:0, right:0, width:16, height:16, cursor:'nwse-resize' }} />
        </>
      )}
    </div>
  )
}

function WinBtn({ label, onClick, danger, children }: { label:string; onClick:()=>void; danger?:boolean; children:ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      style={{ width:28, height:28, border:'none', background:'transparent', borderRadius:'var(--radius-sm)', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0 }}
      onMouseEnter={e=>{ const el=e.currentTarget; el.style.background=danger?'rgba(180,60,50,0.10)':'var(--surface-hover)'; el.style.color=danger?'#B43C32':'var(--text-primary)' }}
      onMouseLeave={e=>{ const el=e.currentTarget; el.style.background='transparent'; el.style.color='var(--text-tertiary)' }}>
      {children}
    </button>
  )
}
