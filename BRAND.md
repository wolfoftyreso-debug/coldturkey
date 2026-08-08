# Cleat — brand book

**Working name for the recovery platform.** This document is the source of truth
for naming, positioning, voice and visual identity. Where it disagrees with the
code, the code is wrong.

---

## 1. Name clearance — read this before spending money on the name

**Status: not cleared. Preliminary research only — but the cleanest result of
everything tested.**

I could not complete a clearance from this environment: the trademark registers
that matter (Justia, Trademarkia) are blocked by the network egress policy, and
TMview and EUIPO are JavaScript applications that cannot be queried
programmatically. DNS and RDAP are also blocked, so every domain claim below is
unverified.

Ten names were tested against the health and software categories. Nine had
conflicts. Cleat had none:

| Name | Conflict found | Verdict |
|---|---|---|
| Kilter | kilterhealth.com; fitness app acquired by Blackbaud | dead |
| Even Keel | EvenKeel — a mental-health app with streaks and data export | dead |
| Cairn | Cairns Health (YC), Cairn Health, Cairn Software | dead |
| Verto | verto.health — 100+ health systems | dead |
| Rivet | Rivet Health, $31.5M raised | dead |
| Trove | Trove Health — medical records | dead |
| Vaka | Vaka Health Foundation | dead |
| Stark | STARK Group — 1,050 Nordic building-materials stores | dead |
| Nivora | Nivora Group — US consumer private equity | adjacent |
| **Cleat** | **none in health or software** | **live** |

### The two real risks

**1. "Cleats" means sports footwear in American English.** Americans will hear a
sports brand. Expect crowded prior art in **class 25** (footwear) and in
fitness-adjacent software.

This is also, unexpectedly, the name's best feature. The brief says a bystander
glancing at the home screen must not be able to guess the category. "Cleat" reads
as a training app. That is close to perfect cover for a product people do not
want to explain.

**2. Swedish hear-test.** Pronounced *kliit*, a Swede may write it "klit" —
slang for clitoris. Not fatal, because the spelling is visible in the App Store,
the icon and the address bar, but it will surface in pure word-of-mouth. Decide
now whether you can live with it, rather than discovering it in a focus group.

### One thing in the name's favour, legally

"Cleat" for a recovery platform is an **arbitrary mark**: a common word applied
to something entirely unrelated to its dictionary meaning. Arbitrary marks are
among the strongest and easiest to defend — the same category as Apple for
computers. That is a better legal position than a coined name is usually assumed
to have, provided the filing avoids the footwear classes.

### What you need to do

1. **Instruct a trademark attorney.** Nothing here substitutes for that, and a
   name that "looks free" on Google is exactly how expensive rebrands start.

2. **File in these classes:**
   - **Class 9** — downloadable software; mobile applications
   - **Class 42** — SaaS; platform as a service
   - **Class 44** — medical and health services; counselling, health coaching
   - **Class 41** — education, training, coaching (defensive; recovery coaching
     sits ambiguously between 41 and 44)
   - Consider **Class 45** if Cleat Circle becomes a peer-support service
   - **Do not** attempt class 25. Concede footwear; it is not your business and
     fighting for it is how a clearance turns into a lawsuit.

3. **Jurisdictions, in order:** EUIPO (covers Sweden and the whole EU in one
   filing), then US, then a Madrid Protocol designation for the rest.

4. **Searches to run:** `CLEAT`, plus `KLEAT`, `CLEET`, `CLEAT*` and the plural
   `CLEATS`. Ask specifically about class 25 prior art and whether any of it is
   broad enough to reach class 9.

5. **Do not** announce the name, buy premium domains, or file the store listings
   until clearance comes back.

---

## 2. Domain strategy — unverified, check before buying

**None of the availability below has been confirmed.** DNS and RDAP were blocked
in the environment where this was written.

`cleat.com` is a common English noun and is almost certainly registered. Assume
you are buying it, not claiming it, and get a price before you commit.

**Priority order:**

1. `cleat.app` — Google-run TLD, HTTPS-only by policy, reads as a product.
   The most realistic primary.
