# design.md — ই-পারিবারিক আদালত (e-Family Court) Portal

> **Read this first (provenance).**
> The live page at https://efamilycourt.judiciary.gov.bd/ is rendered by JavaScript, so only its page shell could be read: title, viewport tag, and a CSRF meta token. Exact CSS values (hex codes, fonts, keyframes) could NOT be extracted.
> - **[VERIFIED]** = confirmed from the page or public news coverage.
> - **[PROPOSED]** = design decision written for this file. Treat as a spec to build or compare against, not as a copy of the live site's CSS.
> To replace [PROPOSED] values with real ones, open the site → DevTools → Elements → copy `:root` variables and the `@keyframes` rules, then paste them here.

---

## 1. Product Context

| Item | Detail |
|---|---|
| Name | ই-পারিবারিক আদালত (e-Family Court) **[VERIFIED]** |
| Owner | Government of Bangladesh, Judiciary **[VERIFIED]** |
| Language | Bangla-first (page title is in Bangla) **[VERIFIED]** |
| Backend hint | Laravel-style CSRF meta token in page head **[VERIFIED]** |
| Responsive | `width=device-width, initial-scale=1` **[VERIFIED]** |
| Core flow | Register → file case online → upload documents → attend hearing online, free of cost **[VERIFIED via news]** |
| Users | Litigants, lawyers, court staff/officials **[VERIFIED via news]** |
| Emotional context | Users are often stressed (divorce, custody, maintenance). Design must feel **calm, safe, fair**. |

**Design personality:** *Dignified. Calm. Clear. Trustworthy.*
Never flashy. Motion is gentle, and every animation must explain something.

---

## 2. Concept — "The Balance" (the surprise)

One idea ties the whole interface together: **the scales of justice**.

- The hero shows a thin line-art scale that slowly **sways and settles level** when the page loads. The message: *"fair and balanced."*
- The case-filing stepper is a **balance beam**. Each completed step adds weight and the beam levels out.
- The submit button gives a soft **gavel-tap** (a small bounce plus ripple) instead of a normal click.
- Case status changes are shown as a **journey timeline**, not a boring table.

---

## 3. Color System **[PROPOSED]**

Inspired by the Bangladesh flag (green + red), judicial navy, and a warm gold for authority.

### Brand
| Token | Hex | Use |
|---|---|---|
| `--green-900` | `#06432E` | Header, footer, deep backgrounds |
| `--green-700` | `#006A4E` | **Primary** (Bangladesh green), buttons, links |
| `--green-500` | `#1F9D74` | Hover, active states |
| `--green-100` | `#E3F4EC` | Soft section backgrounds, success tint |
| `--navy-800` | `#12263F` | Headings, judicial authority |
| `--gold-500` | `#C9A24B` | Accent: dividers, icons, highlights |
| `--gold-100` | `#F7EFD8` | Gold tint backgrounds |
| `--red-600` | `#D1342F` | Errors, urgent, hearing today (sparingly) |

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FBFAF6` | Page background (warm, easier on eyes than pure white) |
| `--surface` | `#FFFFFF` | Cards, forms |
| `--ink-900` | `#16202B` | Body text |
| `--ink-600` | `#4B5A6A` | Secondary text |
| `--line` | `#E4E1D6` | Borders |

### Status colors (case journey)
| Status | Bangla | Color |
|---|---|---|
| Draft | খসড়া | `#8A94A0` grey |
| Submitted | দাখিল হয়েছে | `#2F6FB5` blue |
| Under review | যাচাই চলছে | `#C9A24B` gold |
| Hearing scheduled | শুনানির তারিখ নির্ধারিত | `#006A4E` green |
| Disposed | নিষ্পত্তি | `#12263F` navy |
| Rejected / Action needed | প্রত্যাখ্যাত / পদক্ষেপ প্রয়োজন | `#D1342F` red |

### Dark mode
Background `#0C1713`, surface `#13241D`, text `#E8EFEA`, primary `#3DC596`, gold `#E0BC6A`. Keep contrast at 4.5:1 or higher.

