# Personuppgiftsbiträdesavtal (mall) — Cleat

**Status: UTKAST. Inte granskat av jurist.** Används när en organisation —
klinik, behandlingshem, företagshälsa — ger sina klienter konton i Cleat. Då är
organisationen personuppgiftsansvarig och leverantören biträde.

Parter: *[Organisationen]* ("Ansvarig") och *[Bolaget]* ("Biträdet").

## 1. Föremål och varaktighet
Biträdet behandlar personuppgifter för Ansvarigs räkning för att tillhandahålla
Cleat. Avtalet gäller så länge tjänsteavtalet gäller.

## 2. Behandlingens art och ändamål
Tillhandahålla ett självhjälpsverktyg vid beroende till de personer Ansvarig ger
tillgång. Biträdet behandlar uppgifterna **endast** på dokumenterade
instruktioner från Ansvarig, med undantag för vad lag kräver.

## 3. Kategorier
**Registrerade:** klienter/patienter hos Ansvarig, samt Ansvarigs personal med
administratörsroll.
**Uppgifter:** kontouppgifter, självrapporterade uppgifter om substansbruk,
återfall, humör, sömn och sug, samt fritext inklusive coachsamtal. **Detta är
hälsouppgifter enligt artikel 9.**

## 4. Säkerhetsåtgärder (artikel 32)
Biträdet ska minst upprätthålla:
- kryptering av fritext per fält (AES-256-GCM) med nyckel utanför databasen
- lösenord som scrypt-hash; tvåstegsinloggning tillgänglig
- isolering mellan organisationer genom row-level security i databasen
- TLS i transit; hastighetsbegränsning och skydd mot lösenordsgissning
- revisionslogg över säkerhetsrelevanta händelser
- åtskilda miljöer för utveckling och produktion

**Biträdet upplyser uttryckligen om att oberoende penetrationstest ännu inte
genomförts.** Ansvarig bekräftar att detta är känt vid avtalets ingående.

## 5. Personal och sekretess
Endast personal som behöver det får åtkomst, och de omfattas av
sekretessåtagande.

## 6. Underbiträden
Ansvarig godkänner de underbiträden som anges i `INTEGRITETSPOLICY.md`. Biträdet
underrättar Ansvarig innan ett nytt underbiträde anlitas; Ansvarig kan invända
inom 30 dagar. **Anthropic anlitas endast om AI-coachen är påslagen — Ansvarig
kan välja bort den, och tjänsten fungerar utan.**

## 7. Överföring till tredjeland
Behandling sker inom EU/EES. Överföring utanför sker endast med giltig
skyddsmekanism, i normalfallet EU-kommissionens standardavtalsklausuler jämte
bedömning av mottagarlandet.

## 8. Assistans
Biträdet bistår Ansvarig med registrerades rättigheter, säkerhet,
incidentanmälan och konsekvensbedömning. Tjänsten har inbyggd export och
radering som den registrerade kan använda själv.

## 9. Personuppgiftsincident
Biträdet underrättar Ansvarig **utan onödigt dröjsmål och senast inom 24 timmar**
efter att ha fått kännedom om en incident, med den information Ansvarig behöver
för sin anmälan enligt artikel 33.

## 10. Radering
Vid avtalets slut raderas eller återlämnas uppgifterna enligt Ansvarigs val,
utom där lag kräver fortsatt lagring. Radering i tjänsten är en faktisk
borttagning, inte en flagga.

## 11. Granskning
Ansvarig har rätt till revision enligt artikel 28.3 h, i skälig omfattning och
efter rimligt varsel.