2. `cleat.se` — required for the Swedish market whatever else you do.
3. `cleat.com` — worth a quote; walk away if the number is silly.
4. `getcleat.com`, `trycleat.com`, `cleatapp.com` — defensive.

**Do not** register `cleat.health` or `cleat.care`. A health TLD in the address
bar tells anyone glancing at the screen what the person is dealing with. That is
a privacy leak in the shape of a domain, and it throws away the camouflage the
name just bought you.

**Subdomains.** Organisation tenants resolve by subdomain — `clinic.cleat.app` —
which puts a clinic's name in the URL of every request its patients make. Keep
consumers on the apex; default organisations to a neutral slug (`t-4821.cleat.app`)
and let them opt into a readable one.

---

## 3. Brand architecture

### The change I made to your structure, and why

You specified **Cleat Rebuild** for relapse analysis, and **REBUILD MY LIFE** as
mode 5. That is the same word carrying two unrelated meanings in the same
product — one of them a post-relapse forensic exercise, the other the long-term
life-building surface. Users would meet "Rebuild" on their worst day and again on
their best, meaning different things. Support conversations would be permanently
ambiguous.

I resolved it by giving **Rebuild** to the life-building mode, where the word is
doing its most natural work, and demoting relapse analysis from a sub-brand to a
feature name — **Relapse Autopsy**, inside Cleat Reset. Sub-brands should map to
places in the product; a flow that runs for twenty minutes after a specific event
is a feature, not a destination.

That also gives a clean 1:1 mapping between sub-brands and the five modes, which
your original list did not have (seven sub-brands, five modes). If you disagree,
the change is a one-line revert in the i18n catalog.

### The architecture

| Sub-brand | Mode | What it is |
|---|---|---|
| **Cleat Reset** | I'M CRAVING | The acute craving engine. Safety question, feeling, place, intensity, a plan. Contains Relapse Autopsy. |
| **Cleat Now** | I'M STRUGGLING | Losing your footing but not in an acute craving. The coach, immediately, with the ten-minute protocol one tap away. |
| **Cleat Path** | MY RECOVERY | Personal plan, phase, why statement, future self, milestones. |
| **Cleat Patterns** | MY PATTERNS | Triggers, behaviours, recurring patterns, the seven indicators. |
| **Cleat Rebuild** | REBUILD MY LIFE | Relationships, sleep, money, work, exercise, social life, identity, future. |
| **Cleat Coach** | *cross-cutting* | The AI. Present inside every mode rather than being a mode. |
| **Cleat Circle** | *post-v1* | Community and peer support. |

**Cleat Recovery** is the product name for the whole thing; **Cleat** is the
masterbrand. In the interface the user sees "Cleat" and the mode names — the
sub-brand names are for marketing, support and the roadmap, not for chrome.

**On Cleat Circle:** hold it. Peer support is genuinely valuable and it is also
the single highest-risk surface in a product like this — one bad actor in a
recovery community does real harm, and moderation is a staffing problem, not a
feature. Ship it when you can staff it.

---

## 4. Positioning

**Primary: Cleat — Rebuild your life.**

**Secondary, for challenger contexts: Recovery without the sermon.**

The primary should name the destination, not the enemy. "Recovery without the
sermon" is the sharper line and it is doing something different: it tells people
who bounced off twelve-step programmes that this is for them. That is a campaign
line and a landing-page headline, not a masterbrand tagline — a brand whose
permanent tagline is about what it is *not* has made the thing it rejects into
its own centre of gravity.

### The creed

```
No religion.
No shame.
No judgment.
No bullshit.
Just recovery.
```

Use it in full or not at all. Do not shorten it to three lines for a banner.

### What Cleat is not

Not an app for addicts. Not a sobriety counter. Not a clinic. Not a wellness
brand. Not a friend who is always available.

It is a premium personal recovery coach that happens to run on a phone, and the
design brief follows from that: it should feel like something a person would be
comfortable having open on a train.

### The one-sentence positioning

> For people who want to leave an addiction and build a life that holds, Cleat
> is a secular recovery platform that asks what is happening in your life that
> makes you want to use — and then helps you change it. Unlike sobriety trackers,
> it treats the counter as the least interesting thing about recovery.