### Signature gradient
Hero only: `linear-gradient(135deg, #06432E 0%, #006A4E 55%, #12263F 100%)` with a faint gold dot-grid overlay at 6% opacity.

---

## 4. Typography **[PROPOSED]**

| Role | Font | Notes |
|---|---|---|
| Bangla headings | **Tiro Bangla** (serif) | Gives the dignified, "official document" feel |
| Bangla body/UI | **Noto Sans Bengali** or Hind Siliguri | Excellent readability at small sizes |
| English/Latin | **Inter** | Clean, neutral |
| Numbers/case IDs | **JetBrains Mono** (tabular) | Case numbers align cleanly |

**Rules**
- Base size **17px** (Bangla needs more room than Latin). Line-height **1.7** for Bangla, 1.5 for English.
- Scale: 14 / 17 / 20 / 24 / 32 / 44 / 60.
- Never use letter-spacing on Bangla text (it breaks conjuncts).
- Offer a Bangla ⇄ English toggle in the header. Show Bangla digits (০১২৩) in Bangla mode.
- Self-host fonts and use `font-display: swap` (low-bandwidth friendly).

---

## 5. Layout, Spacing, Shape **[PROPOSED]**

- Grid: 12 columns, max width **1200px**, gutters 24px (16px on mobile).
- Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 · 96.
- Radius: inputs 10px · cards 16px · buttons 12px · pills 999px.
- Elevation (soft, never harsh):
  - `sm`: `0 1px 2px rgba(18,38,63,.06)`
  - `md`: `0 8px 24px rgba(18,38,63,.08)`
  - `lg`: `0 18px 48px rgba(18,38,63,.14)`
- Breakpoints: 480 / 768 / 1024 / 1280. **Mobile-first**, since many litigants use phones.

---

## 6. Components **[PROPOSED]**

### Header
- Slim top bar: government identity line + language toggle + font-size A− / A+.
- Main nav: হোম · মামলা দাখিল · মামলা অনুসন্ধান · নির্দেশিকা · যোগাযোগ, plus Login/Register buttons.
- Sticky, shrinks from 80px to 60px on scroll with a soft shadow fade-in.

### Hero
- Left: Bangla serif headline, one-line promise, two buttons: **"মামলা দাখিল করুন"** (primary) and **"মামলার অবস্থা দেখুন"** (outline).
- Right: animated scales-of-justice line art (gold strokes on green).
- Under the hero: a **quick case search** card (case number + mobile OTP) overlapping the hero edge.

### Trust strip
Three to four icon facts: *অনলাইনে দাখিল · বিনামূল্যে · ঘরে বসে শুনানি · নিরাপদ নথি.*

### Case-filing stepper ("balance beam")
1. নিবন্ধন 2. বাদী-বিবাদীর তথ্য 3. মামলার ধরন 4. নথি আপলোড 5. যাচাই ও জমা
- Horizontal on desktop, vertical on mobile. A thin beam line fills with green as steps complete.
- Autosave draft with a small "সংরক্ষিত ✓" indicator.

### Case type cards
Divorce (বিবাহবিচ্ছেদ), Dower (দেনমোহর), Maintenance (ভরণপোষণ), Custody (অভিভাবকত্ব), Restitution of conjugal rights. Each card: icon, one-line plain-language explanation, hover lift.

### Forms
- 52px-tall inputs, floating labels, helper text always visible (not placeholder-only).
- Inline validation with friendly Bangla messages. Never blame the user.
- Drag-and-drop file zone with progress ring and file-type chips.

### Buttons
| Type | Style |
|---|---|
| Primary | green-700 fill, white text, 12px radius |
| Secondary | white fill, green border |
| Danger | red-600 fill (only for destructive actions, with confirm dialog) |
| Focus ring | 3px gold-500 outline, 2px offset (always visible) |

### Case journey timeline
Vertical line with status dots using the status colors. The current step pulses softly. Next hearing date appears in a gold-tinted card with a **"Join online hearing"** button that becomes active 15 minutes before the start.

### Tables (staff/lawyer view)
Zebra rows in `--paper`, sticky header, status pills, row actions on hover, and a mobile layout that collapses to cards.

