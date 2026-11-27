# Omrostning: hemlig nyckel pa servern

## Feedback - Resend

`/feedback` anvander Resend via Cloudflare Worker och fungerar forst efter:

- Verifiera en separat avsandarsubdoman hos Resend genom DNS-poster hos One.com.
  Andra INTE huvuddomannens MX-poster eller ordinarie e-post.
- Spara `RESEND_API_KEY` som serverhemlighet med Sending access for underdomanen.
- Spara `FEEDBACK_TO` och `FEEDBACK_FROM` som serverhemligheter. Mottagaren
  ska aldrig laggas i frontend, Wrangler-filen eller publikt repository.
- Bind `FEEDBACK_LIMITER` (namespace 1002, limit 6, period 60).
- Driftsatt Worker-koden och gor ett verkligt test till mottagarens inkorg.
  Ett accepterat anrop ar inte bevis pa leverans i inkorgen.

Frontend anvander VITE_FEEDBACK_URL eller /feedback pa VITE_POLL_AUTH_URL.
Inga bilagor eller elevdata ska skickas. Fel behaller lararens text; framgang
visas bara efter att e-posttjansten accepterat meddelandet. Ursprungskontroll,
honeypot och rate limit ar grundskydd, inte fullstandigt botskydd.

Tester: `node --test server/poll-auth/*.test.mjs`.

Dokumentation: https://resend.com/docs/api-reference/emails/send-email

Status 2026-11-27: Worker driftsatt, ny ABLY_API_KEY sparad som Secret och
gammal Root-nyckel sparrad av kontoagaren. Signerad biljett accepterades av
Ably; publik larar-/elevvy och en rost testades. GitHub Pages serverar appen.
VITE_POLL_AUTH_URL finns i lokal, git-ignorerad byggkonfiguration. En ny
byggmiljo maste konfigureras enligt steg 5; hemligheten finns bara pa servern.

1. Skapa Cloudflare-konto och logga in. Kontoagaren accepterar sjalv villkoren.
2. Sparra den gamla Ably-nyckeln som tidigare lag i klientkoden och delades i
   chatten. Skapa en ersattningsnyckel i Ably. Skicka den inte i chatt.
3. Driftsatt denna katalog med Wrangler 4.36 eller senare. Paketet `ably`
   finns redan i projektets rot. Konfigurationen aktiverar en rate-limit-binding.
4. Lagg ersattningsnyckeln som Cloudflare Secret `ABLY_API_KEY`, aldrig som
   publik variabel eller i wrangler.jsonc. ALLOWED_ORIGINS innehaller endast
   godkanda app-origins, utan sokvag. Domanbyte kraver uppdatering har.
5. Satt VITE_POLL_AUTH_URL till Workerns HTTPS-adress med /token i appens
   privata .env.production.local eller byggmiljo. Detta ar en publik adress,
   inte en hemlighet. Bygg om appen efter andringen.
6. Testa lararvy och elevvy fran tva olika enheter innan GitHub Pages deploy.
   Testa ocksa fornyelse efter tio minuter och flera klasser fran samma skolnat.

Tekniska kontroller:

```sh
node --test server/poll-auth/worker.test.mjs
npm run typecheck
npm run build
```

TokenRequest signeras av Ablys SDK med tio minuters giltighet och bara den
aktuella kanalen. SDK:n i webblasaren fornyar automatiskt via authCallback.
Serverfel returnerar aldrig nyckel eller underliggande SDK-fel till klienten.

Begransningar: CORS ar inte autentisering; andra program kan forfalska Origin.
Detta skyddar huvudnyckeln men ger inte verifierade lararroller. Koden ar
fortfarande tilltrade till omrostningen och elever/larare delar kanalrattigheter.
Anvand inga kansliga uppgifter. Fore bred lansering behovs serverkontrollerade
lararsessioner och separata svar-/tillstandskanaler om rostmanipulation ska hindras.
Rate limit ar ett ungefarligt missbruksskydd per IP, inte en hard kostnadsgrans;
flera klasser kan dela IP. Folj upp grans pa 120 anrop/minut under betan.

Dokumentation:
- https://ably.com/docs/auth/token
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
