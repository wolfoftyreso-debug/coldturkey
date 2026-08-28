# Integritetspolicy — Cleat

**Status: UTKAST. Inte granskat av jurist.** Det här dokumentet är skrivet
utifrån vad koden i det här repot faktiskt gör, rad för rad, så att en jurist
ska kunna granska en beskrivning som stämmer i stället för att skriva en från
noll. Det är inte juridisk rådgivning och får inte publiceras som gällande
policy förrän det granskats.

Senast uppdaterad: se git-historiken för den här filen.

---

## Kort version

Cleat hanterar uppgifter om beroende och återhämtning. Det är hälsouppgifter,
alltså en särskild kategori av personuppgifter enligt artikel 9 i GDPR, och de
kräver ett starkare skydd än nästan allt annat. Vi samlar in så lite som
möjligt, krypterar det du skriver, säljer aldrig något, bygger inga
annonsprofiler och delar ingenting med försäkringsbolag eller arbetsgivare.
Du kan när som helst hämta ut allt eller radera allt själv i appen.

## Vem som är ansvarig

| Roll | Vem | När |
|---|---|---|
| Personuppgiftsansvarig | *[Bolagsnamn, org.nr, adress — fylls i]* | När du registrerar dig själv som privatperson |
| Personuppgiftsbiträde | Samma bolag | När du fått ditt konto genom en klinik eller arbetsgivare. Då är verksamheten ansvarig och vi behandlar uppgifterna på deras uppdrag, enligt personuppgiftsbiträdesavtalet |

Dataskyddsombud: *[kontaktuppgift — krävs sannolikt, se DPIA.md]*

## Vad vi behandlar

Det här är den fullständiga listan över vad databasen innehåller.

### Kontouppgifter
E-postadress, lösenord (lagras enbart som scrypt-hash, aldrig i klartext),
visningsnamn, språk, land, tidszon, roll i organisationen, tidpunkter för
skapande och e-postbekräftelse.

### Uppgifter om din återhämtning
Din plan (substans, tidigare konsumtion, kostnad, startdatum), återfall du
loggat, dagliga incheckningar med humör och sömn, sug du loggat med styrka,
känsla och plats, triggers du beskrivit, livsdomäner du arbetar med, samt din
egen varför-formulering.

### Fritext du skriver
Anteckningar vid sug, återfall och incheckningar, din varför-formulering,
namn på stödkontakter, triggeretiketter och hela ditt samtal med coachen.

**Allt i den här kategorin krypteras med AES-256-GCM per fält innan det skrivs
till disk**, med en nyckel som inte finns i databasen. Krypteringen binds till
tenant, tabell, kolumn och ägare, så ett värde inte går att flytta till en
annan användares rad.

### Säkerhetsuppgifter
Sessioner (refresh-tokens lagras hashade), misslyckade inloggningsförsök med
IP-adress för att bromsa lösenordsgissning, engångstokens för
lösenordsåterställning och e-postbekräftelse (lagras hashade), och — om du
själv slår på tvåstegsinloggning — en krypterad TOTP-nyckel och hashade
återställningskoder.

### Loggar
En revisionslogg över säkerhetsrelevanta händelser: inloggning, byte av
lösenord, export, radering, ändrad prenumeration. Tekniska loggar innehåller
avsiktligt inte lösenord, tokens, API-nycklar eller fritext du skrivit.

### Vad vi inte samlar in
Personnummer. Diagnoser. Adress. Betalkortsuppgifter (de hanteras av Stripe och
når aldrig våra servrar). Vi spårar dig inte över andra webbplatser och det
finns inga annonsnätverk i produkten.

## Varför vi får behandla det

| Ändamål | Rättslig grund |
|---|---|
| Ge dig verktyget du bett om | Artikel 6.1 b (avtal) och **artikel 9.2 a — ditt uttryckliga samtycke**, som krävs för hälsouppgifter |
| Hålla kontot säkert, bromsa intrångsförsök | Artikel 6.1 f (berättigat intresse: att skydda just den här sortens uppgifter) |
| Skicka lösenordsåterställning och e-postbekräftelse | Artikel 6.1 b |
| Fakturera en organisation | Artikel 6.1 b och 6.1 c (bokföringsskyldighet) |