---

## 5. Voice

Direct. Warm. Stable. Confronting when it needs to be. Never demeaning.

| Do | Don't |
|---|---|
| "I don't think you need more motivation right now. I think you need to leave." | "You've got this! 💪" |
| "That sounds really heavy." | "I'm sorry you're feeling that way." |
| "We don't have to solve your whole life tonight." | "Let's work on your recovery journey." |
| "That sounds like your brain trying to negotiate with you." | "That's your addiction talking." |
| "A relapse is information." | "You lost your streak." |

No emoji. No exclamation marks. No "journey". No "warrior". No sunrise imagery.

**Response length is a product decision, not a style preference.** In an acute
craving, a long answer is itself a failure — the person cannot read it.

---

## 6. Visual identity

### Palette

Dark, calm, high contrast, one warm accent. The shift from the previous identity
is deliberate: the accent moves from terracotta toward **brass**, which reads as
premium rather than as a warning, and red is reserved exclusively for safety so
that when it appears it means something.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0A0B0D` | Page ground. Neutral near-black; flat `#000` reads cheap on OLED. |
| `--surface` | `#131519` | Cards |
| `--raised` | `#1A1D23` | Interactive surfaces |
| `--border` | `#262A31` | Hairlines |
| `--text` | `#F0F1F3` | Primary text |
| `--dim` | `#A0A6AF` | Body text |
| `--faint` | `#6B7280` | Labels, metadata |
| `--brass` | `#DDA05A` | **Primary accent.** Actions, focus, the day counter. |
| `--brass-strong` | `#E9B274` | Hover |
| `--sage` | `#6FA88E` | Progress, "doing well" |
| `--danger` | `#E5484D` | **Safety only.** Never decorative. |

Contrast: `--brass` on `--ink` is well past 7:1; `--dim` on `--surface` clears
4.5:1. Both were chosen for that, not for the swatch.

### Type

System stack, tuned. Large tight display for numbers, wide-tracked uppercase for
labels and actions. No web fonts: a recovery app must open instantly on a bad
connection, and a font that loads late shifts the layout under someone's thumb.

### Mark

An arc opened at the top and rising — the cycle broken, moving up. Abstract on
purpose: no bottles, no pills, no chains, no silhouettes at windows. It works at
16px in a browser tab and reads as a company, not a support group.

### What the interface must never look like

A hospital. A treatment centre. A twelve-step meeting. A religious app. A
wellness app. Influencer self-help.

---

## 7. App Store and Google Play

**Listing name:** `Cleat` (not "Cleat — Recovery Coach"; the subtitle carries
that and a bare masterbrand ages better).

**Subtitle / short description:** `Rebuild your life.`

**Category:** Health & Fitness, secondary Medical. Not Lifestyle.

**The screenshot problem.** App-store screenshots appear in a person's purchase
history, in family sharing, and on a shared iPad. Lead with the calm surfaces —
Path, Rebuild, Patterns — and keep the acute screens later in the carousel. The
first screenshot should not announce to a bystander what the app is for.

**Age rating:** 17+ is likely unavoidable given the subject matter. Check whether
"Infrequent/Mild Medical or Treatment Information" applies before assuming worse.

**Review risk:** both stores scrutinise health claims. Say what the app does
("coaching", "tracking", "support") and never what it treats. The in-app
disclaimer — *a coach, not care* — must also appear in the listing.

**Privacy nutrition labels:** this is where the product's design pays off.
Nothing is sold, nothing is shared with third parties, no tracking, no ad
identifiers. That should be stated in the listing, because for this category it
is a purchase reason and not a compliance chore.

---

## 8. Open questions

Things I could not decide for you, in rough priority order:

1. **Does the name survive clearance?** Everything else waits on this.
2. **Consumer, clinic, or both?** The platform is multi-tenant and can serve
   both, but the brand cannot be neutral about it forever — a clinic-first brand
   and a consumer-first brand make opposite choices about tone and pricing.
3. **What does Cleat cost?** A free tier that gates the acute craving flow
   behind a paywall would be indefensible. Whatever the model, Reset and Now stay
   free.
4. **Who moderates Circle?** Answer before building it.
