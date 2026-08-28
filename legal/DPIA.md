# Konsekvensbedömning (DPIA) — Cleat

**Status: UTKAST / UNDERLAG. Inte genomförd, inte granskad.**

En DPIA är en process, inte ett dokument. Det här är underlaget till den:
en ärlig beskrivning av behandlingen och riskerna, skriven utifrån vad koden
faktiskt gör, så att den som ska genomföra bedömningen börjar från fakta.

## 1. Krävs en DPIA?

**Ja, med marginal.** Artikel 35.3 b nämner behandling i stor omfattning av
särskilda kategorier av uppgifter. IMY:s förteckning över behandlingar som
kräver DPIA träffar dessutom flera punkter samtidigt:

- hälsouppgifter (artikel 9) om beroende
- sårbara registrerade — personer i aktivt beroende och i kris
- ny teknik: en språkmodell som läser fritext om hälsa
- innovativ användning i kombination med känsliga uppgifter

## 2. Behandlingen

**Ändamål.** Ge en enskild person verktyg vid sug, återfall och kris; ge
anhöriga kunskapsstöd utan uppgifter om den de oroar sig för; ge organisationer
en isolerad miljö för sina klienter.

**Registrerade.** Personer i eller på väg in i återhämtning från ett beroende.
Anhöriga (som inte behöver konto och inte registreras). Anställda hos
kundorganisationer.

**Uppgiftskategorier.** Se `INTEGRITETSPOLICY.md` för fullständig lista. Kärnan
är: självrapporterade uppgifter om substansbruk, återfall, humör, sömn, sug och
fritext om det svåraste i en persons liv.

**Omfattning.** Potentiellt hela den svenska marknaden för beroendestöd.
Behandlingen är kontinuerlig och långvarig — återhämtning mäts i år.

## 3. Nödvändighet och proportionalitet

Uppgifterna är de som verktyget behöver för att fungera; det finns ingen
mängdinsamling "för framtida analys". Personen kan använda krisytorna helt utan
konto, vilket är den strängaste formen av dataminimering: den mest akuta
funktionen kräver noll personuppgifter.

**Kvarstående fråga för bedömningen:** fritexten i coachsamtalen är det mest
känsliga som lagras. Skulle ändamålet uppnås med kortare lagringstid, eller med
att transkriptet raderas efter viss tid? Det är ett produktbeslut som bör tas
medvetet, inte ärvas.

## 4. Risker för de registrerade

Riskerna här är ovanligt konkreta. Det som kan läcka är inte en e-postadress
utan uppgiften att en namngiven person har ett beroende.

| # | Risk | Konsekvens om den inträffar | Sannolikhet | Allvar |
|---|---|---|---|---|
| R1 | Uppgifter når arbetsgivare | Uppsägning, utebliven befordran | Låg | Mycket hög |
| R2 | Uppgifter når försäkringsbolag | Nekad försäkring, höjd premie | Låg | Mycket hög |
| R3 | Uppgifter används i vårdnadstvist | Förlorad umgängesrätt | Låg | Mycket hög |
| R4 | Kontoövertagande av kontrollerande partner | Insyn i återfall och coachsamtal; eskalerat våld | **Medel** | Mycket hög |
| R5 | Läckt säkerhetskopia | Massexponering av beroendehistorik | Låg | Mycket hög |
| R6 | Data korsar organisationsgräns | En klinik ser en annans klienter | Låg | Hög |
| R7 | Fel klassificering i säkerhetstriagen | Missad nödsituation, eller onödigt larm | **Medel** | **Mycket hög** |
| R8 | Coachen ger farligt råd om abstinens | Kramper, delirium, dödsfall | Låg | Mycket hög |

## 5. Åtgärder som redan finns i koden

| Risk | Åtgärd | Var |
|---|---|---|
| R1–R3 | Ingen försäljning, ingen annonsprofilering, inga integrationer mot arbetsgivare eller försäkring. Klinik ser inte klientens fritext | Produktregler, entitlement-lagret |
| R4 | Tvåstegsinloggning; radering kräver lösenord, inte bara session; återanvänt refresh-token dödar alla sessioner; anhörigsamtalet sparas aldrig | `auth/`, `routes/privacy.ts`, `routes/coach.ts` |
| R5 | AES-256-GCM per fält på all fritext, nyckel utanför databasen, AAD binder värdet till tenant/tabell/kolumn/ägare | `crypto/field.ts` |
| R6 | Row-level security med FORCE på varje tenant-scopad tabell; ingen tabell med `tenant_id` är undantagen | migrationer 001, 008, 009 |
| R7 | Deterministisk triage före språkmodellen; nödläge når aldrig modellen; testkorpus | `packages/core/src/safety.ts` |
| R8 | Substansspecifika varningar; inga doser eller nedtrappningsscheman någonstans i produkten | `substances.ts`, systemprompten |

## 6. Kvarstående risk — och det som blockerar

Tre saker kan inte stängas inifrån repot, och de är förutsättningar för att
behandlingen ska kunna anses ha godtagbar restrisk:

1. **Klinisk granskning av säkerhetstriagen (R7).** Ingen utomstående med
   kompetens inom beroende och suicidprevention har granskat reglerna. Det är
   den enskilt största kvarvarande risken, och den är patientsäkerhet snarare
   än dataskydd.
2. **Oberoende penetrationstest (R4, R5, R6).** Allt är testat av samma part
   som byggt det.
3. **Beslut om lagringstid för coachtranskript och revisionslogg.**

## 7. Nästa steg

- Utse personuppgiftsansvarig och dataskyddsombud
- Låt jurist granska `INTEGRITETSPOLICY.md` och `ANVANDARVILLKOR.md`
- Beställ klinisk granskning och penetrationstest
- Besluta lagringstider och skriv in dem
- Förhandsamråd med IMY bör övervägas om restrisken bedöms hög efter åtgärder
