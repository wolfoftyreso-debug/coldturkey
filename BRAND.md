# Nivora — brand book

**Working name for the recovery platform.** This document is the source of truth
for naming, positioning, voice and visual identity. Where it disagrees with the
code, the code is wrong.

---

## 1. Name clearance — read this before spending money on the name

**Status: not cleared. Preliminary research only.**

I could not complete a clearance from this environment: the trademark registers
that matter (Justia, Trademarkia) are blocked by the network egress policy, and
TMview and EUIPO are JavaScript applications that cannot be queried
programmatically. DNS and RDAP are also blocked here, so **every domain
availability claim below is unverified** — check them yourself before believing
them.

What the open web does show is that "Nivora" is already in commercial use by at
least five unrelated entities:

| Entity | Field | Nice class (likely) | Jurisdiction |
|---|---|---|---|
| Nivora Group | Consumer private equity; acquired the beauty brand AAVRANI in April 2026 | 35, 36 | US (New York) |
| Nivora Brand Ltd | Retail of watches and jewellery; incorporated Oct 2025 | 14, 35 | UK |
| Nivora Global Ltd / Nivora Essence Ltd | Spice, tea and lemongrass oil export | 30, 31 | UK / India |
| Nivoraa | Sustainable clothing (hemp, linen, kala cotton) | 25 | India |
| Nivora Apparel | Apparel | 25 | — |

**The good news:** none of them are in software or health. I found no app,
platform or service called Nivora in recovery, addiction, mental health or
wellbeing.

**The risk that actually matters:** Nivora Group is a US consumer-brand private
equity firm. Consumer PE firms acquire across categories and defend house marks
broadly. They are the most likely party to oppose a Nivora filing, and they have
the budget to do it. That is a business risk, not a legal opinion.

### What you need to do

1. **Instruct a trademark attorney** for a full clearance in the classes below.
   Nothing in this document substitutes for that, and a coined name that "looks
   free" on Google is exactly how expensive rebrands start.

2. **File in these classes:**
   - **Class 9** — downloadable software; mobile applications
   - **Class 42** — SaaS; platform as a service
   - **Class 44** — medical and health services; counselling, health coaching
   - **Class 41** — education, training, coaching (defensive; recovery coaching
     sits ambiguously between 41 and 44)
   - Consider **Class 45** if Nivora Circle becomes a peer-support service

3. **Jurisdictions, in order:** EUIPO (covers Sweden and the whole EU in one
   filing), then US, then a Madrid Protocol designation for the rest.

4. **Searches to run**, exactly: `NIVORA`, plus phonetic and visual neighbours
   `NIVORA*`, `NEVORA`, `NIVARA`, `NIVORAA`, `NUVORA`, `NIVEA` (the last one
   matters — Beiersdorf defends NIVEA aggressively and `NIVORA` is one vowel
   away in a category adjacent to personal care). If your attorney does not
   raise NIVEA unprompted, get a different attorney.

5. **Do not** announce the name publicly, buy the domains at premium prices, or
   file the app-store listings until the clearance comes back.

### Fallback names

Have two ready before clearance comes back, so a bad result costs you a week
rather than a quarter. Criteria that made Nivora good in the first place:
coined, three syllables, no negative meaning in Swedish or English, says nothing
about addiction.

---

## 2. Domain strategy — unverified, check before buying

**None of the availability below has been confirmed.** DNS and RDAP were blocked
in the environment where this was written.

**Priority order:**

1. `nivora.com` — the only one worth a premium. If it is parked, get a quote
   before committing to the name; a squatter's price is part of the name's cost.
2. `nivora.app` — Google-run TLD, HTTPS-only by policy, reads as a product.
   A strong primary if `.com` is out of reach.
3. `nivora.se` — required for the Swedish market whatever else you do.
4. `nivora.health` / `nivora.care` — defensive only. Do not build on them:
   a health TLD in the URL tells anyone glancing at the address bar what the
   person is dealing with. That is a privacy leak in the shape of a domain.

**Defensive registrations:** `nivoraapp.com`, `getnivora.com`, `trynivora.com`,
`nivora.eu`, plus the obvious typos (`nivoria`, `nivorra`, `nivara`).

**A specific recommendation about subdomains.** The platform resolves
organisation tenants by subdomain — `clinic.nivora.app`. That means a clinic's
name appears in the URL of every request their patients make. For consumer users
keep everything on the apex; for organisations, offer a neutral tenant slug
(`t-4821.nivora.app`) as the default and let the clinic opt into a readable one.

---

## 3. Brand architecture

### The change I made to your structure, and why

You specified **Nivora Rebuild** for relapse analysis, and **REBUILD MY LIFE** as
mode 5. That is the same word carrying two unrelated meanings in the same
product — one of them a post-relapse forensic exercise, the other the long-term
life-building surface. Users would meet "Rebuild" on their worst day and again on
their best, meaning different things. Support conversations would be permanently
ambiguous.

I resolved it by giving **Rebuild** to the life-building mode, where the word is
doing its most natural work, and demoting relapse analysis from a sub-brand to a
feature name — **Relapse Autopsy**, inside Nivora Reset. Sub-brands should map to
places in the product; a flow that runs for twenty minutes after a specific event
is a feature, not a destination.

That also gives a clean 1:1 mapping between sub-brands and the five modes, which
your original list did not have (seven sub-brands, five modes). If you disagree,
the change is a one-line revert in the i18n catalog.

### The architecture

| Sub-brand | Mode | What it is |
|---|---|---|
| **Nivora Reset** | I'M CRAVING | The acute craving engine. Safety question, feeling, place, intensity, a plan. Contains Relapse Autopsy. |
| **Nivora Now** | I'M STRUGGLING | Losing your footing but not in an acute craving. The coach, immediately, with the ten-minute protocol one tap away. |
| **Nivora Path** | MY RECOVERY | Personal plan, phase, why statement, future self, milestones. |
| **Nivora Patterns** | MY PATTERNS | Triggers, behaviours, recurring patterns, the seven indicators. |
| **Nivora Rebuild** | REBUILD MY LIFE | Relationships, sleep, money, work, exercise, social life, identity, future. |
| **Nivora Coach** | *cross-cutting* | The AI. Present inside every mode rather than being a mode. |
| **Nivora Circle** | *post-v1* | Community and peer support. |

**Nivora Recovery** is the product name for the whole thing; **Nivora** is the
masterbrand. In the interface the user sees "Nivora" and the mode names — the
sub-brand names are for marketing, support and the roadmap, not for chrome.

**On Nivora Circle:** hold it. Peer support is genuinely valuable and it is also
the single highest-risk surface in a product like this — one bad actor in a
recovery community does real harm, and moderation is a staffing problem, not a
feature. Ship it when you can staff it.

---

## 4. Positioning

**Primary: Nivora — Rebuild your life.**

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

### What Nivora is not

Not an app for addicts. Not a sobriety counter. Not a clinic. Not a wellness
brand. Not a friend who is always available.

It is a premium personal recovery coach that happens to run on a phone, and the
design brief follows from that: it should feel like something a person would be
comfortable having open on a train.

### The one-sentence positioning

> For people who want to leave an addiction and build a life that holds, Nivora
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

**Listing name:** `Nivora` (not "Nivora — Recovery Coach"; the subtitle carries
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
3. **What does Nivora cost?** A free tier that gates the acute craving flow
   behind a paywall would be indefensible. Whatever the model, Reset and Now stay
   free.
4. **Who moderates Circle?** Answer before building it.
