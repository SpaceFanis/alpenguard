# AlpenGuard — design notes

## Inventory (things only this subject has)
1. Name: Alpen (Alps) + Guard. Someone who knows where you are.
2. EAWS danger scale 1–5 with its official colours (green #ccff66, yellow #ffff00, orange #ff9900, red #ff0000, very high black/red).
3. The aspect rose: the bulletin's compass of slope directions (N, NE, E…) with the danger aspects filled in.
4. The 30° threshold, and the slope bands 30–35 / 35–40 / >40°.
5. The critical point: km 3.8, 35°, NE, 2,410 m. Bulletin: danger 3, NE above 2,200 m. A French report 18 h old: cracks and wind slab.
6. The west ridge alternative, ≤27°.
7. The times: 08:00 depart, 14:00 back, 14:15 dossier sent. Return + 15 minutes.
8. The plan said aloud: "Tomorrow at 8 with Nikos, red jacket, back at the car by 2."
9. The rescue dossier: route, critical points, party, clothing → SMS + email to contacts, not to 112.
10. Three languages (FR/DE/IT) of the reports. Camptocamp outings.
11. The constraint: never says a slope is safe. AI interprets, rules decide.
12. 28 avalanche deaths in France by 24 Feb 2026 (UIAA / Petzl Foundation).
13. Data is deleted when you check in.

## Argument (claims → proof)
- hero: One map instead of three apps → the live 3D risk map with the km 3.8 flag
- intro: The cross-checking happens in your head the night before → 3 sources, 3 languages, the stat
- how-it-works: Plan → analysed → on the mountain → closed or sent → the same trip card at four stages
- showcase: If you don't say "I'm back", your people hear → the check-in switch, blown up, swaps the field to alert
- features: What it checks, and where each fact comes from → the command list of checks
- about: The AI reads, the rules decide → architecture facts + the paragraph + sources/outputs lists
- list: Others do one piece each → comparison rows
- faq: Limits and responsibility → the four rules + privacy
- footer: name, sources, demo note

## Idea
On this page, **the critical point at km 3.8, where slope, bulletin and a French report agree**, becomes **the working risk-map fragment the page is built on** (hero = the live map; every later section shows another real fragment of the same trip).
Competitor test: Skitourenguru flags slopes, but not the translated report pinned to km 3.8 or the check-in. Passes.

## Live thing
The demo: run the analysis on the sample tour (or your own GPX), see the flags with their sources, start the tour, fast-forward the clock, and watch the dossier go out. The hero map is live (rotate, tilt, click the flag).

## Palette (subject-adjusted, proportions kept)
Pre-dawn mountain night: ground #0b0d10, surface #15191e, ink #f4f6f8 (snow), muted #8b929a, accent = EAWS orange #ff9a1f (the bulletin's danger 3), accent-ink #0b0d10.
Inside the data-ui fragments: the EAWS scale colours, the route in snow white, the alternative in glacier blue #5ab4ff.

## Redraws
- about → side-facts-wide-paragraph: there is no founder, so a founder's letter would be invented. The architecture facts fit the facts + paragraph shape.
- hero: the dealt "controls on the sentence" is a variable-font demo. Following the direction's own composition instead (headline upper-left, the working map fragment fills the rest), because the product here is the map, not type.
