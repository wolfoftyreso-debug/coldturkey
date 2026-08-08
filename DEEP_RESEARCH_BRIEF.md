# Cleat — underlag för djupsökning

**Vad det här är:** ett faktaunderlag om en byggd men ännu inte lanserad
återhämtningsplattform, plus ett forskningsuppdrag. Klistra in hela filen i en
djupsökningssession (GPT Deep Research, Claude Research eller motsvarande) och
kör uppdraget i del D.

**Status:** kod komplett och verifierad, aldrig deployad, noll användare.
**Datum:** 2026-08-08. **Repo:** `wolfoftyreso-debug/coldturkey` (produkten heter
Cleat; repot ska döpas om). **Licens:** MIT.

**Till den som kör analysen:** allt i del A–C är verifierat mot koden, inte
självrapporterat från minnet. Testsiffrorna kommer från faktiska körningar.
Avsnitt C är medvetet obekvämt — luckorna är listade för att de ska granskas,
inte gömmas. Behandla dem som en ofullständig lista och leta efter fler.

---

## Del A — Vad produkten är

### A1. Positionering i en mening

En sekulär återhämtningscoach för beroenden och vanor, byggd kring de tio
minuter då ett återfall faktiskt avgörs, med uttrycklig frånvaro av allt som
kännetecknar tolvstegsrörelsen.

### A2. Produktprinciper (bindande, inbyggda i koden)

Dessa är inte marknadsföring. De är villkor som avgör vad produkten får göra.

Appen får aldrig: predika religion · hänvisa till Gud som lösning · kräva
tolv steg · skamma användaren · kalla användaren svag · romantisera droger ·
ge instruktioner för hur man tar droger eller optimerar rus · rekommendera
farliga kombinationer · ge medicinska ordinationer · rekommendera
självmedicinering · instruera någon att genomföra potentiellt farlig detox
ensam · ersätta professionell vård · låtsas vara läkare eller legitimerad
terapeut · garantera att någon aldrig återfaller · behandla ett återfall som
ett moraliskt misslyckande.

Appen ska aldrig försöka "coacha bort" en medicinsk nödsituation.

Integritet: minimerad datainsamling · tydlig datakontroll · export · radering ·
ingen försäljning av återhämtningsdata · inga annonser baserade på missbruk ·
ingen försäkringsprofilering · ingen arbetsgivarprofilering · ingen dold
datadelning.

Två av dessa är verifierade i testsviten: `packages/i18n/src/i18n.test.ts`
felar om någon översättningssträng innehåller religiöst eller tolvstegsspråk,
eller skambelagd formulering.

### A3. Fem lägen

| Läge | Syfte | Fungerar offline |
|---|---|---|
| **Nu** (Reset) | Sugflödet — tiominutersprotokollet, urge surfing, ditt varför | Ja, helt |
| **Coach** | Samtal, motiverande samtalsteknik, förhandlingsdetektor | Nej |
| **Vägen** (Path) | Fas, plan, varför-formulering, stödkontakter | Nej |
| **Bygg upp** (Rebuild) | Tio livsdomäner på SAMHSA-dimensioner | Nej |
| **Mönster** (Patterns) | Sju indikatorer, insikter, triggerkarta | Nej |

### A4. Domänmotor (`packages/core`, 4 304 rader)

17 moduler, alla rena funktioner utan I/O, testade isolerat.

- **`safety.ts`** — deterministisk triage i fyra nivåer (`none` / `elevated` /
  `urgent` / `emergency`). Kör före språkmodellen, alltid. Vid `emergency`
  sätts `bypassCoach` och modellen kontaktas aldrig.
- **`craving.ts`** — bygger sugplanen: tiominutersprotokoll, fördröjning
  skalad efter intensitet, verktygsval, "lämna platsen först", "ring först".
- **`phases.ts`** — åtta återhämtningsfaser med motivering för klassningen.
- **`score.ts`** — sju indikatorer, **medvetet utan sammanvägt totalvärde**.
  Ett test hävdar att aggregatfältet inte finns. Ett enda tal skulle inbjuda
  till att jaga siffran i stället för att beskriva verkligheten.
