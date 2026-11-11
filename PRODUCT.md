# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Delegated, agreed in planning: Vite + React + TypeScript, MapLibre GL JS with AWS Terrarium elevation tiles, OpenFreeMap basemap, GSAP ScrollTrigger, Vitest. Static site with no backend. AI output is cached (no API key), loaded through a client module that a serverless Claude call could replace later.

## Users
Ski tourers, winter mountaineers and snowshoers who go into snowy mountains away from groomed pistes. They plan a tour the evening before, usually alone at a laptop or phone, juggling the avalanche bulletin, a slope map and climber reports in other languages. Secondary: their family and friends, who receive the alert, and mountain clubs or guides preparing group outings.

## Product Purpose
AlpenGuard is an AI safety assistant for ski touring. Before the tour it combines the route, the official avalanche bulletin, the slope and aspect of every part of the route, and recent reports from other climbers (in any language) on one map. It flags the points where these signals agree with the bulletin's risks and suggests an alternative. On the mountain it waits silently. If the user doesn't check in by the return time + 15 minutes, a server-side timer sends a dossier (route, critical points, party, clothing) to the user's contacts by SMS and email.

Tagline from the source document: "Three apps, three languages, one map. And someone who knows where you are."

## Positioning
Other tools each cover one piece (White Risk, Skitourenguru, Strata: bulletin and slope analysis; Cairn, AllTrails Lifeline: overdue alerts). AlpenGuard joins all four in one flow: bulletin + route critical-point analysis + translated reports pinned to points on the route + an overdue alert that carries a rescue dossier.

## Operating Context
- Input: a GPX route plus a spoken or typed plan ("Tomorrow at 8 with Nikos, red jacket, back at the car by 2").
- Sources: EAWS avalanche bulletin (danger 1–5, elevations, aspects; open data), Camptocamp API climber reports (FR/DE/IT), a digital elevation model (slope, aspect).
- Outputs: a risk map (web and mobile), a GPX with waypoints for watch or phone, and the rescue dossier (SMS + email to contacts).
- Reference scenario in the source document (test data): critical point at km 3.8, slope 35°, NE, 2,410 m; alternative via the west ridge, up to 27°; 08:00 depart → 14:00 return → 14:15 dossier to contacts.
- Demo site scenario (computed from real elevation data, Beaufortain): 4.9 km, 1,498 → 2,645 m. Flagged stretch km 4.35–4.55, NW, up to 31°, 2,404–2,518 m. Bulletin (test): considerable (3), wind slab, NW–N–NE above 2,200 m. French report (test), 18 hours old, at the stretch. A 40° W pitch at km 4.58–4.65 is steep but not flagged. Alternative 6.2 km, no flagged stretch.

## Capabilities and Constraints
- AI interprets language only (voice plan, translating and extracting hazards from reports). Clear, auditable rules decide which points are flagged (slope ≥30°, aspect and elevation compared with the bulletin).
- The timer is deliberately simple and independent of AI. The alert never depends on a language model. It runs on the server, so a dead phone battery or lost signal does not stop it.
- In this demo: test data, cached AI output, a simulated timer. Nothing is actually sent.

## Brand Commitments
- Name: AlpenGuard. Language of the site: English.
- Four rules from the source document, binding on all copy and UI:
  1. It never says a slope is safe. It only flags points where the data agree with the bulletin's risks.
  2. AI interprets, rules decide.
  3. Every flag shows its source: which bulletin, which report, how many hours old.
  4. The alert goes to the user's contacts, not directly to rescue services. They decide whether to call 112.
- Route and location data are personal data. They are kept only for the duration of the tour and deleted after return.
- Made by: Fanis Papaspyrou, Anastasis Skourtis, Ioannis Manis, Christos Gkotzamanis (student prototype).

## Evidence on Hand
- Source document: `/Users/pfanis/Documents/Exercises+Projects/introtocs_project/AlpenGuard.pdf` (+ .docx), with a flow diagram, a scenario map and an architecture diagram.
- Stat: in France alone, 28 people had died in avalanches by 24 February 2026 (UIAA / Petzl Foundation).
- Competitor comparison table (White Risk, Skitourenguru, Strata, Cairn, AllTrails Lifeline) from the document.
- No users, testimonials, partners or metrics exist. None may be invented.

## Product Principles
1. Assist the decision, never make it. A safety tool that is confidently wrong is worse than none.
2. Show the source of every claim, with its age.
3. Language understanding is AI; risk judgement is rules anyone can check.
4. The alert path is the simplest, most reliable part of the system.
5. Keep personal data only as long as the tour lasts.

## Accessibility & Inclusion
Danger is never shown by colour alone (each EAWS level also carries its number and name). Respect prefers-reduced-motion. Users may read the map outdoors on a phone in bright light, so contrast matters.