### Footer
Deep green, three columns (quick links, help/guidelines, contact), a gold hairline on top, and a small "Developed with Daffodil International University" credit **[VERIFIED via news]**.

---

## 7. Motion & Animation **[PROPOSED]**

### Principles
1. Motion explains, never decorates.
2. Slow and soft. Users may be anxious.
3. Everything respects `prefers-reduced-motion`.

### Timing tokens
| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 150ms | Hover, focus |
| `--dur-base` | 280ms | Cards, dropdowns |
| `--dur-slow` | 600ms | Page sections, stepper |
| `--dur-hero` | 2400ms | Scale sway |
| `--ease-out` | `cubic-bezier(.22,.9,.3,1)` | Entrances |
| `--ease-soft` | `cubic-bezier(.4,0,.2,1)` | General |

### Signature animations
| Name | Behavior |
|---|---|
| **Scale settle** | On load the scale beam tilts ±8°, then damps to 0° over ~2.4s (spring-like). Plays once. |
| **Beam fill** | Stepper line grows left to right (`scaleX 0→1`, 600ms) as each step completes. |
| **Gavel tap** | Submit button: press down 2px, ripple expands in gold, tiny check draws via stroke-dashoffset (400ms). |
| **Scroll reveal** | Sections fade up 16px + opacity 0→1, 600ms, staggered 80ms. Triggered once with IntersectionObserver. |
| **Pulse dot** | Current timeline step: soft ring scales 1→1.8 and fades, 2s loop. |
| **Skeleton shimmer** | Loading cards use a slow grey shimmer, never spinners alone. |
| **Toast** | Slides in from top-right 280ms, auto-dismisses after 5s, pauses on hover. |
| **Page transition** | 200ms cross-fade only. No sliding pages. |

### Reduced motion
When the user prefers reduced motion: disable sway, pulse, and parallax. Keep only instant opacity changes.

---

## 8. Accessibility & Inclusion **[PROPOSED, mandatory]**

- WCAG 2.2 AA: text contrast 4.5:1 or higher, touch targets 44px or larger.
- Full keyboard navigation and visible focus ring.
- Screen-reader labels in Bangla; correct `lang="bn"` on the document, `lang="en"` on English spans.
- A− / A+ text-size control and a high-contrast mode.
- Plain-language copy: avoid legal jargon, explain each term in one sentence.
- Low-bandwidth mode: no heavy video, lazy-load images, target page weight under 500 KB on first load.
- OTP and password flows support paste, and show/hide password.
- Privacy cues near sensitive steps: lock icon plus "আপনার তথ্য সুরক্ষিত" message.

---

## 9. Pages Checklist

1. Home (hero, trust strip, how-it-works, case types, FAQ)
2. Register / Login (with OTP)
3. Dashboard (my cases, next hearing, notifications)
4. File a case (5-step stepper)
5. Case detail (journey timeline, documents, orders)
6. Online hearing room (join, check device, wait screen)
7. Case search / public cause list
8. Guidelines / user manual
9. Contact / help
10. Staff and lawyer views (tables, filters)

---

## 10. Quick Token Block (starter)

```css
:root{
  --green-700:#006A4E; --green-900:#06432E; --gold-500:#C9A24B;
  --navy-800:#12263F; --paper:#FBFAF6; --ink-900:#16202B;
  --radius:16px; --dur-base:280ms; --ease-out:cubic-bezier(.22,.9,.3,1);
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

---

## 11. Prompt for an AI Coding Tool

Paste this together with this file:

> Using `design.md` as the single source of truth, build the e-Family Court home page and 5-step case-filing flow in plain HTML, CSS and a small amount of vanilla JS. Bangla-first, mobile-first. Implement the color tokens, typography, scale-settle hero animation, beam-fill stepper and gavel-tap submit exactly as specified. Respect `prefers-reduced-motion`. Do not add features, libraries or pages beyond those described. After finishing, list which parts of the spec were implemented.

---

## 12. Open Items

- Replace every **[PROPOSED]** color and font with the live site's real values (see top note).
- Confirm the official government emblem usage rules before placing any national symbol.
- Test the Bangla text rendering of conjunct letters on low-end Android devices.
