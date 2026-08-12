/**
 * Swedish catalog — the source of truth.
 *
 * The English catalog is type-checked against this object, so adding a key here
 * and forgetting it there is a compile error rather than a blank screen.
 *
 * Voice rules, applied throughout:
 *  - Never shame. No "du misslyckades", no lost-progress language.
 *  - No religion, no higher power, no twelve steps.
 *  - Short in acute states, longer only where the person has room to read.
 *  - Say what to do next, not what the user should feel.
 */
export const sv = {
  // ---- Brand ----
  'app.name': 'Cleat',
  'app.tagline': 'Bygg upp ditt liv igen.',
  'app.challenger': 'Återhämtning utan predikan.',
  // The creed is used in full or not at all. Never shortened for a banner.
  'app.creed.religion': 'Ingen religion.',
  'app.creed.shame': 'Ingen skam.',
  'app.creed.judgment': 'Inget dömande.',
  'app.creed.bullshit': 'Inget skitsnack.',
  'app.creed.recovery': 'Bara återhämtning.',
  'app.subtitle': 'Ingen skam. Ingen religion. Bara återhämtning.',

  // ---- The five modes ----
  // These are the product's spine. Sub-brand names (Cleat Reset, Cleat Now,
  // Cleat Path, Cleat Patterns, Cleat Rebuild) live in marketing and support;
  // the interface shows the person's own words for what they need right now.
  'mode.reset': 'JAG HAR SUG',
  'mode.reset.sub': 'Akut hjälp när suget kommer',
  'mode.now': 'JAG KÄMPAR',
  'mode.now.sub': 'När du håller på att tappa fotfästet',
  'mode.path': 'MIN ÅTERHÄMTNING',
  'mode.path.sub': 'Din plan, din fas, ditt varför',
  'mode.patterns': 'MINA MÖNSTER',
  'mode.patterns.sub': 'Triggers, beteenden och det som återkommer',
  'mode.rebuild': 'BYGG UPP MITT LIV',
  'mode.rebuild.sub': 'Relationer, sömn, ekonomi, arbete, identitet',

  // ---- Navigation and shell ----
  'nav.home': 'Hem',
  'nav.coach': 'Coach',
  'nav.checkin': 'Incheckning',
  'nav.stats': 'Mönster',
  'nav.plan': 'Min plan',
  'nav.rebuild': 'Bygg upp',
  'nav.settings': 'Inställningar',
  'action.back': 'Tillbaka',
  'action.next': 'Nästa',
  'action.skip': 'Hoppa över',
  'action.save': 'Spara',
  'action.cancel': 'Avbryt',
  'action.done': 'Klar',
  'action.close': 'Stäng',
  'action.retry': 'Försök igen',
  'action.delete': 'Radera',
  'action.call': 'Ring',
  'action.continue': 'Fortsätt',
  'common.loading': 'Laddar…',
  'common.error': 'Något gick fel. Försök igen.',
  // Ett misslyckat sparande måste säga ifrån, och säga något man kan göra
  // något åt. Skillnaden som spelar roll är "det funkar om du försöker igen"
  // mot "det gör det inte" — för det andra betyder att hämta papper och penna.
  'common.errorOffline': 'Kunde inte nå servern. Kolla uppkopplingen — det du skrev finns kvar.',
  'common.errorUnavailable': 'Vi är nere en kort stund. Försök igen om en liten stund — det du skrev finns kvar.',
  'common.errorRateLimited': 'För många försök på en gång. Vänta en stund och försök igen.',
  'common.errorValidation': 'Det gick inte igenom. Kolla vad du fyllt i.',
  'common.errorSignedOut': 'Du blev utloggad. Logga in igen för att spara det här.',
  'common.back': 'Tillbaka',
  'common.cancel': 'Avbryt',
  'common.optional': 'Frivilligt',
  'common.today': 'Idag',
  'common.day': 'Dag',
  'common.days': 'dagar',
  'common.hours': 'timmar',
  'common.minutes': 'minuter',
  'common.of': 'av',
  'common.notEnoughData': 'För lite data ännu',

  // ---- Home screen ----
  'home.dayCount': 'Dag {days}',
  'home.hoursIn': '{hours} timmar in',
  'home.sinceLastUse': 'sedan senast',
  'home.today': 'Idag',
  'home.quickActions': 'Snabbval',
  'home.personalRecord': 'Längre än du någonsin klarat',
  'home.totalInRecovery': '{days} dagar i återhämtning totalt',
  'streak.title': 'Dina dagar',
  'streak.current': 'Sedan senast',
  'streak.longest': 'Längsta hittills',
  'streak.total': 'I återhämtning totalt',
  'home.nextMilestone': 'Nästa: {milestone}',
  'milestone.nextTitle': 'Nästa milstolpe',
  'milestone.reachedTitle': 'Passerade milstolpar',
  'home.noPlanTitle': 'Du har ingen plan ännu',
  'home.noPlanBody':
    'Du behöver inte vara säker på att du ska sluta för att börja här. Vi kan börja med att bara titta på vad det kostar dig.',
  'home.startHere': 'Börja här',

  // ---- The one-tap actions ----
  'quick.craving': 'JAG HAR SUG',
  'quick.struggling': 'JAG KÄMPAR',
  'quick.talk': 'JAG BEHÖVER PRATA',
  'quick.messedUp': 'JAG TRAMPADE FEL',
  'quick.doingWell': 'DET GÅR BRA',
  'quick.todaysPlan': 'DAGENS PLAN',
  'quick.myWhy': 'MITT VARFÖR',
  'quick.callSomeone': 'RING NÅGON',
  'quick.checkIn': 'CHECKA IN',

  // ---- Craving engine ----
  'craving.title': 'Okej. Vi tar det här tillsammans.',
  'craving.step.safety': 'Först: är du i omedelbar fara?',
  'craving.step.safety.yes': 'Ja',
  'craving.step.safety.no': 'Nej',
  'craving.step.feeling': 'Vad känner du just nu?',
  'craving.step.location': 'Var är du?',
  'craving.step.intensity': 'Hur starkt är suget?',
  'craving.step.coach': 'Då gör vi så här.',
  'craving.delay': 'Vi bestämmer ingenting på {minutes} minuter. Bara {minutes} minuter.',
  'craving.callFirst': 'Ring {name} först.',
  'craving.leaveFirst': 'Det viktigaste just nu är inte att stå emot. Det är att lämna platsen.',
  'craving.followup.what_happened_before': 'Vad hände precis innan suget kom?',
  'craving.logged': 'Loggat. Det här hjälper oss se ditt mönster.',
  'craving.howDidItGo': 'Hur gick det?',
  'craving.outcome.resisted': 'Jag stod emot',
  'craving.outcome.used': 'Jag använde',
  'craving.outcome.unknown': 'Vet inte än',

  'feeling.craving': 'Sug',
  'feeling.panic': 'Panik',
  'feeling.loneliness': 'Ensamhet',
  'feeling.anger': 'Ilska',
  'feeling.stress': 'Stress',
  'feeling.boredom': 'Tristess',
  'feeling.grief': 'Sorg',
  'feeling.pain': 'Smärta',
  'feeling.social_pressure': 'Socialt tryck',
  'feeling.other': 'Något annat',

  'location.home': 'Hemma',
  'location.work': 'På jobbet',
  'location.party': 'På fest',
  'location.with_users': 'Med personer som använder',
  'location.alone': 'Ensam',
  'location.in_transit': 'På väg någonstans',
  'location.other': 'Annat',

  // ---- The ten-minute protocol ----
  'protocol.title': 'Tiominutersprotokollet',
  'protocol.stop_the_decision': 'Stoppa beslutet. Du bestämmer ingenting nu.',
  'protocol.move_away_from_trigger': 'Flytta dig från det som triggade.',
  'protocol.say_out_loud': 'Säg högt vad som händer: "jag har ett sug".',
  'protocol.contact_a_person': 'Kontakta en människa. Vem som helst.',
  'protocol.water_and_body': 'Drick vatten. Ät något om du inte ätit.',
  'protocol.change_environment': 'Byt rum. Gå ut. Ändra ljuset.',
  'protocol.wait_ten_minutes': 'Vänta tio minuter. Bara tio.',
  'protocol.name_what_you_need': 'Vad behöver du egentligen just nu?',
  'protocol.do_the_alternative': 'Gör det konkreta alternativet istället.',
  'protocol.come_back': 'Kom tillbaka hit och berätta hur det gick.',

  // ---- Urge surfing ----
  'surf.title': 'Rid ut vågen',
  'surf.dont_fight': 'Försök inte slåss mot suget.',
  'surf.observe': 'Observera det istället. Var i kroppen sitter det?',
  'surf.signal_not_order': 'Det är en signal, inte en order.',
  'surf.notice_it_change': 'Lägg märke till hur det förändras medan du tittar på det.',
  'surf.nothing_to_do': 'Vi behöver inte göra någonting åt det just nu.',
  'surf.it_peaks_and_falls': 'Det stiger, toppar och sjunker. Det gör det alltid.',

  // ---- Negotiation detector ----
  'negotiation.none': '',
  'negotiation.detected': 'Stopp. Det där låter som en förhandling.',
  'negotiation.question': 'Vill du undersöka argumentet, eller vill du agera på det?',
  'negotiation.examine': 'Undersök argumentet',
  'negotiation.act': 'Jag vill agera på det',
  'negotiation.counter.just_once':
    '"Bara en gång" är sällan bara en gång. Vad hände senast du sa det?',
  'negotiation.counter.earned_it':
    'Du har varit duktig. Det är sant. Frågan är om det här är belöningen du faktiskt vill ha.',
  'negotiation.counter.in_control_now':
    'Kontrollen känns äkta just nu. Den brukar kännas så precis innan.',
  'negotiation.counter.start_monday':
    'Måndag är ett sätt att slippa bestämma idag. Vad skulle hända om du bestämde nu istället?',
  'negotiation.counter.need_it_to_sleep':
    'Sömnen är ett riktigt problem och det ska vi lösa. Men det här löser den inte — det flyttar den.',
  'negotiation.counter.need_it_to_function':
    'Du fungerade innan. Vad exakt är det du behöver för att ta dig igenom närmaste timmen?',
  'negotiation.counter.everyone_does_it':
    'Andra människors konsumtion har aldrig varit ditt problem. Din har varit det.',
  'negotiation.counter.deserve_it':
    'Du förtjänar något. Det är sant. Frågan är vad du vaknar och är glad över imorgon.',
  'negotiation.counter.last_time':
    '"Sista gången" har en historia. Vad säger den historien dig?',
  'negotiation.counter.special_occasion':
    'Det finns alltid ett tillfälle. Kalendern kommer aldrig att sluta ge dig skäl.',
  'negotiation.counter.nothing_matters':
    'Att det känns meningslöst är en känsla, inte ett faktum. Den brukar ändra sig inom några timmar.',
  'negotiation.counter.testing_myself':
    'Du behöver inte testa. Du vet redan svaret — det är därför du är här.',

  // ---- Safety ----
  'mail.reset.subject': 'Återställ ditt lösenord',
  'mail.reset.body': 'Du (eller någon som skrev in din adress) bad om att återställa lösenordet till ditt Cleat-konto. Öppna länken för att välja ett nytt:',
  'mail.reset.expiry': 'Länken slutar fungera om {hours} timmar och kan bara användas en gång.',
  'mail.reset.ignore': 'Bad du inte om det här behöver du inte göra någonting. Ditt lösenord är oförändrat.',
  'mail.verify.subject': 'Bekräfta din e-postadress',
  'mail.verify.body': 'Bekräfta att adressen är din, så att du kan få tillbaka kontot om du glömmer lösenordet:',
  'mail.signature': '— Cleat',
  'safety.none': '',
  'safety.elevated':
    'Jag noterar att du beskriver kroppsliga symtom. Håll koll på dem, och sök vård om de förvärras.',
  'safety.urgent':
    'Det här är större än vad jag säkert kan hjälpa dig med i en app. Du behöver mänsklig, professionell hjälp nu.',
  'safety.askDirectly':
    'Jag vill bara fråga rakt ut, för jag vet inte hur du menar: tänker du på att skada dig själv eller på att inte finnas kvar? Du behöver inte förklara. Ja eller nej räcker.',
  'safety.emergency':
    'Stopp. Det här är en akut situation och den ska inte hanteras i en app. Ring nödnumret nu. Om du kan: var inte ensam.',
  'safety.emergencyTitle': 'Är du eller någon annan i omedelbar fara?',
  'safety.important': 'Viktigt',
  'safety.stayHere': 'Jag stannar kvar här medan du ringer.',
  'safety.notAlone': 'Försök att inte vara ensam just nu. Väck någon om du måste.',
  'safety.resourcesTitle': 'Hjälp du kan ringa nu',
  'safety.helpMeSay': 'Hjälp mig formulera vad jag ska säga till vården',
  'safety.disclaimer':
    'Cleat är en coach, inte vård. Appen ersätter inte läkare, psykiatri, beroendebehandling eller akutvård.',

  'safety.detox.none': '',
  'safety.detox.alcohol':
    'Viktigt: att sluta tvärt med alkohol kan vara livsfarligt. Abstinens kan ge kramper och delirium. Prata med vården innan du slutar — de kan hjälpa dig göra det säkert.',
  'safety.detox.benzodiazepines':
    'Viktigt: att sluta tvärt med bensodiazepiner kan vara livsfarligt. Nedtrappning ska planeras med läkare. Sluta inte på egen hand.',
  'safety.detox.sedatives':
    'Viktigt: att sluta tvärt med lugnande läkemedel kan vara livsfarligt. Planera nedtrappning med läkare.',
  'safety.detox.opioids':
    'Viktigt: efter ett uppehåll sjunker toleransen snabbt. Att ta samma dos som tidigare är en vanlig orsak till dödlig överdos. Prata med vården om läkemedelsassisterad behandling.',
  'safety.detox.polysubstance':
    'Viktigt: när flera substanser är inblandade är abstinensen svårare att förutse. Gör inte det här ensam — sök vård först.',

  'resource.se.emergency': 'SOS Alarm (akut)',
  'resource.se.health': 'Vårdguiden 1177',
  'resource.se.mind': 'Mind Självmordslinjen',
  'resource.se.alcohol': 'Alkohollinjen',
  'resource.se.gambling': 'Stödlinjen för spelare',
  'resource.us.emergency': 'Emergency services',
  'resource.us.crisis': 'Suicide & Crisis Lifeline',
  'resource.us.samhsa': "SAMHSA National Helpline",
  'resource.gb.emergency': 'Emergency services',
  'resource.gb.health': 'NHS 111',
  'resource.gb.samaritans': 'Samaritans',
  'resource.generic.emergency': 'Nödnummer',
  'resource.generic.local': 'Din lokala vårdcentral eller akutmottagning',

  // ---- Relapse / "I messed up" ----
  'relapse.title': 'Jag trampade fel',
  'relapse.opening': 'Okej. Ingen skam. Vi börjar här.',
  'relapse.continuity':
    'Din tidigare återhämtning försvann inte. Vi börjar om från den här punkten — med mer information än förra gången.',
  'relapse.safety.are_you_safe': 'Är du säker just nu?',
  'relapse.safety.dangerous_amount': 'Har du tagit något som kan innebära akut fara?',
  'relapse.safety.are_you_alone': 'Är du ensam?',
  'relapse.safety.need_medical_help': 'Behöver du medicinsk hjälp?',
  'relapse.autopsyTitle': 'Vi analyserar vad som hände',
  'relapse.autopsyIntro':
    'Det här är inte ett förhör. Vi letar efter systemfelet, inte efter något du gjorde fel.',
  'relapse.autopsy.what_happened': 'Vad hände?',
  'relapse.autopsy.when_did_it_start': 'När började processen — inte användandet, processen?',
  'relapse.autopsy.first_trigger': 'Vilken var den första triggern?',
  'relapse.autopsy.what_thought': 'Vilken tanke kom?',
  'relapse.autopsy.what_feeling': 'Vilken känsla kom?',
  'relapse.autopsy.what_decision': 'Vilket beslut togs, och när?',
  'relapse.autopsy.ignored_warnings': 'Vilka varningssignaler ignorerades?',
  'relapse.autopsy.who_was_there': 'Vilka personer fanns omkring dig?',
  'relapse.autopsy.what_could_have_broken_it': 'Vad kunde ha brutit kedjan?',
  'relapse.autopsy.what_changes_now': 'Vad ändrar vi nu?',
  'relapse.planTitle': 'Ny skyddsplan',
  'relapse.planWarnings': 'Varningssignaler att fånga tidigare',
  'relapse.planCountermeasures': 'Det här gör vi istället',
  'relapse.planNeedsWork': 'Planen är tunn ännu. Vill du fylla i den tillsammans med mig?',
  'relapse.nextHour': 'Vad gör vi under nästa timme?',

  // ---- Check-in ----
  'checkin.morning.title': 'Morgon',
  'checkin.evening.title': 'Kväll',
  'checkin.mood': 'Hur mår du?',
  'checkin.sleep': 'Hur sov du?',
  'checkin.stress': 'Hur stressad är du?',
  'checkin.craving': 'Hur starkt är suget?',
  'checkin.biggestRisk': 'Vad är dagens största risk?',
  'checkin.keyDecision': 'Vad är dagens viktigaste beslut?',
  'checkin.wentWell': 'Vad gick bra?',
  'checkin.wasHard': 'Vad var svårt?',
  'checkin.whenCraving': 'När kom suget?',
  'checkin.whatWorked': 'Vad fungerade?',
  'checkin.learned': 'Vad lärde du dig?',
  'checkin.changeTomorrow': 'Vad behöver ändras imorgon?',
  'checkin.saved': 'Sparat.',
  'checkin.alreadyDone': 'Du har redan checkat in nu. Vill du ändra?',

  // ---- Reclaimed ----
  'reclaimed.moneyTitle': 'Pengar du tagit tillbaka',
  'reclaimed.timeTitle': 'Tid du tagit tillbaka',
  'reclaimed.framing':
    'Du har inte bara slutat spendera pengar. Du har börjat köpa tillbaka ditt liv.',
  'reclaimed.thisWeek': 'Den här veckan har du fått tillbaka {hours} timmar.',
  'reclaimed.horizon.today': 'Idag',
  'reclaimed.horizon.week': 'Vecka',
  'reclaimed.horizon.month': 'Månad',
  'reclaimed.horizon.soFar': 'Hittills',
  'reclaimed.horizon.year1': 'Om 1 år',
  'reclaimed.horizon.year5': 'Om 5 år',
  'reclaimed.projection': 'Om du fortsätter',

  // ---- Units ----
  'unit.alcohol': 'standardglas',
  'unit.nicotine': 'cigarett/prilla',
  'unit.dose': 'dos',
  'unit.session': 'tillfälle',

  // ---- Substances ----
  'substance.alcohol': 'Alkohol',
  'substance.nicotine': 'Nikotin',
  'substance.cannabis': 'Cannabis',
  'substance.opioids': 'Opioider',
  'substance.stimulants': 'Stimulantia',
  'substance.benzodiazepines': 'Bensodiazepiner',
  'substance.sedatives': 'Lugnande läkemedel',
  'substance.polysubstance': 'Flera substanser',
  'substance.gambling': 'Spel om pengar',
  'substance.other_behaviour': 'Annat tvångsmässigt beteende',

  // ---- Milestones ----
  'milestone.shared.day1': 'Ett dygn. Det svåraste dygnet är det första.',
  'milestone.shared.day3': 'Tre dagar. Kroppen har börjat ställa om.',
  'milestone.shared.week1': 'En vecka. Du har bevisat att det går att göra en dag i taget.',
  'milestone.shared.week2': 'Två veckor. Sömn och humör brukar börja stabilisera sig här.',
  'milestone.shared.month1': 'En månad. Rutiner börjar bära dig istället för tvärtom.',
  'milestone.shared.month3': 'Tre månader. Många beskriver att hjärnan känns klarare nu.',
  'milestone.shared.month6': 'Ett halvår. Det här är inte längre ett experiment.',
  'milestone.shared.year1': 'Ett år. Du är en person som lever så här nu.',

  'milestone.alcohol.h12': '12 timmar. Blodsockret börjar stabilisera sig.',
  'milestone.alcohol.h72': '72 timmar. Den akuta abstinensen brukar ha passerat sin topp.',
  'milestone.alcohol.week1': 'En vecka. Sömnen brukar bli djupare, även om den är rörig först.',
  'milestone.alcohol.month1': 'En månad. Många märker bättre hud, sömn och energi här.',
  'milestone.alcohol.month3': 'Tre månader. Levern har fått ordentlig tid att återhämta sig.',
  'milestone.alcohol.year1': 'Ett år utan alkohol. Ett helt varv av årstider, helger och kriser.',

  'milestone.nicotine.min20': '20 minuter. Puls och blodtryck börjar gå ner.',
  'milestone.nicotine.h12': '12 timmar. Kolmonoxidnivån i blodet har sjunkit.',
  'milestone.nicotine.h48': '48 timmar. Smak och lukt börjar komma tillbaka.',
  'milestone.nicotine.week2': 'Två veckor. Blodcirkulationen har förbättrats.',
  'milestone.nicotine.month1': 'En månad. Lungorna orkar mer än de gjorde.',
  'milestone.nicotine.month3': 'Tre månader. Hostan brukar ha lagt sig.',
  'milestone.nicotine.year1': 'Ett år. Risken för hjärtsjukdom har sjunkit markant.',

  'milestone.opioids.h12': '12 timmar. Det värsta ligger framför, men det är avgränsat.',
  'milestone.opioids.h72': '72 timmar. Den akuta abstinensen brukar toppa här.',
  'milestone.opioids.week1':
    'En vecka. Kom ihåg: toleransen är låg nu. En gammal dos är farlig.',
  'milestone.opioids.month1': 'En månad. Sömn och aptit börjar hitta tillbaka.',
  'milestone.opioids.month3': 'Tre månader. Många beskriver att grundstämningen lyfter här.',

  'milestone.stimulants.h72': '72 timmar. Kraschen är oftast som värst nu — den går över.',
  'milestone.stimulants.week1': 'En vecka. Sömnen brukar börja komma tillbaka.',
  'milestone.stimulants.month1': 'En månad. Att inget känns roligt är abstinens, inte ditt liv.',
  'milestone.stimulants.month3': 'Tre månader. Glädje i vanliga saker brukar återvända här.',

  'milestone.cannabis.h72': '72 timmar. Sömnsvårigheter och irritation brukar toppa nu.',
  'milestone.cannabis.week2': 'Två veckor. Drömmarna lugnar sig, sömnen blir mer normal.',
  'milestone.cannabis.month1': 'En månad. Många märker skarpare minne och motivation.',
  'milestone.cannabis.month3': 'Tre månader. Ångestnivån brukar ha lagt sig.',

  'milestone.gambling.h72': '72 timmar. De starkaste impulserna brukar komma i vågor nu.',
  'milestone.gambling.week2': 'Två veckor. Suget kommer glesare när mönstret bryts.',
  'milestone.gambling.month1': 'En månad. Ekonomin börjar gå att överblicka.',
  'milestone.gambling.month3': 'Tre månader. Du har haft tid att göra upp en riktig plan.',

  // ---- Phases ----
  'phase.insight': 'Insikt',
  'phase.decision': 'Beslut',
  'phase.preparation': 'Förberedelse',
  'phase.day_zero': 'Dag noll',
  'phase.acute': 'Akut fas',
  'phase.stabilization': 'Stabilisering',
  'phase.identity': 'Identitet',
  'phase.relapse_prevention': 'Återfallsprevention',
  'phase.reason.no_active_plan': 'Du har ingen aktiv plan ännu.',
  'phase.reason.day_zero': 'Du har precis börjat. Vi tittar bara på de närmaste timmarna.',
  'phase.reason.acute_window': 'Du är i den akuta fasen. Målet är att ta dig igenom dygnet.',
  'phase.reason.building_stability': 'Du bygger stabilitet i vardagen.',
  'phase.reason.identity_rebuild': 'Du bygger ett liv, inte bara ett uppehåll.',
  'phase.reason.long_term': 'Du är långt in. Nu handlar det om att skydda det du byggt.',

  'focus.map_the_cost': 'Kartlägg vad det faktiskt kostar dig',
  'focus.name_the_pattern': 'Sätt ord på mönstret',
  'focus.what_changed_now': 'Vad har fått dig att fundera på det här nu?',
  'focus.write_my_why': 'Formulera ditt varför',
  'focus.what_i_want_back': 'Vad vill du få tillbaka?',
  'focus.readiness_scale': 'Hur redo är du, på en skala 1–10?',
  'focus.trigger_map': 'Gör din triggerkarta',
  'focus.remove_access': 'Ta bort tillgången',
  'focus.support_network': 'Vem vet om det här?',
  'focus.next_ten_minutes': 'De närmaste tio minuterna',
  'focus.tonight_plan': 'Plan för ikväll',
  'focus.who_to_call': 'Vem ringer du om det blir svårt?',
  'focus.get_through_today': 'Ta dig igenom idag',
  'focus.sleep_and_food': 'Sömn och mat',
  'focus.craving_protocol': 'Ha protokollet redo',
  'focus.daily_routine': 'Bygg en rutin som håller',
  'focus.money_and_work': 'Ekonomi och arbete',
  'focus.people_and_places': 'Människor och platser',
  'focus.who_am_i_now': 'Vem är jag utan beroendet?',
  'focus.rebuild_relationships': 'Reparera relationer',
  'focus.meaningful_activity': 'Något som betyder något',
  'focus.warning_signs': 'Känn igen dina varningssignaler',
  'focus.protection_plan': 'Håll skyddsplanen levande',
  'focus.keep_the_network': 'Tappa inte nätverket',

  // ---- Recovery indicators ----
  'indicator.title': 'Dina indikatorer',
  'indicator.explainer':
    'Det finns ingen totalpoäng här. Återhämtning är inte ett datorspel — det här är sju separata trender du kan göra något åt.',
  'indicator.stability': 'Stabilitet',
  'indicator.stability.desc': 'Hur stabil vardagen är just nu.',
  'indicator.craving_control': 'Sugkontroll',
  'indicator.craving_control.desc': 'Hur du hanterar sug när de kommer.',
  'indicator.routine': 'Rutin',
  'indicator.routine.desc': 'Hur stabila dina rutiner är.',
  'indicator.connection': 'Kontakt',
  'indicator.connection.desc': 'Kontakt med människor.',
  'indicator.purpose': 'Mening',
  'indicator.purpose.desc': 'Meningsfull aktivitet och riktning.',
  'indicator.self_trust': 'Självtillit',
  'indicator.self_trust.desc': 'Förmågan att hålla dina egna beslut.',
  'indicator.risk': 'Risk',
  'indicator.risk.desc': 'Aktuell återfallsrisk. Här är lägre bättre.',
  'indicator.trend.up': 'Uppåt',
  'indicator.trend.down': 'Nedåt',
  'indicator.trend.flat': 'Stabil',
  'indicator.trend.unknown': 'Ingen trend ännu',
  'indicator.confidence.low': 'Bygger på lite data',
  'indicator.confidence.medium': 'Bygger på en del data',
  'indicator.confidence.high': 'Bygger på mycket data',
  'indicator.samples': 'Baserat på {count} observationer',

  // ---- Insights ----
  'insight.title': 'Ditt mönster',
  'insight.subtitle': 'Det här är vad din egen data säger. Stämmer det?',
  'insight.time_of_day': 'Dina sug kommer oftast {period} — {percent}% av dem.',
  'insight.weekday': 'Dina sug samlas på {weekday} — {percent}% av dem.',
  'insight.trigger': '"{trigger}" har utlöst sug {count} gånger.',
  'insight.location': '{percent}% av dina sug har kommit {location}.',
  'insight.sleep':
    'Efter dåliga nätter är dina sug i snitt {delta} steg starkare. Det bygger på {poorNights} tillfällen.',
  'insight.stress':
    'På stressiga dagar är dina sug i snitt {delta} steg starkare. Det bygger på {highDays} tillfällen.',
  'insight.what_works': '"{action}" har fungerat för dig {count} gånger.',
  'insight.period.night': 'på natten',
  'insight.period.morning': 'på morgonen',
  'insight.period.afternoon': 'på eftermiddagen',
  'insight.period.evening': 'på kvällen',
  'insight.weekday.0': 'söndagar',
  'insight.weekday.1': 'måndagar',
  'insight.weekday.2': 'tisdagar',
  'insight.weekday.3': 'onsdagar',
  'insight.weekday.4': 'torsdagar',
  'insight.weekday.5': 'fredagar',
  'insight.weekday.6': 'lördagar',
  'insight.location.home': 'hemma',
  'insight.location.work': 'på jobbet',
  'insight.location.party': 'på fest',
  'insight.location.with_users': 'med personer som använder',
  'insight.location.alone': 'när du varit ensam',
  'insight.location.in_transit': 'på väg någonstans',
  'insight.location.other': 'på andra platser',

  // ---- Mantras ----
  'mantra.craving_is_not_command': 'Ett sug är inte en order.',
  'mantra.thought_is_not_decision': 'En tanke är inte ett beslut.',
  'mantra.delay_the_decision': 'Skjut upp beslutet.',
  'mantra.change_the_environment': 'Byt miljö.',
  'mantra.tell_someone': 'Berätta för någon.',
  'mantra.one_good_decision': 'Ett bra beslut i taget.',
  'mantra.relapse_is_information': 'Ett återfall är information.',
  'mantra.shame_feeds_the_cycle': 'Skam göder cykeln.',
  'mantra.you_are_not_your_addiction': 'Du är inte ditt beroende.',
  'mantra.your_next_decision_matters': 'Ditt nästa beslut spelar roll.',
  'mantra.dontHaveToWin': 'Du behöver inte vinna resten av livet idag.',
  'mantra.tenMinutes': 'Okej. Då tar vi bara nästa tio minuter.',

  // ---- Toolbox ----
  'toolbox.title': 'Verktygslåda',
  'toolbox.category.acute': 'Akut',
  'toolbox.category.cognitive': 'Tankar',
  'toolbox.category.behavioural': 'Beteende',
  'toolbox.category.social': 'Socialt',
  'toolbox.category.life': 'Livsbygge',
  'toolbox.minutes': '{minutes} min',

  'tool.delay_10_minutes': 'Vänta tio minuter',
  'tool.change_environment': 'Byt miljö',
  'tool.call_someone': 'Ring någon',
  'tool.urge_surfing': 'Rid ut vågen',
  'tool.grounding_54321': 'Grundning 5-4-3-2-1',
  'tool.slow_breathing': 'Långsam andning',
  'tool.drink_water_eat': 'Vatten och mat',
  'tool.move_your_body': 'Rör på kroppen',
  'tool.remove_the_trigger': 'Ta bort triggern',
  'tool.cold_water': 'Kallt vatten i ansiktet',
  'tool.leave_the_situation': 'Lämna situationen',
  'tool.name_the_negotiation': 'Sätt namn på förhandlingen',
  'tool.play_the_tape_forward': 'Spola filmen framåt',
  'tool.read_my_why': 'Läs ditt varför',
  'tool.decisional_balance': 'Väg för och emot',
  'tool.challenge_the_thought': 'Ifrågasätt tanken',
  'tool.reframe': 'Formulera om',
  'tool.implementation_intention': 'Om–så-plan',
  'tool.habit_replacement': 'Byt ut vanan',
  'tool.design_the_evening': 'Designa kvällen',
  'tool.reward_substitution': 'Byt belöning',
  'tool.schedule_the_day': 'Lägg upp dagen',
  'tool.block_access': 'Blockera tillgången',
  'tool.contact_trusted_person': 'Kontakta någon du litar på',
  'tool.peer_support': 'Träffa andra i återhämtning',
  'tool.book_professional': 'Boka professionell hjälp',
  'tool.tell_someone_today': 'Berätta för någon idag',
  'tool.sleep_routine': 'Sömnrutin',
  'tool.exercise': 'Träning',
  'tool.money_plan': 'Plan för ekonomin',
  'tool.work_next_step': 'Nästa steg med jobbet',
  'tool.repair_a_relationship': 'Reparera en relation',
  'tool.do_something_you_like': 'Gör något du faktiskt gillar',

  // ---- Trigger map ----
  'trigger.title': 'Min triggerkarta',
  'trigger.intro':
    'Ett sug känns som en enda händelse. Det är det inte — det är en kedja. När du ser leden skrivna slutar den kännas oundviklig.',
  'trigger.step.trigger': 'Trigger',
  'trigger.step.thought': 'Tanke',
  'trigger.step.feeling': 'Känsla',
  'trigger.step.impulse': 'Impuls',
  'trigger.step.action': 'Handling',
  'trigger.step.consequence': 'Konsekvens',
  'trigger.add': 'Lägg till en trigger',
  'trigger.label': 'Vad är triggern?',
  'trigger.empty': 'Du har inte kartlagt någon trigger ännu.',
  'trigger.whereToBreak': 'Var kan du bryta kedjan?',

  // ---- Cleat Now: I'm struggling ----
  'now.intro':
    'Det här är inte akut ännu. Det är timmen innan — den som faktiskt avgör. Vi ändrar något billigt nu istället för något dyrt sen.',
  'now.whatIsHappening': 'Vad är det som händer?',
  'now.iAm': 'Jag känner',
  'now.cheapest': 'Det billigaste som brukar funka',
  'now.ifItGetsWorse': 'Om det växer till ett riktigt sug:',

  // ---- Toolbox filters ----
  'toolbox.all': 'Allt',
  'toolbox.quickOnly': 'Går snabbt',

  // ---- Offline ----
  // The craving flow must open with no network. These strings are what the
  // person sees when it does.
  'offline.banner': 'Ingen uppkoppling — men det du behöver finns här ändå.',
  'offline.planSource': 'Planen kommer från din telefon, inte från servern.',
  'offline.queued': 'Loggat lokalt. Skickas när du är online igen.',
  'offline.noKit':
    'Vi har inte hunnit spara dina uppgifter offline än. Protokollet nedan fungerar ändå.',
  'offline.title': 'Du är offline',
  'offline.body':
    'Tiominutersprotokollet, verktygen och ditt varför fungerar utan uppkoppling. Öppna "Jag har sug" så vanligt.',

  // ---- Rebuild my life ----
  // SAMHSA describes recovery through health, home, purpose and community. These
  // domains follow that structure with entirely secular language.
  'rebuild.title': 'Bygg upp mitt liv',
  'rebuild.intro':
    'Det här är den större delen. Att sluta är början — det här är det som gör att du inte behöver börja om.',
  'rebuild.domain.health': 'Hälsa',
  'rebuild.domain.health.desc': 'Sömn, mat, kropp, vård du skjutit upp.',
  'rebuild.domain.sleep': 'Sömn',
  'rebuild.domain.sleep.desc': 'Den enskilt största hävstången på ditt sug.',
  'rebuild.domain.relationships': 'Relationer',
  'rebuild.domain.relationships.desc': 'Vem har påverkats? Vad behöver erkännas?',
  'rebuild.domain.money': 'Ekonomi',
  'rebuild.domain.money.desc': 'Överblick, skulder, en plan som går att följa.',
  'rebuild.domain.work': 'Arbete',
  'rebuild.domain.work.desc': 'Struktur, mening, försörjning.',
  'rebuild.domain.exercise': 'Träning',
  'rebuild.domain.exercise.desc': 'Rörelse som reglerar stress, inte som prestation.',
  'rebuild.domain.social': 'Socialt liv',
  'rebuild.domain.social.desc': 'Människor och platser — vilka bär, vilka drar ner?',
  'rebuild.domain.home': 'Boende',
  'rebuild.domain.home.desc': 'En trygg plats att vara på.',
  'rebuild.domain.identity': 'Identitet',
  'rebuild.domain.identity.desc': 'Vem är jag utan beroendet?',
  'rebuild.domain.purpose': 'Mening',
  'rebuild.domain.purpose.desc': 'Något som betyder något. Framtidsplaner.',
  'rebuild.status.untouched': 'Inte påbörjat',
  'rebuild.status.working': 'Pågår',
  'rebuild.status.steady': 'Stabilt',
  'rebuild.pickOne': 'Välj ett område. Inte alla. Ett.',
  'rebuild.lockedTitle': 'Kommer senare',
  'rebuild.lockedBody':
    'Ingenting hålls undan från dig — det här är bara inte realistiskt att jobba med än. Vi öppnar upp det när vardagen bär.',
  'rebuild.relationships.q1': 'Vem har påverkats?',
  'rebuild.relationships.q2': 'Vad behöver erkännas?',
  'rebuild.relationships.q3': 'Vilket löfte kan du faktiskt hålla?',
  'rebuild.relationships.q4': 'Vad behöver du sluta lova?',
  'rebuild.relationships.lesson': 'Handling väger tyngre än löfte.',

  'rebuild.reason.sleep_evidence':
    'Din egen data pekar hit: sömnen har varit dålig flera nätter, och dina sug följer den.',
  'rebuild.reason.connection_low': 'Kontakten med människor är tunn just nu. Det är den som brister först.',
  'rebuild.reason.stability_low': 'Vardagen är skakig. Vi börjar med grunderna.',
  'rebuild.reason.default': 'Det här är nästa sak som bär mest.',

  // ---- My why / future self ----
  'why.title': 'Mitt varför',
  'why.prompt': 'Vad vill du få tillbaka?',
  'why.questions.cost': 'Vad har beroendet kostat dig?',
  'why.questions.who': 'Vem vill du vara?',
  'why.questions.year': 'Vad vill du kunna göra om ett år?',
  'why.questions.nothing': 'Vad händer om ingenting förändras?',
  'why.empty': 'Du har inte skrivit ditt varför ännu. Det är det som bär när det blir svårt.',
  'why.write': 'Skriv ditt varför',
  'future.title': 'Framtida jag',
  'future.30': 'Om 30 dagar',
  'future.90': 'Om 90 dagar',
  'future.1y': 'Om 1 år',
  'future.5y': 'Om 5 år',
  'future.letter': 'Brev från ditt framtida jag',

  // ---- Support network ----
  'support.title': 'Mitt nätverk',
  'support.empty': 'Du har ingen i listan ännu. Även ett namn gör skillnad klockan två på natten.',
  'support.add': 'Lägg till person',
  'support.name': 'Namn',
  'support.relation': 'Relation',
  'support.phone': 'Telefon',
  'support.primary': 'Ring den här först',
  'support.noRequirement':
    'Cleat kräver aldrig att du går med i någon organisation, grupp eller rörelse.',

  // ---- Coach ----
  'coach.title': 'Coach',
  'coach.placeholder': 'Skriv vad som händer…',
  'coach.send': 'Skicka',
  'coach.thinking': 'Tänker…',
  'coach.offline':
    'Coachen är inte kopplad just nu, men verktygen fungerar. Vill du gå igenom tiominutersprotokollet?',
  'coach.greeting.day_zero': 'Du har börjat. Vi tar de närmaste tio minuterna.',
  'coach.greeting.acute': 'Hur är läget just nu — inte idag, just nu?',
  'coach.greeting.stabilization': 'Vad är det som är svårast den här veckan?',
  'coach.greeting.identity': 'Vad vill du bygga härnäst?',
  'coach.greeting.default': 'Vad händer?',
  'coach.notATherapist':
    'Jag är din coach. Inte din läkare, inte din terapeut, inte din domare.',

  // ---- Auth and onboarding ----
  'auth.signIn': 'Logga in',
  'auth.signUp': 'Skapa konto',
  'auth.signOut': 'Logga ut',
  'auth.email': 'E-post',
  'auth.password': 'Lösenord',
  'auth.displayName': 'Vad ska jag kalla dig?',
  'auth.haveAccount': 'Har du redan ett konto?',
  'auth.noAccount': 'Inget konto ännu?',
  'auth.invalid': 'Fel e-post eller lösenord.',
  'auth.weakPassword': 'Lösenordet måste vara minst 12 tecken.',
  'auth.emailTaken': 'Det finns redan ett konto med den e-posten.',

  // Tvåstegsinloggning. Tonen spelar roll: det här är ett lås på det mest
  // privata de flesta någonsin skriver ner, och skälet att slå på det är
  // konkret — inte "god praxis", utan den bestämda person som annars kan läsa.
  'auth.totpTitle': 'Tvåstegsinloggning',
  'auth.totpOn': 'På',
  'auth.totpOffBody':
    'Ett lösenord kan gissas, återanvändas eller redan vara känt av någon du bor med. Med det här på krävs också en kod från din telefon.',
  'auth.totpEnable': 'Slå på tvåstegsinloggning',
  'auth.totpSetupBody':
    'Lägg in nyckeln i en autentiseringsapp och skriv sedan den sexsiffriga koden den ger dig. Ingenting ändras förrän koden godtas, så en felskriven nyckel kan inte låsa ute dig.',
  'auth.totpSecretLabel': 'Din nyckel',
  'auth.totpCode': 'Kod',
  'auth.totpConfirm': 'Bekräfta och slå på',
  'auth.totpWrongCode': 'Koden stämde inte. Kolla klockan i telefonen och testa nästa.',
  'auth.totpNotStarted': 'Börja om — den uppsättningen är inte öppen längre.',
  'auth.totpAlreadyOn': 'Tvåstegsinloggning är redan på.',
  'auth.totpDisable': 'Stäng av tvåstegsinloggning',
  'auth.totpDisablePassword': 'Ditt lösenord',
  'auth.totpCodesLeft': '{count} återställningskoder kvar',
  'auth.totpRecoveryTitle': 'Spara de här återställningskoderna',
  'auth.totpRecoveryBody':
    'Varje kod loggar in dig en gång om du blir av med telefonen. Det här är enda gången de visas. Utan dem betyder en förlorad telefon ett förlorat konto — och allt du skrivit i det.',
  'auth.totpRecoveryDownload': 'Ladda ner som fil',
  'auth.totpRecoverySaved': 'Jag har sparat dem',
  'auth.totpPrompt': 'Skriv koden från din autentiseringsapp.',
  'auth.totpRecoveryHint': 'Borta telefon? Använd en av dina återställningskoder i stället.',
  'auth.totpChallengeExpired': 'Det tog för lång tid, eller för många fel koder. Logga in igen.',
  'onboarding.welcome': 'Välkommen till Cleat',
  'onboarding.intro':
    'Det här är inte ett program du ska klara av. Det är ett verktyg för att ta nästa bra beslut.',
  'onboarding.pickSubstance': 'Vad vill du lämna?',
  'onboarding.usage': 'Hur mycket brukade det bli?',
  'onboarding.unitsPerDay': 'Per dag',
  'onboarding.cost': 'Ungefär vad kostade ett {unit}?',
  'onboarding.startDate': 'När slutade du — eller när tänker du sluta?',
  'onboarding.notReadyYet': 'Jag har inte slutat än',
  'onboarding.done': 'Klart. Vi börjar där du är.',

  // ---- Settings and privacy ----
  'settings.title': 'Inställningar',
  'settings.language': 'Språk',
  'settings.language.sv': 'Svenska',
  'settings.language.en': 'English',
  'settings.country': 'Land (för rätt nödnummer)',
  'settings.timezone': 'Tidszon',
  'privacy.title': 'Dina uppgifter',
  'privacy.whatWeKnow': 'Vad vet appen?',
  'privacy.whyWeKnow': 'Varför vet den det?',
  'privacy.whoSees': 'Vem kan se det?',
  'privacy.principles':
    'Uppgifter om återhämtning är extremt känsliga. Vi minimerar insamlingen, säljer aldrig dina data, bygger inga annonsprofiler och delar ingenting med försäkringsbolag eller arbetsgivare.',
  'privacy.export': 'Exportera allt jag har',
  'privacy.exportDone': 'Export klar.',
  'privacy.delete': 'Radera mitt konto och all data',
  'privacy.deleteConfirm':
    'Det här raderar allt permanent och går inte att ångra. Skriv RADERA för att bekräfta.',
  'privacy.deleteWord': 'RADERA',
  'privacy.deleted': 'Allt är raderat. Ta hand om dig.',

  // ---- Goal of the product ----
  'about.objective':
    'Målet är inte att du ska använda appen varje dag för alltid. Målet är att du bygger ett liv där du inte behöver den.',
} as const;

export type TranslationKey = keyof typeof sv;
export type Catalog = Record<TranslationKey, string>;
