# DRAG-LÖSNING — KRITISK DOKUMENTATION
## Får aldrig upprepas igen

### Problemet
Fönster i Prisma Tavla gick inte att flytta (drag fungerade inte).

### Grundorsaken (två samverkande buggar)

#### 1. React 19 tog bort `ReactDOM.findDOMNode()`
`react-rnd` och `react-draggable` (som react-rnd bygger på) anropar
`ReactDOM.findDOMNode(this)` vid varje mousedown för att hitta DOM-noden.
I **React 19 är `findDOMNode` borttaget**. Utan den returnerar
`DraggableCore.findDOMNode()` `null`, och drag startar aldrig — tyst,
utan felmeddelande.

**Symptom:** Klick och drag på header gör ingenting. Inga fel i konsolen.
`react-draggable-dragging`-klassen läggs aldrig till.

#### 2. Fel funktionsnamn i store
Koden anropade `actions.bringToFront()` men store-funktionen heter
`actions.bringModuleToFront()`. Fel namn → TypeError → drag-handler
avbröts tyst.

### Lösningen (commit b7fc86e3 + 80af297e)

**Ta bort react-rnd helt.** Implementera drag med Pointer Events och
`position: absolute`.

```tsx
// ModuleWindow.tsx — KORREKT IMPLEMENTATION

// Fönstret positioneras med position:absolute och left/top från store
const windowStyle: React.CSSProperties = {
  position: 'absolute',
  left: pos.x,
  top: pos.y,
  width: w,
  height: h,
  zIndex: layout.zIndex,
  overflow: 'hidden',
}

// Drag via Pointer Events + document-level listeners
const dragRef = useRef<{ px: number; py: number; mx: number; my: number } | null>(null)

const onHeaderPointerDown = (e: React.PointerEvent<HTMLElement>) => {
  if ((e.target as HTMLElement).closest('button')) return
  if (isLocked) return
  e.preventDefault()
  actions.bringModuleToFront(layout.moduleId)  // ← RÄTT NAMN
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

// Header med onPointerDown
<header className="module-header" onPointerDown={onHeaderPointerDown} ...>
```

### Regler för framtiden

1. **Använd ALDRIG react-rnd eller react-draggable i React 19+.**
   Dessa bibliotek är inte kompatibla med React 19 (findDOMNode borttaget).

2. **Implementera alltid drag med Pointer Events:**
   - `onPointerDown` på drag-elementet
   - `document.addEventListener('pointermove', ...)` för smooth drag
   - `document.addEventListener('pointerup', ...)` för att avsluta
   - `position: absolute` med `left/top` från store-state

3. **Kontrollera ALLTID att store-funktionsnamn stämmer:**
   Kolla BoardActions-interfacet i `useBoardStore.ts` och verifiera
   exakt funktionsnamn. `bringToFront` heter `bringModuleToFront`.

4. **Verifiera drag programmatiskt:**
   ```js
   actions.updateModulePosition({ moduleId: 'timer', position: { x: 100, y: 200 } })
   // Kontrollera att win.style.left === '100px' efter ~500ms
   ```

### Verifikat fungerar (2026-04-18)
- Fönster kan dras till valfri position ✅
- Drag stannar vid viewport-kanten (clampPosition i store) ✅
- Knappar i header startar inte drag ✅
- Resize fungerar via custom pointer event handlers ✅
- Flera fönster kan öppnas och aktiveras ✅
