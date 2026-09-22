# EcoRoute — Micro-Logistics Carbon Tracker

A small Java application that logs local delivery jobs (route ID, distance,
vehicle type, traffic level) and reports the fleet's carbon footprint for the
day. It ships two front ends over the same backend logic: the original
console app, and a browser dashboard added later that talks to the backend
over a REST API.

> **Provenance note for anyone (or any AI assistant) reading this cold:**
> There is a sibling project at `C:\Users\Lingesh\IdeaProjects\EcoRoute` with
> the same domain model — that one is a graded CS5304 (Chennai Institute of
> Technology) course submission, constrained to console-only / pure
> `java.util`, no frameworks. **This copy, `D:\EcoRoute`, is a separate,
> repurposed copy** (confirmed with the project owner on 2026-09-22) and is
> not subject to that constraint. Do not assume the console-only rule
> applies here, and do not treat this README as documentation for the
> graded submission.

## What it does

A delivery hub (courier office, cloud kitchen, grocery micro-warehouse) logs
each delivery as it happens. The app calculates that delivery's CO2 emissions
from its vehicle type and distance, applies a traffic penalty, stores it
in memory, and can report the running total for the day plus an advisory
when the footprint gets too high.

**Emission rules (in `EmissionService`):**
- Petrol Bike: 70 g CO2/km
- Diesel Van: 150 g CO2/km
- EV: 0 g CO2/km (always, regardless of traffic)
- High traffic adds a 25% penalty to non-EV vehicles
- If the day's total exceeds 2000 g, an eco-advisory is triggered recommending
  a switch to EVs on high-traffic routes tomorrow

Storage is a plain in-memory `ArrayList` (`LogRepository`) — data resets
every time the process restarts. There is no database.

## Architecture

Layered, framework-free Java. Two entry points share the same
Model/Repository/Service layers:

```
src/ecoroute/
  MainApp.java              Console entry point (original UI)
  WebServer.java            Web entry point — starts an HTTP server (added 2026-09-22)
  model/
    DeliveryLog.java        One logged delivery + its computed emissions
  repository/
    LogRepository.java      In-memory "database" (ArrayList)
  service/
    EmissionService.java    Business logic: emission calc, traffic penalty,
                             daily totals, eco-advisory rule
  util/
    OutputFormatter.java    Console table/number formatting
  api/                      HTTP layer (added 2026-09-22), used only by WebServer
    DeliveryHandler.java    GET/POST /api/deliveries
    SummaryHandler.java     GET /api/summary
    StaticFileHandler.java  Serves the webapp/ frontend, blocks path traversal
    JsonUtil.java           Hand-rolled JSON *encoding* only (no JSON parser —
                             POST bodies are form-encoded, decoded via
                             java.net.URLDecoder)
webapp/                     Static frontend served by StaticFileHandler
  index.html                Dashboard layout (log form, summary card, table)
  style.css                 Styling
  app.js                    Calls the REST API via fetch(), renders results
out/                        Compiled .class output (javac -d out)
```

**Why two entry points instead of replacing the console app:** the console
app (`MainApp`) was the original deliverable and still works standalone. The
web layer (`WebServer` + `api/` + `webapp/`) was added on top without
modifying the console UI's behavior — both read/write through the same
`EmissionService`, so the advisory threshold and emission math can't drift
between them.

**Why the JDK's built-in `HttpServer` (`com.sun.net.httpserver`) instead of
Spring/Javalin/etc.:** keeps the project dependency-free — no Maven/Gradle,
nothing to install, `javac`/`java` is enough.

**Why no JSON parsing library:** the only JSON needed is *encoding*
(responses). Incoming POST data uses `application/x-www-form-urlencoded`
and is decoded with the JDK's `URLDecoder` — avoids the failure modes of a
hand-rolled JSON parser for something this small.

## Build & run

### Console app
```
cd D:\EcoRoute
javac -d out $(find src -name "*.java")
java -cp out ecoroute.MainApp
```

### Web app (dashboard + REST API)
```
cd D:\EcoRoute
javac -d out $(find src -name "*.java")
java -cp out ecoroute.WebServer [port] [webRootPath]
```
Defaults: port `8080`, web root `webapp` (resolved relative to the current
working directory — pass an absolute path if running from elsewhere). Then
open `http://localhost:8080/`.

On Windows PowerShell, replace `$(find src -name "*.java")` with a loop or
list the files explicitly, e.g.:
```powershell
Get-ChildItem -Recurse -Filter *.java src | ForEach-Object { $_.FullName } | Out-File sources.txt
javac -d out "@sources.txt"
```

## REST API reference

All responses are JSON. All requests/responses are same-origin (the API and
frontend are served by the same `HttpServer` instance), so there is no CORS
configuration.

### `GET /api/deliveries`
Returns every delivery logged this session.
```json
[
  {"id":"RT-101","distance":15.00,"vehicleType":"Diesel Van","trafficLevel":"High","calculatedEmissions":2812.50}
]
```

### `POST /api/deliveries`
Body: `application/x-www-form-urlencoded` with fields `id`, `distance`,
`vehicleType` (`Petrol Bike` | `EV` | `Diesel Van`), `trafficLevel`
(`Low` | `Medium` | `High`).
Returns the created log (201) or `{"error": "..."}` (400) if a field is
missing or `distance` isn't a non-negative number.

### `GET /api/summary`
```json
{
  "totalEmissions": 2812.50,
  "deliveryCount": 1,
  "advisoryTriggered": true,
  "advisoryMessage": "Recommendation: Switch high-traffic routes to Electric Vehicles tomorrow."
}
```
`advisoryMessage` is only present when `advisoryTriggered` is `true`.

## Known limitations (by design, not oversights)

- **No persistence** — all data is lost on restart (`LogRepository` is a
  bare in-memory list). Adding a database would be a deliberate scope change.
- **No authentication** — anyone who can reach the port can log deliveries.
  Fine for a local/single-user tool; would need addressing before any
  multi-user or public deployment.
- **Single-threaded HTTP server** (`server.setExecutor(null)`) — intentional,
  since `LogRepository`'s `ArrayList` isn't thread-safe. A concurrent
  executor would need a thread-safe repository first.
- **No JSON request parsing** — see "Why no JSON parsing library" above.

## History

- Original console app (Model/Repository/Service/Util layers) — pre-existing
  before 2026-09-22.
- 2026-09-22: added the `api/` package, `WebServer.java`, and the
  `webapp/` frontend to expose the same backend over HTTP with a browser
  dashboard. Moved the eco-advisory threshold/message out of `MainApp` into
  `EmissionService` (`isAdvisoryTriggered()` / `getAdvisoryMessage()`) so the
  console and web outputs can't disagree. `EmissionService.processNewDelivery`
  now returns the created `DeliveryLog` instead of `void`, so the web API can
  respond with the computed emissions in one round trip.