Ditt uttryckliga samtycke till hälsouppgifterna måste inhämtas separat och
otvetydigt vid registrering, och du kan ta tillbaka det när som helst genom att
radera kontot. **Att detta samtycke inte får vara ett villkor för att komma åt
krisnumren är avsiktligt: `/kris` och `/nara` fungerar utan konto.**

## Vem som ser uppgifterna

**Ingen annan användare.** Isolering mellan organisationer görs i databasen med
row-level security, inte i applikationskoden — en glömd `WHERE tenant_id =`
returnerar noll rader i stället för någon annans.

**Din klinik ser inte vad du skriver.** En organisationslicens ger verksamheten
en egen miljö och platsadministration, inte insyn i coachsamtal eller
anteckningar.

**Underbiträden** — de enda tredje parter som kan komma i kontakt med
uppgifter:

| Underbiträde | Vad de får | Var | Kan stängas av |
|---|---|---|---|
| Anthropic | Innehållet i coachsamtal, när AI-coachen är påslagen | Se Anthropics villkor | Ja — utan API-nyckel körs en lokal coach och ingenting lämnar servern |
| E-postleverantör (Resend) | Din e-postadress och innehållet i systemutskick | EU (eu-west-1) | Nej, krävs för lösenordsåterställning |
| Hostingleverantör | Drift av servrar och databas | *[fylls i]* | Nej |
| Stripe | Organisationens fakturauppgifter. **Inga uppgifter om enskilda användare** | EU/US, SCC | Ja, om ingen organisation betalar |

Vi säljer aldrig uppgifter, delar dem aldrig med försäkringsbolag eller
arbetsgivare, och använder dem aldrig för annonsprofilering.

## Hur länge

| Uppgift | Lagringstid |
|---|---|
| Ditt konto och innehåll | Tills du raderar det |
| Misslyckade inloggningsförsök | 1 dygn |
| Engångstokens | 30 dagar efter att de gått ut |
| Inloggningsutmaningar (2FA) | 5 minuter |
| Revisionslogg | *[bestäms — förslag: 12 månader]* |
| Fakturaunderlag | 7 år (bokföringslagen) |

När du raderar kontot tas raden i `users` bort, och allt tenant-scopat innehåll
försvinner med den genom kaskadborttagning: incheckningar, sug, återfall,
coachsamtal, stödkontakter. Det är en riktig radering, inte en flagga.

## Dina rättigheter

Registerutdrag, rättelse, radering, begränsning, invändning och dataportabilitet
enligt artikel 15–22. Två av dem finns inbyggda och kräver ingen kontakt med
oss: **exportera allt** och **radera allt**, båda under Inställningar. Exporten
är en JSON-fil med allt vi har.

Klagomål lämnas till Integritetsskyddsmyndigheten, imy.se.

## Säkerhet

Kryptering av fritext per fält (AES-256-GCM), lösenord som scrypt-hash,
tvåstegsinloggning som tillval, isolering med row-level security, TLS,
Content-Security-Policy, hastighetsbegränsning på inloggning och
lösenordsåterställning, samt återkallande av alla sessioner vid återanvänt
refresh-token.

**Vad som ännu inte är gjort, och som du har rätt att veta:** produkten har
inte penetrationstestats av utomstående part, och säkerhetstriagen har inte
granskats kliniskt. Båda står som blockerare i `SECURITY_READINESS.md`.

## Barn

Cleat riktar sig till vuxna. Ett konto för någon under 18 kräver särskild
bedömning; anhörigytan `/nara` hänvisar personer under 18 till Bris.

## Ändringar

Väsentliga ändringar meddelas i appen innan de träder i kraft. Historiken
finns i det här repots git-logg.
