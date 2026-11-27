# Kvarstående tester

Uppdaterat 2026-11-27.

## Kritiska fynd i lärarflöden 2026-11-27

Appen är inte godkänd som färdigtestad. Ingen garanti om full testtäckning.

- Bekräftat i gränssnittet: Arbetsgrupper utelämnar gruppledaren i
  grupprutan, räknar för få elever och markerar första övriga medlemmen som
  ledare. PDF-exporten är rättad men detta separata visningsfel återstår.
- Bekräftat: ett eget tillagt namn i Tur i tur försvinner när verktyget
  stängs och öppnas igen. Namn återställs från aktiv klass i stället för
  sparat hjultillstånd.
- Bekräftat: första klicket på en knapp i ett inaktivt verktyg kan bara
  föra fram fönstret; andra klicket utför kommandot. Provat med 30 min.
- Källgranskad risk, inte destruktivt GUI-testad: radering av sparad lista
  i Tur i tur kan även ta bort den gemensamma klassen och dess sittplaner.
- Gruppindelning kan skrivas över med samma namn utan bekräftelse.
- Exempelklassen presenteras inte tydligt som exempel vid första användning.

Sittplats har nu lokal rättning med val mellan sparad klass och egen
inmatning av klassnamn samt elever. Testat med två och tre elever och tom
inmatning. Detta är en senare källkodsrättning än senast publicerad beta.

Typkontroll samt 11 010 isolerade kontroller passerar, inklusive 441
sittplatskombinationer. Dessa tester fångar INTE alla fel i gränssnittet.
Felen ovan kräver rättningar och nya tester av hela användarflödet innan
nästa version kan beskrivas som färdiggranskad.

## Omröstning - delvis verifierad

Lärar- och elevvy testades samtidigt vid publiceringen 2026-11-27.
Elevsidan öppnades och en röst nådde lärarens resultat.
Separata ursprung och ändrat svar/stängning/ny omgång testades 2026-11-24.
Tokenförmedlarens fem tester passerar. Markera inte hela funktionen som
färdigtestad: nätavbrott, stängt lärarfönster, tokenförnyelse och belastning
med många fysiska elevdatorer återstår.

- Elev ansluter med rätt kod och får aktuell fråga.
- Elevens svar syns direkt hos läraren.
- Stängd omröstning avvisar fler svar.
- Ny omgång får inga gamla röster.
- Omladdning av lärarvyn behåller fråga, kod och resultat.
- Nätverksfel ger korrekt besked till eleven.

## Säkerhetskopia - isolerad kontroll godkänd 2026-11-19

BackupControls kördes med separat minneslagring och testdata. Användarens
webbläsardata ändrades inte.

- Export och återställning bevarade samtliga sex lagringsposter exakt,
  inklusive klasslistor, sittplaner, instruktioner och lektionsplan.
- Avbryt lämnade data oförändrade.
- Trasig JSON och saknad tavlastruktur avvisades före skrivning.
- Simulerat skrivfel återställde tidigare lagringsvärden.
- Saknade valfria data återställdes korrekt.

Återstår: prova filval, nedladdning och återställning med riktig omladdning
i Safari. Appens fullständiga återinläsning av den återställda tavlan är
inte verifierad av det isolerade testet.

## Därefter

Testa Safari på Mac och läsbarhet på riktig klassrumstavla, inklusive
fönsterdragning, skrollning och export.
