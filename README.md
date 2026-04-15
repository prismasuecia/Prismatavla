# Prisma Tavla – Teacher Canvas

Prisma Tavla är nu ombyggd som en Classroomscreen-liknande lärarduk: en helskärms-canvas med lugn bakgrund, bottendocka och flytande moduler som öppnas vid behov. All state hanteras av Zustand och sparas lokalt (nyckel `prisma_tavla_v2`) så att inga elevnamn lämnar enheten.
## Funktioner
- **Dockade verktyg** – modulregistret exponerar alla appar via dockan; max tre fönster kan vara öppna åt gången och status indikeras direkt på ikonerna.
- **Flytande moduler** – öppnas som dragbara fönster (max tre samtidigt). De kan minimeras till "chips" nära senaste positionen och får rätt z-index vid fokus. I projektorläge/telefon låses positionerna och fönster blir fullbredd.
- **Timer** – SVG-ring med presets (1–30 min), egen tid, start/paus/nollställ. Sista minuten tjocknar ringen utan blink.
- **Tur i tur** – kräver aktiv klasslista; visar stor elevtext, läge Slump/Ordning, knappar Nästa/Hoppa/Lägg sist/Ångra/Avsluta och ett diskret protokoll.
- **Arbetsgrupper** – välj klasslista, ange gruppstorlek (2–5), skapa/blanda/lås/kopiera grupper. Kort är minst 200px och projektorvänliga.
- **Instruktion** – stor text med förinställda mallar (Tystarbete, Pararbete, Diskussion) och lås-läge mot ofrivillig redigering.
- **Bakgrund + Tema** – tre teman (Aurora, Skiffer, Krita) styr hela dukens palett. Trafikljus-modulen växlar norm (Tyst/Viska/Prata) och visas även som chip uppe till vänster.
- **Slump & Klocka** – snabb slumpknapp som väljer elev samt en stor digital klocka med datum.
- **Lektionsplan** – eget modul-fönster med faser, tidsangivelser, koppling till målmodul och progressindikator som kan slängas upp i projektorläget.
- **Placering** – sätesraster som kan följa klasslistan, slumpa, synka mot grupper eller skicka tillbaka rader till gruppmodulen.
- **Exit ticket** – skriv fråga, välj presets och logga svar i tre nivåer. Summering kan delas tillbaka till instruktionen med ett klick.
- **Ljudmätare** – Web Audio-baserad ljudnivå som ger rekommendation (tyst/viska/prata) och kan trycka samma norm till trafikljuset.
- **Klasslistor** – inline-hantering: välj lista i modulen, redigera elever direkt eller skapa ny lista när verktyg saknar data.
## Teknik
- **Stack**: Vite 7, React 19, TypeScript strict, Zustand + `persist`, Framer Motion (drag/animation), Lucide-ikoner.
- **State**: `src/store/useBoardStore.ts` håller tema, projector, dockade moduler, timer, trafiknorm, klasslistor, tur i tur, grupper, lektionsplan, placering, exit ticket, ljudmätare och slumpresultat. Allt sparas i localStorage med versions-flagga/migreringar.
- **Draggar**: moduler använder Framer Motion med `dragMomentum={false}` och `dragElastic=0`. Positionsvärden kläms mot viewport innan de sparas.
## Kom igång
```bash
npm install
npm run dev      # utvecklingsserver (Vite)
npm run build    # typecheck + produktionsbuild
npm run lint     # ESLint
```
## Teman & tokens
Färger och radier ligger i [src/index.css](src/index.css) (`:root` + `data-theme` regler). Justera eller lägg till nya teman genom att sätta `--bg`, `--surface`, `--border`, `--text`, `--accent*` m.m. och låt dockan/ modulerna ärva variablerna.

## Lägga till en ny modultyp
1. **Store** – lägg till nytt `ModuleType` i [useBoardStore](src/store/useBoardStore.ts) samt ev. state/actions.
2. **Dock** – lägg till en knapp i [Dock.tsx](src/components/Dock.tsx) med ikon och label så att läraren kan öppna den.
3. **Rendering** – skapa en komponent under `src/modules/windows/` och mappa den i [ModuleLayer.tsx](src/components/ModuleLayer.tsx) i `renderModule`, `getModuleTitle` och ev. `getModuleWidth`.
4. **Stil** – lägg nya klasser i [App.css](src/App.css). Håll färger lugna och undvik animationer utöver de redan använda 200ms fade/scale.

## Testa själv
1. Starta `npm run dev` och öppna http://localhost:5173.
2. Växla tema via bakgrundsmodulen och slå på projektorläget i dockan.
3. Skapa klasslista inne i Tur i tur-modulen, kör igenom elevkön och minimera fönstret.
4. Öppna fler verktyg (timer + grupper + instruktion) och verifiera att det fjärde stänger äldsta.
5. Byt till mobil viewport (<640 px) och se att modulerna fyller skärmen utan drag.

## Offline & integritet
All data (klasslistor, öppna moduler, timerläge osv.) lagras lokalt i webbläsaren. Ingen nätverkslagring, inga cookies, inga externa API-anrop. Töm cache/localStorage om du vill börja om.

---
Bygg offline, håll tonen lugn och undvik visuellt brus – resten av lärarduken kan du forma efter dina elever.
