import type { Catalog } from './sv.js';

/**
 * English catalog.
 *
 * Typed as `Catalog`, which is derived from the Swedish object — a missing or
 * misspelled key is a compile error, not a blank line in the interface.
 */
export const en: Catalog = {
  // ---- Brand ----
  'app.name': 'Cleat',
  'app.tagline': 'Rebuild your life.',
  'app.challenger': 'Recovery without the sermon.',
  'app.creed.religion': 'No religion.',
  'app.creed.shame': 'No shame.',
  'app.creed.judgment': 'No judgment.',
  'app.creed.bullshit': 'No bullshit.',
  'app.creed.recovery': 'Just recovery.',
  'app.subtitle': 'No shame. No religion. Just recovery.',

  // ---- The five modes ----
  'mode.reset': "I'M CRAVING",
  'mode.reset.sub': 'Acute help when the craving hits',
  'mode.now': "I'M STRUGGLING",
  'mode.now.sub': "When you're losing your footing",
  'mode.path': 'MY RECOVERY',
  'mode.path.sub': 'Your plan, your phase, your why',
  'mode.patterns': 'MY PATTERNS',
  'mode.patterns.sub': 'Triggers, behaviours and what keeps recurring',
  'mode.rebuild': 'REBUILD MY LIFE',
  'mode.rebuild.sub': 'Relationships, sleep, money, work, identity',

  // ---- Navigation and shell ----
  'nav.home': 'Home',
  'nav.coach': 'Coach',
  'nav.checkin': 'Check-in',
  'nav.stats': 'Patterns',
  'nav.plan': 'My plan',
  'nav.rebuild': 'Rebuild',
  'nav.settings': 'Settings',
  'action.back': 'Back',
  'action.next': 'Next',
  'action.skip': 'Skip',
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.done': 'Done',
  'action.close': 'Close',
  'action.retry': 'Try again',
  'action.delete': 'Delete',
  'action.call': 'Call',
  'action.continue': 'Continue',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong. Try again.',
  // A failed save has to say so, and say something the person can act on. The
  // distinction that matters is "this will work if you try again" versus "this
  // will not", because the second one means going and finding a pen.
  'common.errorOffline': "Couldn't reach the server. Check your connection — what you wrote is still here.",
  'common.errorUnavailable': "We're briefly unavailable. Try again in a moment — what you wrote is still here.",
  'common.errorRateLimited': 'Too many attempts at once. Wait a moment and try again.',
  'common.errorValidation': "That didn't go through. Check what you entered.",
  'common.errorSignedOut': 'You were signed out. Sign in again to save this.',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.optional': 'Optional',
  'common.today': 'Today',
  'common.day': 'Day',
  'common.days': 'days',
  'common.hours': 'hours',
  'common.minutes': 'minutes',
  'common.of': 'of',
  'common.notEnoughData': 'Not enough data yet',

  // ---- Home screen ----
  'home.dayCount': 'Day {days}',
  'home.hoursIn': '{hours} hours in',
  'home.sinceLastUse': 'since last use',
  'home.today': 'Today',
  'home.quickActions': 'Quick actions',
  // Shown only once the current streak has passed every earlier one, so it can
  // say something that has actually happened. It is not a label for the
  // longest-streak figure — that is streak.longest.
  'home.personalRecord': 'Longer than you have ever managed',
  'home.totalInRecovery': '{days} days in recovery in total',
  'streak.title': 'Your days',
  'streak.current': 'Since last use',
  'streak.longest': 'Longest so far',
  'streak.total': 'In recovery in total',
  'home.nextMilestone': 'Next: {milestone}',
  'milestone.nextTitle': 'Next milestone',
  'milestone.reachedTitle': 'Milestones passed',
  'home.noPlanTitle': "You don't have a plan yet",
  'home.noPlanBody':
    "You don't have to be sure you're quitting to start here. We can begin by just looking at what it costs you.",
  'home.startHere': 'Start here',

  // ---- The one-tap actions ----
  'quick.craving': "I'M CRAVING",
  'quick.struggling': "I'M STRUGGLING",
  'quick.talk': 'I NEED TO TALK',
  'quick.messedUp': 'I MESSED UP',
  'quick.doingWell': "I'M DOING WELL",
  'quick.todaysPlan': "TODAY'S PLAN",
  'quick.myWhy': 'MY WHY',
  'quick.callSomeone': 'CALL SOMEONE',
  'quick.checkIn': 'CHECK IN',

  // ---- Craving engine ----
  'craving.title': "Okay. We'll take this together.",
  'craving.step.safety': 'First: are you in immediate danger?',
  'craving.step.safety.yes': 'Yes',
  'craving.step.safety.no': 'No',
  'craving.step.feeling': 'What are you feeling right now?',
  'craving.step.location': 'Where are you?',
  'craving.step.intensity': 'How strong is the craving?',
  'craving.step.coach': "Here's what we do.",
  'craving.delay': "We decide nothing for {minutes} minutes. Just {minutes} minutes.",
  'craving.callFirst': 'Call {name} first.',
  'craving.leaveFirst':
    "The most important thing right now isn't resisting. It's leaving the place.",
  'craving.followup.what_happened_before': 'What happened right before the craving arrived?',
  'craving.logged': 'Logged. This is how we find your pattern.',
  'craving.howDidItGo': 'How did it go?',
  'craving.outcome.resisted': 'I got through it',
  'craving.outcome.used': 'I used',
  'craving.outcome.unknown': "Don't know yet",

  'feeling.craving': 'Craving',
  'feeling.panic': 'Panic',
  'feeling.loneliness': 'Loneliness',
  'feeling.anger': 'Anger',
  'feeling.stress': 'Stress',
  'feeling.boredom': 'Boredom',
  'feeling.grief': 'Grief',
  'feeling.pain': 'Pain',
  'feeling.social_pressure': 'Social pressure',
  'feeling.other': 'Something else',

  'location.home': 'At home',
  'location.work': 'At work',
  'location.party': 'At a party',
  'location.with_users': 'With people who use',
  'location.alone': 'Alone',
  'location.in_transit': 'On my way somewhere',
  'location.other': 'Somewhere else',

  // ---- The ten-minute protocol ----
  'protocol.title': 'The ten-minute protocol',
  'protocol.stop_the_decision': "Stop the decision. You're deciding nothing right now.",
  'protocol.move_away_from_trigger': 'Move away from whatever triggered it.',
  'protocol.say_out_loud': 'Say out loud what is happening: "I am having a craving."',
  'protocol.contact_a_person': 'Contact a person. Any person.',
  'protocol.water_and_body': "Drink water. Eat something if you haven't eaten.",
  'protocol.change_environment': 'Change rooms. Go outside. Change the light.',
  'protocol.wait_ten_minutes': 'Wait ten minutes. Just ten.',
  'protocol.name_what_you_need': 'What do you actually need right now?',
  'protocol.do_the_alternative': 'Do the concrete alternative instead.',
  'protocol.come_back': 'Come back here and tell me how it went.',

  // ---- Urge surfing ----
  'surf.title': 'Ride it out',
  'surf.dont_fight': "Don't try to fight the craving.",
  'surf.observe': 'Observe it instead. Where in your body is it?',
  'surf.signal_not_order': "It's a signal, not an order.",
  'surf.notice_it_change': 'Notice how it changes while you watch it.',
  'surf.nothing_to_do': "We don't have to do anything about it right now.",
  'surf.it_peaks_and_falls': 'It rises, peaks and falls. It always does.',

  // ---- Negotiation detector ----
  'negotiation.none': '',
  'negotiation.detected': 'Stop. That sounds like a negotiation.',
  'negotiation.question': 'Do you want to examine the argument, or act on it?',
  'negotiation.examine': 'Examine the argument',
  'negotiation.act': 'I want to act on it',
  'negotiation.counter.just_once':
    '"Just once" is rarely just once. What happened the last time you said it?',
  'negotiation.counter.earned_it':
    "You have been doing the work. That's true. The question is whether this is the reward you actually want.",
  'negotiation.counter.in_control_now':
    'The control feels real right now. It usually feels exactly like this just before.',
  'negotiation.counter.start_monday':
    "Monday is a way of not deciding today. What would happen if you decided now instead?",
  'negotiation.counter.need_it_to_sleep':
    "Sleep is a real problem and we will fix it. But this doesn't fix it — it moves it.",
  'negotiation.counter.need_it_to_function':
    'You functioned before. What exactly do you need to get through the next hour?',
  'negotiation.counter.everyone_does_it':
    "Other people's use was never your problem. Yours was.",
  'negotiation.counter.deserve_it':
    "You deserve something. That's true. The question is what you want to wake up glad about tomorrow.",
  'negotiation.counter.last_time':
    '"Last time" has a history. What does that history tell you?',
  'negotiation.counter.special_occasion':
    'There is always an occasion. The calendar will never stop handing you reasons.',
  'negotiation.counter.nothing_matters':
    "Feeling that nothing matters is a feeling, not a fact. It usually shifts within hours.",
  'negotiation.counter.testing_myself':
    "You don't need to test it. You already know the answer — that's why you're here.",

  // ---- Safety ----
  'mail.reset.subject': 'Reset your password',
  'mail.reset.body': 'You (or someone who typed in your address) asked to reset the password on your Cleat account. Open the link to choose a new one:',
  'mail.reset.expiry': 'The link stops working in {hours} hours and can only be used once.',
  'mail.reset.ignore': 'If you did not ask for this, you do not need to do anything. Your password is unchanged.',
  'mail.verify.subject': 'Confirm your email address',
  'mail.verify.body': 'Confirm the address is yours, so you can get the account back if you forget your password:',
  'mail.signature': '— Cleat',
  'safety.none': '',
  'safety.elevated':
    "I notice you're describing physical symptoms. Keep an eye on them, and get medical help if they get worse.",
  'safety.urgent':
    'This is bigger than what I can safely help you with in an app. You need human, professional help now.',
  'safety.askDirectly':
    "I want to ask you straight out, because I cannot tell how you mean it: are you thinking about hurting yourself, or about not being here? You do not have to explain. Yes or no is enough.",
  'safety.emergency':
    "Stop. This is an emergency and it should not be handled in an app. Call emergency services now. If you can: don't be alone.",
  'safety.emergencyTitle': 'Are you or someone else in immediate danger?',
  'safety.important': 'Important',
  'safety.stayHere': "I'll stay here while you call.",
  'safety.notAlone': "Try not to be alone right now. Wake someone up if you have to.",
  'safety.resourcesTitle': 'Help you can call right now',
  'safety.helpMeSay': 'Help me put into words what to say to a clinician',
  'safety.disclaimer':
    'Cleat is a coach, not care. It does not replace a doctor, psychiatry, addiction treatment or emergency services.',

  'safety.detox.none': '',
  'safety.detox.alcohol':
    'Important: stopping alcohol abruptly can be life-threatening. Withdrawal can cause seizures and delirium. Talk to a clinician before you stop — they can help you do it safely.',
  'safety.detox.benzodiazepines':
    'Important: stopping benzodiazepines abruptly can be life-threatening. Tapering must be planned with a doctor. Do not do this on your own.',
  'safety.detox.sedatives':
    'Important: stopping sedatives abruptly can be life-threatening. Plan the taper with a doctor.',
  'safety.detox.opioids':
    'Important: tolerance drops fast after a break. Taking your old dose is a leading cause of fatal overdose. Ask a clinician about medication-assisted treatment.',
  'safety.detox.polysubstance':
    'Important: with several substances involved, withdrawal is harder to predict. Do not do this alone — get medical help first.',

  'resource.se.emergency': 'Emergency services (Sweden)',
  'resource.se.health': 'Swedish healthcare advice line',
  'resource.se.mind': 'Mind suicide prevention line',
  'resource.se.alcohol': 'Alcohol helpline (Sweden)',
  'resource.se.gambling': 'Gambling support line (Sweden)',
  'resource.us.emergency': 'Emergency services',
  'resource.us.crisis': 'Suicide & Crisis Lifeline',
  'resource.us.samhsa': 'SAMHSA National Helpline',
  'resource.gb.emergency': 'Emergency services',
  'resource.gb.health': 'NHS 111',
  'resource.gb.samaritans': 'Samaritans',
  'resource.generic.emergency': 'Emergency number',
  'resource.generic.local': 'Your local clinic or emergency department',

  // When to ring which number. One line each, in the words somebody would use
  // about themselves — a list of names and digits does not help a person decide
  // who to call while they are shaking.
  'resource.se.emergency.when':
    'Danger to life, overdose, somebody who will not wake up, a seizure. Around the clock.',
  'resource.se.health.when':
    'Withdrawal, physical symptoms, advice on where to go. Around the clock.',
  'resource.se.mind.when': 'Thoughts of not being here any more, with or without a plan. Around the clock.',
  'resource.se.alcohol.when': "Your own drinking or somebody else's. Anonymous. Weekdays.",
  'resource.se.gambling.when':
    'Gambling, whether you gamble or are close to somebody who does. Weekdays.',
  'resource.us.emergency.when':
    'Danger to life, overdose, somebody who will not wake up, a seizure. Around the clock.',
  'resource.us.crisis.when':
    'Thoughts of not being here any more, with or without a plan. Around the clock.',
  'resource.us.samhsa.when': 'Treatment and support for addiction. Around the clock, free.',
  'resource.gb.emergency.when':
    'Danger to life, overdose, somebody who will not wake up, a seizure. Around the clock.',
  'resource.gb.health.when': 'Withdrawal, physical symptoms, advice on where to go.',
  'resource.gb.samaritans.when': 'Anything that is too heavy to carry alone. Around the clock.',
  'resource.generic.emergency.when':
    'Danger to life, overdose, somebody who will not wake up.',
  'resource.generic.local.when':
    'Look up the number where you are — a helpline that does not answer where you stand costs you the call.',

  // ---- The crisis page: no account, no network dependency, no trace ----
  'crisis.title': 'Numbers to call now',
  'crisis.lede':
    'You do not need an account and you do not need this app. If it is an emergency, call the emergency number.',
  'crisis.noWordsTitle': 'If you do not know what to say',
  'crisis.noWordsBody':
    '"I am not doing well and I do not know who to call" is enough to get somewhere. You do not have to put it well, you do not have to have decided anything, and you do not have to be sure it is serious enough.',
  'crisis.someoneElse':
    'If you are worried about somebody else right now: do not leave them alone, put them in the recovery position if they are unconscious but breathing, and call the emergency number.',
  'crisis.detoxTitle': 'Do not stop everything at once',
  'crisis.detoxBody':
    'Stopping alcohol, benzodiazepines or other sedatives abruptly can cause seizures and delirium, and can be fatal. It is the one situation where what you were about to do is more dangerous than carrying on for another day while you get hold of care. Call the health advice line and ask.',
  'crisis.privacyNote':
    'This page loads nothing from anywhere else, stores nothing about your visit, and works without an account.',

  // ---- Relapse / "I messed up" ----
  'relapse.title': 'I messed up',
  'relapse.opening': 'Okay. No shame. We start here.',
  'relapse.continuity':
    "Your earlier recovery didn't disappear. We start again from this point — with more information than last time.",
  'relapse.safety.are_you_safe': 'Are you safe right now?',
  'relapse.safety.dangerous_amount': 'Have you taken anything that could be acutely dangerous?',
  'relapse.safety.are_you_alone': 'Are you alone?',
  'relapse.safety.need_medical_help': 'Do you need medical help?',
  'relapse.autopsyTitle': "Let's look at what happened",
  'relapse.autopsyIntro':
    "This isn't an interrogation. We're looking for the system failure, not for something you did wrong.",
  'relapse.autopsy.what_happened': 'What happened?',
  'relapse.autopsy.when_did_it_start': 'When did the process start — not the using, the process?',
  'relapse.autopsy.first_trigger': 'What was the first trigger?',
  'relapse.autopsy.what_thought': 'What thought came?',
  'relapse.autopsy.what_feeling': 'What feeling came?',
  'relapse.autopsy.what_decision': 'What decision was made, and when?',
  'relapse.autopsy.ignored_warnings': 'Which warning signs got ignored?',
  'relapse.autopsy.who_was_there': 'Who was around you?',
  'relapse.autopsy.what_could_have_broken_it': 'What could have broken the chain?',
  'relapse.autopsy.what_changes_now': 'What changes now?',
  'relapse.planTitle': 'New protection plan',
  'relapse.planWarnings': 'Warning signs to catch earlier',
  'relapse.planCountermeasures': "Here's what we do instead",
  'relapse.planNeedsWork': 'The plan is thin so far. Want to fill it in with me?',
  'relapse.nextHour': 'What do we do for the next hour?',

  // ---- Check-in ----
  'checkin.morning.title': 'Morning',
  'checkin.evening.title': 'Evening',
  'checkin.mood': 'How are you doing?',
  'checkin.sleep': 'How did you sleep?',
  'checkin.stress': 'How stressed are you?',
  'checkin.craving': 'How strong is the craving?',
  'checkin.biggestRisk': "What's the biggest risk today?",
  'checkin.keyDecision': "What's the most important decision today?",
  'checkin.wentWell': 'What went well?',
  'checkin.wasHard': 'What was hard?',
  'checkin.whenCraving': 'When did the cravings come?',
  'checkin.whatWorked': 'What worked?',
  'checkin.learned': 'What did you learn?',
  'checkin.changeTomorrow': 'What needs to change tomorrow?',
  'checkin.saved': 'Saved.',
  'checkin.alreadyDone': 'You already checked in. Want to change it?',

  // ---- Reclaimed ----
  'reclaimed.moneyTitle': 'Money reclaimed',
  'reclaimed.timeTitle': 'Time reclaimed',
  'reclaimed.framing':
    "You haven't just stopped spending money. You've started buying your life back.",
  'reclaimed.thisWeek': "This week you've got {hours} hours back.",
  'reclaimed.horizon.today': 'Today',
  'reclaimed.horizon.week': 'Week',
  'reclaimed.horizon.month': 'Month',
  'reclaimed.horizon.soFar': 'So far',
  'reclaimed.horizon.year1': 'In 1 year',
  'reclaimed.horizon.year5': 'In 5 years',
  'reclaimed.projection': 'If you keep going',

  // ---- Units ----
  'unit.alcohol': 'standard drink',
  'unit.nicotine': 'cigarette/pouch',
  'unit.dose': 'dose',
  'unit.session': 'session',

  // ---- Substances ----
  'substance.alcohol': 'Alcohol',
  'substance.nicotine': 'Nicotine',
  'substance.cannabis': 'Cannabis',
  'substance.opioids': 'Opioids',
  'substance.stimulants': 'Stimulants',
  'substance.benzodiazepines': 'Benzodiazepines',
  'substance.sedatives': 'Sedatives',
  'substance.polysubstance': 'Several substances',
  'substance.gambling': 'Gambling',
  'substance.other_behaviour': 'Another compulsive behaviour',

  // ---- Milestones ----
  'milestone.shared.day1': 'One day. The hardest day is the first one.',
  'milestone.shared.day3': 'Three days. Your body has started adjusting.',
  'milestone.shared.week1': "One week. You've proved it can be done one day at a time.",
  'milestone.shared.week2': 'Two weeks. Sleep and mood usually start settling here.',
  'milestone.shared.month1': 'One month. Routines start carrying you instead of the reverse.',
  'milestone.shared.month3': 'Three months. Many people describe the head feeling clearer now.',
  'milestone.shared.month6': "Six months. This isn't an experiment any more.",
  'milestone.shared.year1': "One year. You're a person who lives like this now.",

  'milestone.alcohol.h12': '12 hours. Blood sugar starts to stabilise.',
  'milestone.alcohol.h72': '72 hours. Acute withdrawal has usually passed its peak.',
  'milestone.alcohol.week1': 'One week. Sleep usually deepens, even if it starts out messy.',
  'milestone.alcohol.month1': 'One month. Many notice better skin, sleep and energy here.',
  'milestone.alcohol.month3': 'Three months. Your liver has had real time to recover.',
  'milestone.alcohol.year1':
    'One year without alcohol. A full round of seasons, holidays and crises.',

  'milestone.nicotine.min20': '20 minutes. Heart rate and blood pressure start coming down.',
  'milestone.nicotine.h12': '12 hours. Carbon monoxide in your blood has dropped.',
  'milestone.nicotine.h48': '48 hours. Taste and smell start coming back.',
  'milestone.nicotine.week2': 'Two weeks. Circulation has improved.',
  'milestone.nicotine.month1': 'One month. Your lungs handle more than they did.',
  'milestone.nicotine.month3': 'Three months. The cough has usually settled.',
  'milestone.nicotine.year1': 'One year. Heart disease risk has dropped markedly.',

  'milestone.opioids.h12': "12 hours. The worst is ahead, but it's bounded.",
  'milestone.opioids.h72': '72 hours. Acute withdrawal usually peaks here.',
  'milestone.opioids.week1':
    'One week. Remember: your tolerance is low now. An old dose is dangerous.',
  'milestone.opioids.month1': 'One month. Sleep and appetite start finding their way back.',
  'milestone.opioids.month3': 'Three months. Many describe their baseline mood lifting here.',

  'milestone.stimulants.h72': "72 hours. The crash is usually worst now — it passes.",
  'milestone.stimulants.week1': 'One week. Sleep usually starts returning.',
  'milestone.stimulants.month1':
    "One month. Nothing feeling enjoyable is withdrawal, not your life.",
  'milestone.stimulants.month3': 'Three months. Pleasure in ordinary things usually returns here.',

  'milestone.cannabis.h72': '72 hours. Sleep trouble and irritability usually peak now.',
  'milestone.cannabis.week2': 'Two weeks. Dreams settle down, sleep gets more normal.',
  'milestone.cannabis.month1': 'One month. Many notice sharper memory and motivation.',
  'milestone.cannabis.month3': 'Three months. Anxiety levels have usually settled.',

  'milestone.gambling.h72': '72 hours. The strongest urges usually come in waves now.',
  'milestone.gambling.week2': 'Two weeks. Urges get further apart once the pattern breaks.',
  'milestone.gambling.month1': 'One month. Your finances start being possible to look at.',
  'milestone.gambling.month3': "Three months. You've had time to make a real plan.",

  // ---- Phases ----
  'phase.insight': 'Insight',
  'phase.decision': 'Decision',
  'phase.preparation': 'Preparation',
  'phase.day_zero': 'Day zero',
  'phase.acute': 'Acute phase',
  'phase.stabilization': 'Stabilization',
  'phase.identity': 'Identity',
  'phase.relapse_prevention': 'Relapse prevention',
  'phase.reason.no_active_plan': "You don't have an active plan yet.",
  'phase.reason.day_zero': "You've just started. We're only looking at the next few hours.",
  'phase.reason.acute_window': "You're in the acute phase. The goal is getting through the day.",
  'phase.reason.building_stability': "You're building stability in everyday life.",
  'phase.reason.identity_rebuild': "You're building a life, not just a break from using.",
  'phase.reason.long_term': "You're a long way in. Now it's about protecting what you built.",

  'focus.map_the_cost': "Map what it's actually costing you",
  'focus.name_the_pattern': 'Put the pattern into words',
  'focus.what_changed_now': "What's made you start thinking about this now?",
  'focus.write_my_why': 'Write your why',
  'focus.what_i_want_back': 'What do you want back?',
  'focus.readiness_scale': 'How ready are you, on a scale of 1–10?',
  'focus.trigger_map': 'Build your trigger map',
  'focus.remove_access': 'Remove the access',
  'focus.support_network': 'Who knows about this?',
  'focus.next_ten_minutes': 'The next ten minutes',
  'focus.tonight_plan': 'A plan for tonight',
  'focus.who_to_call': 'Who do you call if it gets hard?',
  'focus.get_through_today': 'Get through today',
  'focus.sleep_and_food': 'Sleep and food',
  'focus.craving_protocol': 'Keep the protocol ready',
  'focus.daily_routine': 'Build a routine that holds',
  'focus.money_and_work': 'Money and work',
  'focus.people_and_places': 'People and places',
  'focus.who_am_i_now': 'Who am I without the addiction?',
  'focus.rebuild_relationships': 'Repair relationships',
  'focus.meaningful_activity': 'Something that means something',
  'focus.warning_signs': 'Recognise your warning signs',
  'focus.protection_plan': 'Keep the protection plan alive',
  'focus.keep_the_network': "Don't lose the network",

  // ---- Recovery indicators ----
  'indicator.title': 'Your indicators',
  'indicator.explainer':
    "There is no total score here. Recovery isn't a video game — these are seven separate trends you can act on.",
  'indicator.stability': 'Stability',
  'indicator.stability.desc': 'How steady everyday life is right now.',
  'indicator.craving_control': 'Craving control',
  'indicator.craving_control.desc': 'How you handle cravings when they come.',
  'indicator.routine': 'Routine',
  'indicator.routine.desc': 'How stable your routines are.',
  'indicator.connection': 'Connection',
  'indicator.connection.desc': 'Contact with people.',
  'indicator.purpose': 'Purpose',
  'indicator.purpose.desc': 'Meaningful activity and direction.',
  'indicator.self_trust': 'Self-trust',
  'indicator.self_trust.desc': 'Your ability to keep your own decisions.',
  'indicator.risk': 'Risk',
  'indicator.risk.desc': 'Current relapse risk. Lower is better here.',
  'indicator.trend.up': 'Rising',
  'indicator.trend.down': 'Falling',
  'indicator.trend.flat': 'Steady',
  'indicator.trend.unknown': 'No trend yet',
  'indicator.confidence.low': 'Based on little data',
  'indicator.confidence.medium': 'Based on some data',
  'indicator.confidence.high': 'Based on a lot of data',
  'indicator.samples': 'Based on {count} observations',

  // ---- Insights ----
  'insight.title': 'Your pattern',
  'insight.subtitle': 'This is what your own data says. Does it match?',
  'insight.time_of_day': 'Your cravings mostly come {period} — {percent}% of them.',
  'insight.weekday': 'Your cravings cluster on {weekday} — {percent}% of them.',
  'insight.trigger': '"{trigger}" has set off a craving {count} times.',
  'insight.location': '{percent}% of your cravings have come {location}.',
  'insight.sleep':
    'After bad nights your cravings run {delta} points stronger on average. Based on {poorNights} occasions.',
  'insight.stress':
    'On stressful days your cravings run {delta} points stronger on average. Based on {highDays} occasions.',
  'insight.what_works': '"{action}" has worked for you {count} times.',
  'insight.period.night': 'at night',
  'insight.period.morning': 'in the morning',
  'insight.period.afternoon': 'in the afternoon',
  'insight.period.evening': 'in the evening',
  'insight.weekday.0': 'Sundays',
  'insight.weekday.1': 'Mondays',
  'insight.weekday.2': 'Tuesdays',
  'insight.weekday.3': 'Wednesdays',
  'insight.weekday.4': 'Thursdays',
  'insight.weekday.5': 'Fridays',
  'insight.weekday.6': 'Saturdays',
  'insight.location.home': 'at home',
  'insight.location.work': 'at work',
  'insight.location.party': 'at parties',
  'insight.location.with_users': 'around people who use',
  'insight.location.alone': 'when you were alone',
  'insight.location.in_transit': 'on your way somewhere',
  'insight.location.other': 'in other places',

  // ---- Mantras ----
  'mantra.craving_is_not_command': 'A craving is not a command.',
  'mantra.thought_is_not_decision': 'A thought is not a decision.',
  'mantra.delay_the_decision': 'Delay the decision.',
  'mantra.change_the_environment': 'Change the environment.',
  'mantra.tell_someone': 'Tell someone.',
  'mantra.one_good_decision': 'One good decision at a time.',
  'mantra.relapse_is_information': 'A relapse is information.',
  'mantra.shame_feeds_the_cycle': 'Shame feeds the cycle.',
  'mantra.you_are_not_your_addiction': 'You are not your addiction.',
  'mantra.your_next_decision_matters': 'Your next decision matters.',
  'mantra.dontHaveToWin': "You don't have to win the rest of your life today.",
  'mantra.tenMinutes': "Okay. Then we just take the next ten minutes.",

  // ---- Toolbox ----
  'toolbox.title': 'Toolbox',
  'toolbox.category.acute': 'Acute',
  'toolbox.category.cognitive': 'Thinking',
  'toolbox.category.behavioural': 'Behaviour',
  'toolbox.category.social': 'Social',
  'toolbox.category.life': 'Building a life',
  'toolbox.minutes': '{minutes} min',

  'tool.delay_10_minutes': 'Wait ten minutes',
  'tool.change_environment': 'Change your environment',
  'tool.call_someone': 'Call someone',
  'tool.urge_surfing': 'Ride it out',
  'tool.grounding_54321': 'Grounding 5-4-3-2-1',
  'tool.slow_breathing': 'Slow breathing',
  'tool.drink_water_eat': 'Water and food',
  'tool.move_your_body': 'Move your body',
  'tool.remove_the_trigger': 'Remove the trigger',
  'tool.cold_water': 'Cold water on your face',
  'tool.leave_the_situation': 'Leave the situation',
  'tool.name_the_negotiation': 'Name the negotiation',
  'tool.play_the_tape_forward': 'Play the tape forward',
  'tool.read_my_why': 'Read your why',
  'tool.decisional_balance': 'Weigh it up',
  'tool.challenge_the_thought': 'Challenge the thought',
  'tool.reframe': 'Reframe it',
  'tool.implementation_intention': 'If–then plan',
  'tool.habit_replacement': 'Replace the habit',
  'tool.design_the_evening': 'Design the evening',
  'tool.reward_substitution': 'Substitute the reward',
  'tool.schedule_the_day': 'Lay out the day',
  'tool.block_access': 'Block the access',
  'tool.contact_trusted_person': 'Contact someone you trust',
  'tool.peer_support': 'Meet others in recovery',
  'tool.book_professional': 'Book professional help',
  'tool.tell_someone_today': 'Tell someone today',
  'tool.sleep_routine': 'Sleep routine',
  'tool.exercise': 'Exercise',
  'tool.money_plan': 'A plan for your money',
  'tool.work_next_step': 'Next step with work',
  'tool.repair_a_relationship': 'Repair a relationship',
  'tool.do_something_you_like': 'Do something you actually like',

  // ---- Trigger map ----
  'trigger.title': 'My trigger map',
  'trigger.intro':
    "A craving feels like one event. It isn't — it's a chain. Once you can see the links written down it stops feeling inevitable.",
  'trigger.step.trigger': 'Trigger',
  'trigger.step.thought': 'Thought',
  'trigger.step.feeling': 'Feeling',
  'trigger.step.impulse': 'Impulse',
  'trigger.step.action': 'Action',
  'trigger.step.consequence': 'Consequence',
  'trigger.add': 'Add a trigger',
  'trigger.label': "What's the trigger?",
  'trigger.empty': "You haven't mapped any triggers yet.",
  'trigger.whereToBreak': 'Where can you break the chain?',

  // ---- Cleat Now: I'm struggling ----
  'now.intro':
    "This isn't acute yet. It's the hour before — the one that actually decides. We change something cheap now instead of something expensive later.",
  'now.whatIsHappening': "What's going on?",
  'now.iAm': 'I feel',
  'now.cheapest': 'The cheapest things that tend to work',
  'now.ifItGetsWorse': 'If it grows into a real craving:',

  // ---- Toolbox filters ----
  'toolbox.all': 'Everything',
  'toolbox.quickOnly': 'Quick ones',

  // ---- Offline ----
  'offline.banner': "No connection — but what you need is here anyway.",
  'offline.planSource': 'This plan came from your phone, not the server.',
  'offline.queued': "Logged on your device. It'll sync when you're back online.",
  'offline.notLogged': "Couldn't save that right now. The moment counts anyway.",
  'offline.noKit':
    "We haven't saved your details for offline use yet. The protocol below still works.",
  'offline.title': "You're offline",
  'offline.body':
    'The ten-minute protocol, the tools and your why all work without a connection. Open "I\'m craving" as normal.',

  // ---- Rebuild my life ----
  'rebuild.title': 'Rebuild my life',
  'rebuild.intro':
    "This is the bigger part. Stopping is the beginning — this is what means you don't have to start over.",
  'rebuild.domain.health': 'Health',
  'rebuild.domain.health.desc': "Sleep, food, body, the care you've been putting off.",
  'rebuild.domain.sleep': 'Sleep',
  'rebuild.domain.sleep.desc': 'The single biggest lever on your cravings.',
  'rebuild.domain.relationships': 'Relationships',
  'rebuild.domain.relationships.desc': 'Who was affected? What needs acknowledging?',
  'rebuild.domain.money': 'Money',
  'rebuild.domain.money.desc': 'A clear picture, debts, a plan you can actually follow.',
  'rebuild.domain.work': 'Work',
  'rebuild.domain.work.desc': 'Structure, meaning, a living.',
  'rebuild.domain.exercise': 'Exercise',
  'rebuild.domain.exercise.desc': 'Movement that regulates stress, not performance.',
  'rebuild.domain.social': 'Social life',
  'rebuild.domain.social.desc': 'People and places — which carry you, which pull you down?',
  'rebuild.domain.home': 'Home',
  'rebuild.domain.home.desc': 'A safe place to be.',
  'rebuild.domain.identity': 'Identity',
  'rebuild.domain.identity.desc': 'Who am I without the addiction?',
  'rebuild.domain.purpose': 'Purpose',
  'rebuild.domain.purpose.desc': 'Something that means something. Plans for the future.',
  'rebuild.status.untouched': 'Not started',
  'rebuild.status.working': 'In progress',
  'rebuild.status.steady': 'Steady',
  'rebuild.pickOne': 'Pick one area. Not all of them. One.',
  'rebuild.lockedTitle': 'Comes later',
  'rebuild.lockedBody':
    "Nothing is being kept from you — this just isn't realistic to work on yet. It opens up once everyday life is holding.",
  'rebuild.relationships.q1': 'Who was affected?',
  'rebuild.relationships.q2': 'What needs acknowledging?',
  'rebuild.relationships.q3': 'What promise can you actually keep?',
  'rebuild.relationships.q4': 'What do you need to stop promising?',
  'rebuild.relationships.lesson': 'Action counts for more than promise.',

  'rebuild.reason.sleep_evidence':
    'Your own data points here: sleep has been poor for several nights, and your cravings track it.',
  'rebuild.reason.connection_low': 'Contact with people is thin right now. That is the one that goes first.',
  'rebuild.reason.stability_low': 'Everyday life is shaky. We start with the basics.',
  'rebuild.reason.default': 'This is the next thing that carries the most weight.',

  // ---- My why / future self ----
  'why.title': 'My why',
  'why.prompt': 'What do you want back?',
  'why.questions.cost': 'What has the addiction cost you?',
  'why.questions.who': 'Who do you want to be?',
  'why.questions.year': 'What do you want to be able to do in a year?',
  'why.questions.nothing': 'What happens if nothing changes?',
  'why.empty': "You haven't written your why yet. It's what carries you when it gets hard.",
  'why.write': 'Write your why',
  'future.title': 'Future self',
  'future.30': 'In 30 days',
  'future.90': 'In 90 days',
  'future.1y': 'In 1 year',
  'future.5y': 'In 5 years',
  'future.letter': 'A letter from your future self',

  // ---- Support network ----
  'support.title': 'My network',
  'support.empty':
    "You haven't added anyone yet. Even one name makes a difference at two in the morning.",
  'support.add': 'Add a person',
  'support.name': 'Name',
  'support.relation': 'Relationship',
  'support.phone': 'Phone',
  'support.primary': 'Call this one first',
  'support.noRequirement':
    'Cleat will never require you to join any organisation, group or movement.',

  // ---- Coach ----
  'coach.title': 'Coach',
  'coach.placeholder': "Tell me what's happening…",
  'coach.send': 'Send',
  'coach.thinking': 'Thinking…',
  'coach.offline':
    'The coach is offline right now, but the tools still work. Want to run the ten-minute protocol?',
  'coach.greeting.day_zero': "You've started. We'll take the next ten minutes.",
  'coach.greeting.acute': "How is it right now — not today, right now?",
  'coach.greeting.stabilization': "What's hardest this week?",
  'coach.greeting.identity': 'What do you want to build next?',
  'coach.greeting.default': "What's going on?",
  'coach.notATherapist': "I'm your coach. Not your doctor, not your therapist, not your judge.",

  // ---- Auth and onboarding ----
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.signOut': 'Sign out',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'What should I call you?',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': 'No account yet?',
  'auth.invalid': 'Wrong email or password.',
  'auth.weakPassword': 'Password must be at least 12 characters.',
  'auth.emailTaken': 'There is already an account with that email.',

  // Two-factor. The tone matters here: this is a lock on the most private
  // record most people will ever keep, and the reason to use it is concrete —
  // not "best practice", but the specific person who might read it.
  'auth.totpTitle': 'Two-step sign-in',
  'auth.totpOn': 'On',
  'auth.totpOffBody':
    'A password on its own can be guessed, reused or already known to somebody who lives with you. With this on, signing in also needs a code from your phone.',
  'auth.totpEnable': 'Turn on two-step sign-in',
  'auth.totpSetupBody':
    'Add this key to an authenticator app, then type the six-digit code it gives you. Nothing changes until that code is accepted, so a mistyped key cannot lock you out.',
  'auth.totpSecretLabel': 'Your key',
  'auth.totpCode': 'Code',
  'auth.totpConfirm': 'Confirm and turn on',
  'auth.totpWrongCode': 'That code did not match. Check the clock on your phone and try the next one.',
  'auth.totpNotStarted': 'Start again — that setup is no longer open.',
  'auth.totpAlreadyOn': 'Two-step sign-in is already on.',
  'auth.totpDisable': 'Turn off two-step sign-in',
  'auth.totpDisablePassword': 'Your password',
  'auth.totpCodesLeft': '{count} recovery codes left',
  'auth.totpRecoveryTitle': 'Save these recovery codes',
  'auth.totpRecoveryBody':
    'Each one signs you in once if you lose your phone. This is the only time they are shown. Without them, a lost phone means a lost account — and everything you have recorded in it.',
  'auth.totpRecoveryDownload': 'Download as a file',
  'auth.totpRecoverySaved': "I've saved them",
  'auth.totpPrompt': 'Enter the code from your authenticator app.',
  'auth.totpRecoveryHint': 'Lost your phone? Use one of your recovery codes instead.',
  'auth.totpChallengeExpired': 'That took too long, or too many codes were wrong. Sign in again.',
  'onboarding.welcome': 'Welcome to Cleat',
  'onboarding.intro':
    "This isn't a programme to complete. It's a tool for making the next good decision.",
  'onboarding.pickSubstance': 'What do you want to leave behind?',
  'onboarding.usage': 'How much did it usually come to?',
  'onboarding.unitsPerDay': 'Per day',
  'onboarding.cost': 'Roughly what did one {unit} cost?',
  'onboarding.startDate': 'When did you stop — or when are you planning to?',
  'onboarding.notReadyYet': "I haven't stopped yet",
  'onboarding.done': "Done. We start where you are.",

  // ---- Settings and privacy ----
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.language.sv': 'Svenska',
  'settings.language.en': 'English',
  'settings.country': 'Country (for the right emergency numbers)',
  'settings.timezone': 'Time zone',
  'privacy.title': 'Your data',
  'privacy.whatWeKnow': 'What does the app know?',
  'privacy.whyWeKnow': 'Why does it know it?',
  'privacy.whoSees': 'Who can see it?',
  'privacy.principles':
    'Recovery data is extremely sensitive. We minimise collection, never sell your data, build no ad profiles, and share nothing with insurers or employers.',
  'privacy.export': 'Export everything I have',
  'privacy.exportDone': 'Export complete.',
  'privacy.delete': 'Delete my account and all data',
  'privacy.deleteConfirm':
    'This permanently deletes everything and cannot be undone. Type DELETE to confirm.',
  'privacy.deleteWord': 'DELETE',
  'privacy.deletePassword': 'Your password',
  'privacy.deletePasswordWhy':
    'We ask for your password too. A confirmation word stops an accident — only the password stops somebody else who picked up your unlocked phone.',
  'privacy.deleteWrongPassword': 'Wrong password. Nothing has been deleted.',
  'privacy.deleted': "Everything is deleted. Take care of yourself.",
  'privacy.exportShare': 'Share or save the export',
  'privacy.exportLarge':
    'The export is large ({kilobytes} kB). Some apps truncate long text — open the web version if you want it as a file.',

  // ---- Goal of the product ----
  'about.objective':
    "The goal isn't for you to use the app every day forever. The goal is for you to build a life where you don't need it.",
};