- **`streak.ts`** — ett återfall nollställer den pågående serien men rör aldrig
  längsta serien eller totalt antal dagar i återhämtning.
- **`negotiation.ts`** — känner igen de sätt ett sug förhandlar ("bara en
  gång", "jag har varit duktig", "det är speciellt idag") och har ett
  motargument per typ.
- **`relapse.ts`** — återfallsobduktion utan skuldspråk.
- **`rebuild.ts`** — tio livsdomäner, faslåsta så att någon i dag tre inte får
  förslag om karriärplanering; `suggestNextDomain` följer personens egna data.
- **`reclaimed.ts`** — återvunnen tid och pengar.
- **`insights.ts`**, **`milestones.ts`**, **`mantras.ts`**, **`toolbox.ts`**,
  **`substances.ts`**, **`text.ts`**, **`types.ts`**, **`index.ts`**.

### A5. Säkerhetstriagen i detalj

Den viktigaste komponenten. Nuvarande utfall mot korpusen i
`packages/core/src/safety.corpus.test.ts`:

| Kategori | Antal i korpus | Fångas |
|---|---|---|
| Nödlägen (uttalad avsikt, **plan eller medel**, överdos, medvetslös person, medicinsk akut, krampanfall) | 42 | 42 |
| Brådskande (passiv dödslängtan, psykos, risk mot annan, kan inte vara ensam) | 28 | 28 |
| Abstinens i vardagsspråk | 6 | 6 |
| Vanligt återhämtningsprat som ska passera tyst | 29 | 29 |
| Tvetydig slutgiltighet som besvaras med en direkt fråga | 13 | 13 |
| **Kända falsklarm, fastnaglade i egen lista** | **3** | — |

**Efter extern granskning (2026-08-08).** En djupsökningsgranskning hävdade att
triagen fortfarande missade kodväxling, kortform och passiv suicidalitet utan
klassiska nyckelord. Påståendet mättes mot 32 formuleringar: **29 missades.**
Allvarligast var klassen *plan eller medel* — 7 av 7 missade, trots att plan och
medel är den starkaste prediktorn i suicidologi. `"jag har sparat tabletter"`
gav `none`. Den klassen är nu en egen kategori på `emergency`, och 30 av de 32
hanteras. De två kvarvarande är medvetna: `"jag har köpt tabletter"` är oftast
huvudvärkstabletter, och `"jag har en plan"` i en återhämtningsapp betyder en
återhämtningsplan.

De tre falsklarmen är inte utelämnade ur korpusen utan fastnaglade i en egen
lista med motivering per rad, och ett test hävdar att de aldrig får stoppa
coachen. `"skakar av ilska"` delar ordet med abstinensbilden;
`"vill försvinna från jobbet"` delar formulering med det vanligaste svenska
uttrycket för passiv dödslängtan. Att skärpa reglerna förbi dem skulle kosta
de äkta fallen. En korpus som utelämnar sina egna misslyckanden rapporterar en
precision den inte har — samma sorts fel som den ursprungliga gröna sviten.

**En tredje väg för det som varken går att larma på eller släppa igenom.**
`"jag är klar"`, `"tack för allt"`, `"ta hand om hunden"` är ett avsked ungefär
lika ofta som de är en punkt i en vardaglig mening, och ingen ordlista kan
skilja dem åt. Nivån lämnas därför orörd och coachen ställer i stället en rak
fråga först — vilket är vad en människa som lade märke till det hade gjort, och
som kostar en mening när svaret är att någon blev klar med ett projekt. Frågan
garanteras av appen även på modellvägen, i stället för att förlita sig på att
modellen råkar ställa den.

Kostnaden mättes: de korta formerna (`"orkar inte"`) utlöste frågan på tre
vardagliga meningar tills en längdgräns lades in — `"jag orkar inte laga mat"`
har ett objekt och är banal, `"orkar inte"` är ett fragment någon skrev klockan
två. Efter gränsen: noll av 35 godartade meningar utlöser frågan.

**Passiv dödslängtan är skild från uttalad avsikt.** "Jag orkar inte längre"
ger `urgent`: krislinjen först i resurslistan och ett samtal som fortsätter.
"Jag tänker ta livet av mig" ger `emergency`: coachen stoppas, 112 först.

**Mätningen är hela poängen.** En tidigare version av reglerna fångade **3 av
35** nödlägen i en första sondering medan hela testsviten var grön, eftersom
ingen hade skrivit ner vad reglerna skulle fånga. Korpusen är nu
specifikationen, och den ska växa varje gång en lucka hittas.

Landsspecifika resurser finns för SE (112, 1177, 90101 Mind, Alkohollinjen,
Stödlinjen), US (911, 988, SAMHSA) och GB, med generisk fallback.

### A6. Coachen

Anthropic SDK, modell konfigurerbar. Deterministisk triage före modellen.
Prompt-caching på det stabila systemblocket. **Utan API-nyckel degraderar
produkten till en lokal coach som inte är en stubbe** — tiominutersprotokollet,
sugplanen, förhandlingsmotargumenten och insikterna kräver ingen språkmodell.
Samma väg används vid nätverksfel, timeout och när modellen avböjer.

### A7. Plattform

- **API** (`apps/api`, 4 202 rader): Fastify 5, Node 22, TypeScript strict med
  `noUncheckedIndexedAccess`. Zod-validering. `jose` HS256. Lösenordshashning
  med scrypt. Roterande refresh-tokens, bara hash lagras. Helmet, CORS,
  rate limit. 27 endpoints.
- **Multitenans**: PostgreSQL row-level security. `tenant_id` på varje
  tenantskopad tabell, policies på `current_setting('app.tenant_id', true)`,
  och **`FORCE ROW LEVEL SECURITY`** så att även tabellägaren omfattas.
  Isoleringen ligger i databasen, inte i applikationskoden. Testad mot riktig
  PostgreSQL, inte mockad — en mock skulle glatt "bevisa" en isolering
  databasen inte ger.
- **Webb** (`apps/web`, 3 489 rader): Next.js 15 App Router, React 19,
  standalone output, PWA med service worker. 13 rutter.
- **Mobil** (`apps/mobile`, 2 021 rader): Expo 52, React Native 0.76,
  expo-router, expo-secure-store. Bundlar till 2,6 MB Hermes-bytekod.
- **i18n** (`packages/i18n`, 1 598 rader): 545 nycklar × svenska/engelska, noll
  avvikelser i endera riktningen. Nyckelparitet och platshållarparitet testade.
- **Deploy** (`deploy`, 722 rader): Kustomize base + dev/prod. Prod ger 15
  resurser: Namespace, 2 Deployments, 2 Services, Ingress med cert-manager,
  3 NetworkPolicies, 2 PodDisruptionBudgets, HPA, ConfigMap, Secret,
  migrations-Job.
- **CI**: typecheck → tester mot PostgreSQL-service → API-bygge → webbygge →
  mobilbundling → containerbyggen → manifestvalidering.

### A8. Integritet i implementation

- `/v1/privacy/export` — full datauttag.
- `/v1/privacy/account` — radering.
- `/v1/privacy/summary` — vad som lagras.
- Service workern cachar **aldrig** API-svar. Uttrycklig regel i filen:
  återfallshistorik och coachsamtal i en cache på en delad eller stulen enhet
  är ett röjande. Offlinedata ligger i localStorage under användarens kontroll
  så att utloggning rensar det.
- Inga tredjepartsskript i webbklienten. Ingen analytics. Inga annonser.

---

## Del B — Verifierat utförande

Alla siffror från faktiska körningar 2026-08-08, inte uppskattningar.

| Kontroll | Resultat |
|---|---|
| `pnpm -r typecheck` | 5/5 paket rena |
| `packages/core` | 227 tester |
| `packages/i18n` | 19 tester |
| `apps/api` mot riktig PostgreSQL | 49 tester |
| **Totalt** | **295 tester, alla gröna** |
| Webbygge | 18 sidor, 102 kB delad JS |
| Mobilbundling | 2,6 MB Hermes |
| Kustomize dev / prod | 18 / 15 resurser |
| Sugflödet med nätverket avstängt | Fungerar hela vägen |
| 13 webbrutter i webbläsare | Inga fel, inga 4xx/5xx |

### B1. Fel som hittades genom att testa, inte genom att läsa

Relevant för bedömningen av utförandekvalitet — mönstret säger något om vad
mer som kan ligga kvar.

1. **Tenantupplösning tolkade `127.0.0.1` som subdomänen `127`.** Varje anrop
   mot en bar adress fick `unknown_tenant`. 27 tester var gröna eftersom
   Fastifys `inject` använder `localhost`. 18 regressionstester tillkom.
2. **Mobilappen gick inte att bygga alls.** `@babel/runtime` saknades som
   beroende; typecheck var grön hela tiden. CI bundlar nu appen.
3. **Säkerhetstriagen fångade 3 av 35 nödlägen.** Se A5.
4. **`i cut down to five a day` klassades som självskade-nödläge.** Någon
   rapporterar framsteg och blir tillsagd att ringa ambulans — hittades av den
   godartade halvan av korpusen.
5. **Offline loggade ut användaren.** Tre på varandra följande buggar i samma
   flöde, alla hittade med nätverket avstängt i en riktig webbläsare.
6. **Lokala coachen svarade halvt på engelska** i svenska svar.
7. **`cache.addAll` är allt-eller-inget** — en 404 dödade hela precachen.
8. **JavaScripts `\b` är ASCII-baserad**, så `/\bdö\b/u` matchar aldrig. Hela
   den svenska mönstermatchningen hade varit tyst trasig.

---

## Del C — Vad som inte är gjort

Verifierat genom sökning i koden. **Behandla som ofullständig och leta efter
fler.**

### C1. Blockerar lansering

- **Ingen lösenordsåterställning.** Glömt lösenord = förlorat konto och
  förlorad återhämtningshistorik. Ingen e-postinfrastruktur alls. Nu skarpare
  än förut: den nya utlåsningen efter fem felförsök gör att en person som
  glömt sitt lösenord blir låst i 15 minuter utan någon väg tillbaka.
- **Ingen e-postverifiering.**
- ~~**Ingen skärpt rate limit på inloggning.**~~ **Åtgärdat.** Per konto: 5
  misslyckade försök per 15 minuter. Per IP: 100, medvetet mycket lösare
  eftersom mobiloperatörer sätter tusentals riktiga användare bakom en adress
  via CGNAT — ett tight per-IP-tak stoppar inte ett botnät och låser ute ett
  helt telefonnät. Bara misslyckanden räknas; en lyckad inloggning nollställer.
  Räknarna ligger i minnet, så med flera repliker multipliceras taket med
  antalet poddar. En delad lagring är uppföljningen.
  **Bieffekt som gör nästa punkt mer akut:** efter utlåsning nekas även rätt
  lösenord i 15 minuter.
- **Ingen backupstrategi.** Ingen `pg_dump`-schemaläggning, ingen
  point-in-time recovery, ingen återställningsövning.
- **Ingen kryptering i vila konfigurerad.** `pgcrypto` finns i schemat men
  används inte för fältkryptering. Coachsamtal och återfallshistorik ligger i
  klartext i databasen.
- **Ingen felrapportering.** Ingen Sentry eller motsvarande. Ett krascha i
  produktion blir osynligt.
- **Ingen juridisk granskning.** Ingen integritetspolicy, inga
  användarvillkor, ingen DPIA, inget personuppgiftsbiträdesavtal med
  modellleverantören, ingen ställning tagen till om detta är en medicinteknisk
  produkt under MDR.
- **Ingen klinisk granskning.** Säkerhetstriagen är skriven av en utvecklare
  och testad mot en korpus som samma utvecklare skrev. Den har aldrig setts av
  någon med klinisk kompetens inom beroende eller suicidprevention. En extern
  granskning höjde täckningen kraftigt på en eftermiddag, vilket är det
  starkaste argumentet för att en klinisk sådan skulle hitta mer — inte ett
  argument för att det nu är tillräckligt.

### C2. Betydande luckor

- Metrics är en egen räknare, inte Prometheus-format med histogram. Ingen
  tracing.
- Ingen `/v1/auth` tvåfaktor.
- Inget betalflöde, ingen prenumerationsmodell, ingen prissättning.
- Inget onboarding-flöde för nya användare utöver registrering.
- Ingen push-notifiering, vilket är ovanligt för kategorin.
- Ingen datamigreringsväg mellan tenants.
- Ingen lastprofilering. HPA finns men ingen har mätt vad en pod klarar.
- Ingen tillgänglighetsgranskning (WCAG). Mörkt tema med lågkontrastdetaljer
  är en risk.
- Ingen App Store- eller Google Play-inlämning påbörjad. Båda har särskilda
  regler för hälso- och beroendeappar.
- Varumärkesansökan inte inlämnad. Klasserna 9, 42, 44 och 41 är identifierade
  i `BRAND.md`; klass 25 ska inte sökas.
- Domän inte säkrad.

### C3. Kända medvetna avvägningar

- Sju indikatorer utan sammanvägt värde. Gör produkten svårare att
  marknadsföra ("din poäng är 72!") och det är avsikten.
- Tre falsklarm i säkerhetskorpusen behållna framför att missa formuleringarna
  de delar med äkta fall.
- Lokal coach utan språkmodell är fullt funktionell. Ökar underhållsbördan
  eftersom två vägar måste hållas i synk.
- Svenska som standardspråk trots internationell varumärkesambition.

---

## Del D — Forskningsuppdraget

Kör dessa fem spår. Prioritera primärkällor: bolagsregister, appbutikernas
faktiska listningar, publicerade studier, myndighetsvägledning, domar och
tillsynsbeslut. Undvik innehållsmarknadsföring och "topp 10 appar"-listor.

### D1. Konkurrens

Kartlägg fältet för sekulära återhämtnings- och nykterhetsappar internationellt
och i Norden. För var och en: ägare, finansiering, användarbas om känd,
prismodell, plattform, hållning till tolv steg, hur de hanterar akuta
säkerhetssituationer, och vad recensioner i appbutikerna faktiskt klagar på.

Ta uttryckligen ställning till: finns det redan en produkt som gör det Cleat
gör, och i så fall vad är den återstående skillnaden? Om svaret är att
utrymmet är fullt, säg det rakt.

Undersök också: hur många av dem är byggda för alkohol specifikt kontra
beroenden brett, och vad säger det om segmenteringen?

### D2. Marknad och betalningsvilja

- Vem betalar för den här kategorin idag: individer, arbetsgivare,
  försäkringsbolag, regioner, kriminalvård?
- Vad kostar jämförbara produkter och vilken konverteringsgrad rapporteras?
- Finns det offentlig upphandling eller regionala avtal i Norden för digitala
  beroendestöd?
- Hur ser retention ut i kategorin? Beroendeappar har rykte om sig att ha
  brutal churn — vad säger publicerade siffror?
- Vilken roll spelar Alkohollinjen, 1177 och regionernas egna digitala
  tjänster i Sverige, och är de konkurrenter eller distributionskanaler?

### D3. Regelverk — behandla som det allvarligaste spåret

- **MDR/MDCG:** när blir en app som triagerar suicidrisk en medicinteknisk
  produkt i EU? Var går gränsen mellan "wellness" och klass I/IIa? Ge konkreta
  exempel på appar som klassats åt endera hållet.
- **GDPR:** hälsodata är särskild kategori enligt artikel 9. Vad krävs
  konkret? Är DPIA obligatorisk här? Vad gäller för att skicka
  återhämtningsdata till en språkmodellsleverantör — vilken rättslig grund,
  vilket avtal, vilken tredjelandsöverföring?
- **Suicidprevention:** finns bindande eller de facto-standarder för hur en
  konsumentapp ska hantera suicidalt innehåll? Vad kräver Apple och Google i
  sina riktlinjer, och vad har lett till avvisade inlämningar?
- **Ansvar:** vilka rättsfall finns där en app hållits ansvarig för utfall i
  psykisk hälsa? Vad säger de om ansvarsfriskrivningars värde?
- **Svensk rätt:** patientdatalagen, hälso- och sjukvårdslagen — när blir
  detta vårdgivarverksamhet?

### D4. Klinisk hållbarhet

- Vad säger evidensen om digitala interventioner vid beroende — effektstorlek,
  vilka komponenter som bär effekten?
- Är tiominutersprotokollet, urge surfing och motiverande samtalsteknik
  evidensbaserade i självhjälpsformat, eller bara i terapeutledd form?
- Vad är risken med en app som fångar suicidalt innehåll men inte kan agera?
  Finns forskning på falsklarmens effekt på förtroende och fortsatt
  rapportering?
- Granska ställningstagandet att inte ge ett sammanvägt värde. Är det
  försvarbart kliniskt, eller är det en produktposition förklädd till etik?
- **Granska säkerhetskorpusen i A5 kritiskt.** Vilka formuleringar saknas?
  Vilka kulturella eller åldersmässiga uttryck för suicidalitet fångas inte av
  en ordlista skriven av en vuxen svensktalande utvecklare? Vad missas hos
  någon som skriver på slang, på ett tredje språk, eller mycket kort?

### D5. Utförandegranskning

Läs del B och C som en teknisk due diligence.

- Vad i C1 skulle du flytta till "blockerar lansering" som inte redan står
  där? Vad skulle du flytta bort?
- Mönstret i B1 är att fel överlevde eftersom testerna mätte fel sak. Vilka
  **andra** delar av systemet har troligen samma problem? Var är det mest
  sannolikt att en grön svit döljer något?
- Är row-level security rätt isoleringsmekanism för multitenans här, eller
  bör känsliga tenants ha separata databaser?
- Är arkitekturen rimlig för en produkt utan användare, eller är Kubernetes,
  multitenans och tre klienter övermodellering innan produktmarknadspassning?

---

## Del E — Vad analysen ska leverera

Skriv ut i den här ordningen. Var konkret. "Överväg att förbättra säkerheten"
är värdelöst; "lägg per-IP-tak på 5 inloggningsförsök per minut på
`/v1/auth/login` innan lansering" är användbart.

1. **Stoppljus för lansering.** Rött, gult eller grönt, med den enskilt
   viktigaste orsaken först. Om svaret är rött, säg vad som minst måste vara
   gjort för gult.

2. **De tio åtgärderna före deploy**, rangordnade efter risk gånger enkelhet.
   För var och en: vad, varför, ungefärlig arbetsinsats, och vad som går fel
   om den hoppas över.

3. **Regelverksbedömning.** Är detta en medicinteknisk produkt? Vilken
   rättslig grund gäller för modellanropen? Vad måste finnas på plats innan
   första riktiga användaren, och vad kan vänta?

4. **Konkurrensbild.** Var Cleat faktiskt är differentierad, var det bara är
   en till app, och vilken position som är försvarbar om tolv månader.

5. **Kritik av säkerhetstriagen.** Konkreta saknade formuleringar. Konkreta
   fall där den nuvarande nivåindelningen ger fel svar.

6. **Vad som borde skrotas.** Vilka delar av det byggda som inte bär sin vikt
   och skulle göra produkten starkare om de togs bort.

7. **De tre farligaste antagandena** i hela projektet, och vad som skulle
   motbevisa dem billigast.

Var direkt. Underlaget är skrivet för att kunna kritiseras, och en analys som
bekräftar det som redan står här är bortkastad.
