# Bangladesh Digital Land Services (ভূমি সেবা)
## System Architecture, Technology, Process, UX and Security Analysis

**Version:** 1.0
**Date:** 19 August 2026
**Scope:** Ministry of Land (ভূমি মন্ত্রণালয়) citizen-facing digital land service ecosystem
**Classification:** Public / technical review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope and Method](#2-scope-and-method)
3. [Part A — The Ecosystem](#part-a--the-ecosystem)
4. [Part B — Architecture and Technology](#part-b--architecture-and-technology)
5. [Part C — How the APIs Work](#part-c--how-the-apis-work)
6. [Part D — End-to-End Process Walkthroughs](#part-d--end-to-end-process-walkthroughs)
7. [Part E — UX Analysis and Recommendations](#part-e--ux-analysis-and-recommendations)
8. [Part F — Security Posture, Risks and Fixes](#part-f--security-posture-risks-and-fixes)
9. [Part G — Implementation Roadmap](#part-g--implementation-roadmap)
10. [Appendices](#appendices)

---

## 1. Executive Summary

Bangladesh's land administration has moved from a paper-and-counter model to a distributed set of web platforms operated under the **Land Management Automation Project (ভূমি ব্যবস্থাপনা অটোমেশন প্রকল্প)** of the Ministry of Land. Citizens can now apply for mutation, pay land development tax, view mouza maps, and file grievances online.

**What the review found:**

| Dimension | Assessment | Summary |
|---|---|---|
| **Service coverage** | 🟢 Strong | Most high-volume land transactions have an online path |
| **Architecture** | 🟡 Mixed | Modern gateway + microservices + SSO, but visibly heterogeneous per-vendor stacks |
| **API design** | 🟡 Mixed | Kong API gateway and Keycloak OIDC present; no public API documentation or open data contract |
| **User experience** | 🔴 Weak | Fragmented logins, unclear status semantics, poor error recovery, heavy pages on low-end devices |
| **Security posture** | 🔴 Needs work | Inconsistent security headers, wildcard CORS, staging hosts referenced from production, expired disclosure contact |
| **Legal readiness** | 🟡 Transitional | PDPO 2025 + Cyber Security Ordinance 2025 obligations largely not yet reflected in published policies |

**The three highest-leverage fixes:**

1. **One identity, one inbox.** Consolidate every land service behind the existing Keycloak identity provider and a single "my applications" view. Fragmentation is the single largest driver of citizen confusion and of middleman dependence.
2. **Harden the perimeter consistently.** Security headers, CORS policy, and cookie flags differ by subdomain because they were built by different vendors. A single edge policy at the Cloudflare/Kong layer removes an entire class of risk in weeks, not years.
3. **Publish the contract.** A documented, versioned, rate-limited public API plus an active responsible-disclosure channel converts today's opaque system into one that can be independently verified and safely extended.

---

## 2. Scope and Method

### 2.1 What was examined

| Portal | URL | Function |
|---|---|---|
| Land Information Portal | `land.gov.bd` | Umbrella portal, service directory, manuals |
| Citizen services page | `land.gov.bd/nagorik-subidha` | Statement of citizen entitlements |
| e-Mutation | `mutation.land.gov.bd` | নামজারি / জমাভাগ / জমা একত্রীকরণ applications |
| Mutation mobile app | Google Play: "নামজারি" | Mobile client for the same workflow |
| Land Development Tax | `ldtax.gov.bd` | ভূমি উন্নয়ন কর assessment and payment |
| LDTax user manual | `traininglims.land.gov.bd/.../user_manual` | Citizen documentation |
| Smart Bhumi Naksha | `map.land.gov.bd` | Digital mouza map / land zoning |
| Map privacy policy | `map.land.gov.bd/land-zoning/privacy-policy` | Data practices statement |
| Land Service Hotline 16122 | `hotline.land.gov.bd` | Grievance redress + technical support |
| Manuals | `land.gov.bd/manual` | Published PDFs and guidance |

### 2.2 Method

The technical findings in this document come from **passive observation only** — the same information any visitor's browser receives:

- Rendering public pages and reading published content
- Reading HTTP response headers returned on a normal `GET /` request
- Reading the site's own published Content-Security-Policy, which enumerates the backend hosts the frontend is permitted to contact
- Reading `robots.txt` and `/.well-known/security.txt`
- Reviewing public reporting, official manuals, circulars, and the applicable legal framework

> ⚠️ **No scanning, probing, authentication testing, or intrusion of any kind was performed, and none should be.** Under the **Cyber Security Ordinance 2025**, unauthorised access to a government information system is a criminal offence. Every security item in Part F is written as *defensive guidance for the system owner*, not as a technique for a third party. Any real assessment must be commissioned by the Ministry of Land under written authorisation.

### 2.3 Confidence levels used

| Marker | Meaning |
|---|---|
| **[Observed]** | Directly visible in a public response or page |
| **[Documented]** | Stated in official manuals, circulars, or press releases |
| **[Inferred]** | Reasonable engineering inference from observed signals; needs confirmation |
| **[Recommended]** | Not present today; proposed by this review |

---

## Part A — The Ecosystem

### 3.1 Institutional map: who does what

Land service delivery is not one organisation. Understanding *who owns which step* explains most of the process friction.

```mermaid
flowchart TD
    MOL["Ministry of Land<br/>ভূমি মন্ত্রণালয়<br/>Policy, budget, project ownership"]

    MOL --> LRB["Land Reforms Board<br/>ভূমি সংস্কার বোর্ড<br/>LD Tax, records operations"]
    MOL --> DLRS["Directorate of Land Records & Survey<br/>Survey, khatian, mouza maps"]
    MOL --> LAB["Land Appeal Board<br/>Quasi-judicial appeals"]
    MOL --> LMAP["Land Management<br/>Automation Project<br/>Software delivery"]

    LRB --> DC["Deputy Commissioner<br/>District Collectorate"]
    DC --> ACL["Assistant Commissioner Land (AC Land)<br/>সহকারী কমিশনার ভূমি<br/>Hearing + final order"]
    ACL --> ULO["Union / Pouro Land Office<br/>ইউনিয়ন ভূমি অফিস"]
    ULO --> ULAO["Union Land Assistant Officer<br/>ইউনিয়ন ভূমি সহকারী কর্মকর্তা<br/>Field verification report"]
    ACL --> KAN["Kanungo / Surveyor<br/>কানুনগো / সার্ভেয়ার<br/>Technical map check"]

    LMAP --> V["Delivery vendors<br/>Mysoft Heaven · Business Automation<br/>Olivine · Parkway · Synesis IT · IWM-Synesis JV"]

    EXT["External dependencies"] --> NID["Election Commission<br/>NID verification"]
    EXT --> MFS["bKash · Nagad · Rocket · Upay<br/>Banks / cards"]
    EXT --> TREAS["Government treasury<br/>Challan / iBAS++"]
    EXT --> SMS["SMS gateway"]

    ACL -.consumes.-> EXT

    style MOL fill:#1a5632,color:#fff
    style ACL fill:#c9a227,color:#000
    style V fill:#4a5568,color:#fff
    style EXT fill:#7c2d12,color:#fff
```

**Key insight:** the *system* is centralised but the *decision* is local. AC Land holds the approving authority; the Union Land Office produces the report that effectively determines the outcome. Software can remove queueing and opacity, but it cannot remove the discretion that sits at these two nodes — which is why transparency features (immutable audit trail, published SLA clocks, reason codes for rejection) matter more than additional automation.

### 3.2 Service inventory and delivery vendors

**[Observed]** The umbrella portal credits four technical partners, and individual systems credit others:

| System | Credited builder | Evidence |
|---|---|---|
| Land Information Portal (`land.gov.bd`) | Mysoft Heaven, Business Automation (BA Systems), Olivine, Parkway Technologies | Footer credits on `land.gov.bd` |
| Smart Bhumi Naksha (`map.land.gov.bd`) | IWM–SYNESIS (JV) | Footer credit on privacy policy page |
| Hotline 16122 (`hotline.land.gov.bd`) | Synesis IT | Footer credit "প্রযুক্তি সহযোগী" |
| Security contact | Business Automation staff address | `/.well-known/security.txt` |

**Consequence:** a **multi-vendor delivery model without a single enforced platform standard**. This is directly visible in the technical evidence — each subdomain runs a different framework, a different session scheme, and a different set of security headers. This is the root cause of several findings in Part F.

### 3.3 Service-to-portal map

| Citizen need (Bangla) | English | Portal |
|---|---|---|
| নামজারি / জমাভাগ / জমা একত্রীকরণ | Mutation, sub-division, consolidation | `mutation.land.gov.bd` |
| ভূমি উন্নয়ন কর / খাজনা / দাখিলা | Land development tax, receipt | `ldtax.gov.bd` |
| খতিয়ান, পর্চা, রেকর্ড | Record of rights, certified copies | `dlrms.land.gov.bd` |
| মৌজা ম্যাপ, দাগ, ল্যান্ড জোনিং | Mouza map, plot, zoning | `map.land.gov.bd` |
| ভূমি অধিগ্রহণ ও হুকুমদখল | Land acquisition and requisition | `land.gov.bd` module |
| ইজারা ও বন্দোবস্ত | Lease and settlement (khas land) | `land.gov.bd` module |
| ভূমি রাজস্ব মামলা | Land revenue cases | `case.gov.bd` |
| অভিযোগ প্রতিকার (GRS) | Grievance redress | `grs.land.gov.bd`, `hotline.land.gov.bd`, 16122 |
| ভূমি প্রশাসন ব্যবস্থাপনা | Land administration management (internal) | `lams.land.gov.bd` |

```mermaid
pie showData
    title Citizen journey touchpoints per land transaction (typical purchase → title)
    "Sub-Registry (deed registration)" : 1
    "LD Tax portal (clear arrears)" : 1
    "Mutation portal (apply)" : 1
    "Union Land Office (verification)" : 1
    "AC Land office (hearing)" : 1
    "Mutation portal (DCR payment)" : 1
    "LD Tax portal (new holding)" : 1
```

A single property transfer touches **at least seven** distinct process steps across **four** systems and **two** ministries. Each hand-off is a place where a citizen can get lost — and where an intermediary can insert themselves.

---

## Part B — Architecture and Technology

### 4.1 Observed technology stack

**[Observed]** — from HTTP response headers and page markup on 18–19 August 2026.

| Layer | Technology | Where seen | Evidence |
|---|---|---|---|
| Edge / CDN / WAF | **Cloudflare** | land, mutation, hotline, ldtax | `server: cloudflare`, `cf-ray`, NEL reporting |
| API gateway | **Kong 3.6.1** | mutation | `via: kong/3.6.1`, `x-kong-upstream-latency`, `x-kong-request-id` |
| Identity provider | **Keycloak** (realm `lsg`) | hotline → GRS login | `office-idp.land.gov.bd/auth/realms/lsg/protocol/openid-connect/auth` |
| Auth protocol | **OAuth 2.0 / OpenID Connect**, authorization-code flow | GRS, office logins | `response_type=code&client_id=…&scope=openid&redirect_uri=…` |
| Public portal frontend | **Next.js / React** (SSR + image optimiser) | land.gov.bd | `x-powered-by: Next.js`, `/_next/image`, RSC vary headers |
| Portal admin/CMS backend | **Laravel** | `lsg-portal-admin.land.gov.bd` | Laravel `storage/` asset paths |
| Mutation backend | **PHP / Laravel** | mutation | Encrypted `XSRF-TOKEN` + `_session` cookie format |
| Map application | **PHP / Laravel** | map | `csrf-token` meta tag, Laravel encrypted session cookie |
| Hotline / GRS | **Python / Django** | hotline | `sessionid` cookie, `/static/` paths, Django header profile |
| Message broker | **RabbitMQ** (browser-reachable endpoint) | mutation CSP | `mutation-rabbitmq.land.gov.bd` in `connect-src` |
| Analytics | Google Analytics / GTM, `insightdb.ai` | mutation CSP | `script-src` / `connect-src` allowlist |
| Mobile | Native Android + iOS ("Bhumi", "নামজারি", "Smart Bhumi Naksha") | Play Store / App Store | Store listings linked from portal |
| Geospatial | Web GIS over digitised mouza/plot layers | map | BDMLS description, plot/zoning queries |

### 4.2 The service topology, as published by the system itself

**[Observed]** The mutation portal's own Content-Security-Policy header enumerates every backend host its frontend is allowed to contact. This is effectively a public architecture diagram, published by the application:

```mermaid
flowchart LR
    subgraph CLIENT["Client tier"]
        B["Browser / Mobile app"]
    end

    subgraph EDGE["Edge tier"]
        CF["Cloudflare<br/>CDN · WAF · TLS · HSTS"]
        KONG["Kong API Gateway 3.6.1<br/>routing · rate limit · auth plugin"]
    end

    subgraph IDENTITY["Identity tier"]
        IDP["office-idp.land.gov.bd<br/>Keycloak · realm: lsg"]
        IDPAPI["office-idp-api.land.gov.bd"]
    end

    subgraph SERVICES["Application services"]
        MUT["mutation.land.gov.bd<br/>Laravel"]
        MICRO["lsg-micro-api.land.gov.bd<br/>microservice API"]
        API["api.land.gov.bd"]
        OWNER["lsg-land-owner.land.gov.bd<br/>owner profile service"]
        KN["knapi.land.gov.bd"]
        LDT["office.ldtax.gov.bd<br/>api.ldtax.gov.bd"]
        DLRMS["backoffice.dlrms-stg.land.gov.bd<br/>⚠ staging host"]
    end

    subgraph DATA["Data services"]
        C0["c-data-m-lite"]
        C1["c1-data-m-lite"]
        C2["c2-data-m-lite"]
        MQ["mutation-rabbitmq<br/>message broker"]
    end

    subgraph PAY["Payment"]
        PG["pg.land.gov.bd<br/>payment gateway broker"]
        MFS["bKash · Nagad · Rocket<br/>Upay · Cards · UCB"]
    end

    B --> CF --> KONG
    KONG --> MUT
    KONG --> MICRO
    KONG --> API
    B -.OIDC redirect.-> IDP
    IDP --> IDPAPI
    MUT --> OWNER
    MUT --> KN
    MUT --> LDT
    MUT -.-> DLRMS
    MUT --> C0 & C1 & C2
    MUT --> MQ
    MUT --> PG --> MFS

    style DLRMS fill:#7c2d12,color:#fff
    style MQ fill:#92400e,color:#fff
    style KONG fill:#1a5632,color:#fff
    style IDP fill:#1a5632,color:#fff
```

**What this tells us:**

- ✅ There *is* a real platform: a gateway, a central IdP, discrete services, an async broker, and a payment abstraction (`pg.land.gov.bd`) rather than direct MFS coupling. That is a sound modern design.
- ⚠️ A **staging** host (`backoffice.dlrms-stg.…`) and a **staging IdP** (`stg-gen2idp.…`) are referenced from the *production* policy. Staging systems typically carry weaker credentials, verbose errors, and sometimes copies of real data.
- ⚠️ A **message broker endpoint is browser-reachable**. Brokers are infrastructure and normally sit behind a service, not in front of a browser.
- ⚠️ Third-party analytics (`insightdb.ai`, Google) are permitted on pages that handle land-ownership data.

### 4.3 The data model in plain terms

Every technical decision in this system flows from the underlying land record model:

```mermaid
flowchart TD
    DIV["Division বিভাগ"] --> DIST["District জেলা"]
    DIST --> UPZ["Upazila / Thana উপজেলা"]
    UPZ --> MOU["Mouza মৌজা<br/>revenue village — the atomic map unit"]
    MOU --> KHAT["Khatian খতিয়ান<br/>record of rights: who owns what"]
    MOU --> DAG["Dag / Plot দাগ<br/>surveyed parcel with geometry"]
    KHAT --> HOLD["Holding হোল্ডিং<br/>tax account — the LD Tax unit"]
    DAG --> HOLD
    HOLD --> DAKH["Dakhila দাখিলা<br/>tax receipt"]
    KHAT --> MUT2["Mutation নামজারি<br/>creates a NEW khatian"]
    MUT2 --> DCR["DCR<br/>Duplicate Carbon Receipt"]

    style MOU fill:#1a5632,color:#fff
    style HOLD fill:#c9a227,color:#000
```

| Entity | Bangla | What it is | Why it complicates software |
|---|---|---|---|
| Mouza | মৌজা | Revenue village; smallest map unit | ~60,000+ nationally; names repeat across districts; JL numbers differ per survey |
| Khatian | খতিয়ান | Record of rights | Multiple generations coexist: **CS → SA → RS → BS/BRS**, plus city surveys. They do not map 1:1 |
| Dag | দাগ | Surveyed plot | Renumbered between surveys; a single RS dag may become several BS dags |
| Holding | হোল্ডিং | Tax account | Created by the land office, not by the citizen; the citizen's first blocker |
| Share (হিস্যা) | হিস্যা | Fractional ownership | Inheritance produces fractions like 3/56; floating-point storage is a correctness bug waiting to happen |

> **Engineering note:** survey-generation mismatch (RS vs SA vs BS) is the single most under-modelled problem in the ecosystem. Any target architecture must treat *parcel lineage* — "this BS dag derives from these RS dags" — as a first-class, queryable relationship rather than a manual clerical judgement.

### 4.4 Architecture maturity assessment

```mermaid
xychart-beta
    title "Architecture maturity by capability (0 = absent, 5 = mature)"
    x-axis ["Edge/WAF", "API gateway", "Central SSO", "Async messaging", "Service isolation", "Env separation", "API docs", "Observability", "Design system", "Test automation"]
    y-axis "Maturity" 0 --> 5
    bar [4, 4, 4, 3, 3, 1, 1, 2, 1, 1]
```

*Scores for Env separation, API docs, Design system, Observability and Test automation are **[Inferred]** from external signals (staging hosts in production policy, absence of any published developer documentation, visibly divergent UI conventions across portals). They should be re-scored from the inside.*

**Reading of the chart:** the *infrastructure* is ahead of the *engineering practice*. Buying a gateway and an IdP is a procurement decision; environment hygiene, documented contracts, shared components, and automated tests are organisational disciplines. The gap between the two bars on the left and the four on the right is where most of the citizen-visible defects live.

---

## Part C — How the APIs Work

### 5.1 The request path, end to end

Every citizen action travels the same five hops. Understanding this path is the prerequisite for both performance work and security work.

```mermaid
sequenceDiagram
    autonumber
    participant U as Citizen (browser/app)
    participant CF as Cloudflare edge
    participant K as Kong Gateway
    participant S as Application service
    participant D as Database / cache
    participant Q as RabbitMQ

    U->>CF: HTTPS request (TLS 1.2/1.3)
    Note over CF: WAF rules, bot detection,<br/>rate limiting, HSTS, caching
    CF->>K: Forward to origin
    Note over K: Route match, JWT validation,<br/>quota, request ID injection
    K->>S: Proxied request + x-kong-request-id
    S->>D: Query / write (transactional)
    S-->>Q: Publish event (async: notify, index, audit)
    S-->>K: JSON response
    K-->>CF: Response + x-kong-upstream-latency
    CF-->>U: Response + cf-ray, HSTS
    Q-->>S: Worker consumes → SMS / email / status update
```

**[Observed]** the response headers that prove this path: `via: kong/3.6.1`, `x-kong-proxy-latency: 0`, `x-kong-upstream-latency: 103`, `x-kong-request-id`, `cf-ray`, `cf-cache-status: DYNAMIC`.

`x-kong-proxy-latency: 0` vs `x-kong-upstream-latency: 103` is a useful diagnostic: the gateway itself adds no measurable delay, so **all latency is in the application tier**, not in routing. Performance work belongs in the services and the database, not the edge.

### 5.2 Authentication: OIDC authorization-code flow

**[Observed]** The hotline portal's login link is a textbook Keycloak OIDC authorization request:

```
https://office-idp.land.gov.bd/auth/realms/lsg/protocol/openid-connect/auth
    ?response_type=code
    &client_id=lsg-<opaque>-live-20260412
    &scope=openid
    &redirect_uri=https://grs.land.gov.bd/
```

The `-live-20260412` suffix on the client ID indicates a **date-stamped client rotation practice** — a positive sign of credential lifecycle management.

```mermaid
sequenceDiagram
    autonumber
    participant U as Citizen
    participant A as Land app (e.g. GRS)
    participant KC as Keycloak (realm lsg)
    participant NID as NID verification service
    participant SMS as SMS gateway

    U->>A: Click "নাগরিক লগইন"
    A->>U: 302 → Keycloak /auth?response_type=code&client_id=…
    U->>KC: Credentials (mobile / NID + password)
    KC->>SMS: Trigger OTP
    SMS-->>U: OTP via SMS
    U->>KC: Submit OTP
    opt First-time registration
        KC->>NID: Verify NID + DOB + name
        NID-->>KC: Match / no-match + demographic fields
    end
    KC->>U: 302 → redirect_uri?code=<authorization_code>
    U->>A: Deliver code
    A->>KC: POST /token (code + client_secret) [server-to-server]
    KC-->>A: access_token (JWT) + refresh_token + id_token
    A->>A: Establish session
    Note over A,KC: Subsequent API calls:<br/>Authorization: Bearer <JWT><br/>Kong validates signature, exp, aud, realm roles
```

**Why the authorization-code flow matters here:** the token is exchanged *server-to-server*, so the access token never appears in a URL or in browser history. This is the correct choice for a government service. The remaining question — not answerable from outside — is whether **PKCE** is enforced for the public mobile clients, which is required to protect the code exchange on a device the user does not fully control.

### 5.3 Asynchronous processing

**[Observed]** `mutation-rabbitmq.land.gov.bd` in the CSP `connect-src`. **[Inferred]** the broker carries the workflow's side effects:

```mermaid
flowchart LR
    APP["Mutation service"] -->|publish| EX{{"Exchange"}}
    EX --> Q1["queue: notifications"]
    EX --> Q2["queue: sms"]
    EX --> Q3["queue: audit"]
    EX --> Q4["queue: search-index"]
    EX --> Q5["queue: ldtax-sync"]

    Q1 --> W1["Notification worker → in-app status"]
    Q2 --> W2["SMS worker → operator gateway"]
    Q3 --> W3["Audit worker → append-only log"]
    Q4 --> W4["Indexer → application search"]
    Q5 --> W5["Sync worker → create/update holding"]

    style EX fill:#1a5632,color:#fff
```

This is the right pattern: the citizen's HTTP request returns as soon as the application is committed, and the slow, failure-prone work (telecom SMS, cross-system sync) happens out of band with retries. It is also why status SMS sometimes arrives minutes after the portal already shows a change — a UX issue addressed in Part E.

### 5.4 Payment flow

**[Observed]** `pg.land.gov.bd` is a dedicated payment-broker host, separate from the application services. **[Documented]** the Ministry has MoUs with bKash, Nagad, Upay and UCB for land fee collection; land tax and DCR fees are payable by MFS, card, and internet banking.

```mermaid
sequenceDiagram
    autonumber
    participant U as Citizen
    participant APP as LDTax / Mutation service
    participant PG as pg.land.gov.bd (broker)
    participant MFS as bKash / Nagad / Rocket / Card
    participant TR as Government treasury (challan)

    APP->>APP: Compute assessment (slab rate + arrears + late fee)
    U->>APP: "Pay now"
    APP->>PG: Create payment intent (amount, holding/app ID, idempotency key)
    PG-->>U: Redirect to chosen channel
    U->>MFS: Authorise (PIN / OTP)
    MFS-->>PG: Async callback: success | fail | pending
    PG->>APP: Signed webhook (verify HMAC + replay window)
    APP->>TR: Post to treasury challan / accounting head
    TR-->>APP: Challan number
    APP-->>U: Receipt: দাখিলা / DCR (PDF with QR verification)

    Note over U,APP: Failure mode to design for —<br/>money debited, callback lost.<br/>Requires reconciliation job + idempotency,<br/>never a "try again" that double-charges.
```

> 🔑 **The single most important correctness requirement in the whole ecosystem:** payment operations must be **idempotent** and backed by an automated reconciliation job that compares broker-side transactions with application-side receipts on a fixed schedule. Users widely report the "paid but no receipt" state; almost every such report is a missed callback plus an absent reconciliation loop, not a lost payment.

### 5.5 Anatomy of a typical API call

**[Inferred]** — a representative shape based on the observed gateway, token scheme, and data model. Not a documented contract.

**Request**

```http
GET /api/v1/holdings?division=30&district=26&upazila=94&mouza=112&khatian=1043 HTTP/2
Host: lsg-micro-api.land.gov.bd
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6...
Accept: application/json
Accept-Language: bn-BD
X-Request-Id: 022aed671ce3616f560f307b23bef57b
```

**Response**

```json
{
  "meta": { "request_id": "022aed67...", "generated_at": "2026-08-19T09:14:02+06:00" },
  "data": [
    {
      "holding_id": "30-26-94-112-1043",
      "khatian_no": "1043",
      "khatian_type": "BS",
      "mouza": { "code": "112", "name_bn": "…", "jl_no": "58" },
      "owners": [ { "name_bn": "…", "share": "3/56", "nid_hash": "sha256:…" } ],
      "dags": [ { "dag_no": "421", "class": "নাল", "area_decimal": 12.5 } ],
      "tax": { "current_due_bdt": 1120, "arrears_bdt": 0, "last_paid_fy": "2025-26" }
    }
  ]
}
```

**Design rules this shape should follow — and which the target architecture must mandate:**

| Rule | Why |
|---|---|
| Version in the path (`/api/v1/`) | Lets the mobile app and portal evolve independently |
| Fractional shares as **strings or integer numerator/denominator**, never floats | `3/56` must survive round-tripping exactly; a rounding error is a legal defect in a title record |
| Areas in a fixed decimal type with an explicit unit | Shatak / decimal / acre confusion is a recurring source of assessment disputes |
| NID never returned in plain text to a client | Return a masked form or a hash; the client rarely needs the raw number |
| Composite, human-meaningful IDs, but authorisation checked server-side per record | Guessable IDs are fine *only* if every read is ownership-checked (see F-2) |
| `X-Request-Id` echoed end-to-end | Lets the 16122 hotline trace a citizen's exact failed call in seconds |

### 5.6 External integration inventory

| Integration | Partner | Purpose | Failure impact | Notes |
|---|---|---|---|---|
| NID verification | Election Commission (via national e-Service Bus / Porichoy-class service) | Identity proofing at registration | Registration blocked | **[Documented]** registration requires NID + mobile + DOB |
| MFS payments | bKash, Nagad, Rocket, Upay | Fee collection | Payment blocked; risk of orphaned debits | **[Documented]** MoU with MoL |
| Card / bank | UCB and others via gateway | Fee collection | Alternate channel | **[Documented]** |
| Treasury posting | Government challan / iBAS++ | Revenue accounting | Receipt cannot be issued | **[Inferred]** |
| SMS | Operator aggregator | OTP + status alerts | Login and status notification fail | **[Documented]** OTP-based registration |
| Geospatial | BDMLS mouza/plot layers | Map, zoning, plot lookup | Map features degrade | **[Observed]** |
| Sub-Registry (deed) | Registration Directorate, Ministry of Law | Deed → mutation linkage | **Currently a manual, paper hand-off** | ⚠ The largest missing integration |
| Analytics | Google Analytics, `insightdb.ai` | Usage measurement | None functional | ⚠ Privacy review needed |

> 🔴 **The biggest architectural gap is not inside these systems — it is between two ministries.** Deed registration sits with the Registration Directorate under the Ministry of Law; mutation sits with the Ministry of Land. Because there is no automated event flowing from "deed registered" to "mutation due", the citizen becomes the integration layer, carrying paper between two arms of the same state. **Every serious modernisation proposal should treat a registry-to-mutation event feed as priority one**, because it simultaneously removes the largest UX burden and closes the biggest fraud window (the period in which a seller can sell the same plot twice).


---

## Part D — End-to-End Process Walkthroughs

### 6.1 e-Mutation (নামজারি) — the flagship process

#### 6.1.1 Who must act, in order

**[Documented]** from Ministry circulars, the e-Namjari system guidance, and published user manuals.

| # | Actor | Bangla | Action | Typical duration |
|---|---|---|---|---|
| 1 | Citizen | নাগরিক | Register, submit application + documents, pay application fee | Same day |
| 2 | System | — | Validate, assign application ID, route to jurisdiction | Seconds |
| 3 | Office assistant / Nazir | অফিস সহকারী | Case creation, document completeness check | 1–3 days |
| 4 | Union Land Assistant Officer | ইউনিয়ন ভূমি সহকারী কর্মকর্তা (তহশিলদার) | **Field verification report** — the decisive input | 7–14 days |
| 5 | Kanungo / Surveyor | কানুনগো / সার্ভেয়ার | Map and measurement check (where applicable) | 3–7 days |
| 6 | Assistant Commissioner (Land) | সহকারী কমিশনার (ভূমি) | Hearing (শুনানি) and **final order** | 3–7 days |
| 7 | Office assistant | অফিস সহকারী | Prepare new khatian online | 1–3 days |
| 8 | System → Citizen | — | SMS: pay DCR fee | Immediate |
| 9 | Citizen | নাগরিক | Pay DCR fee online | Same day |
| 10 | System | — | Auto-generate challan, issue QR-coded khatian + DCR PDFs | Minutes |
| 11 | System → LD Tax | — | New holding created for tax assessment | Should be automatic |

**[Documented] Standard service level: 28 working days** for ordinary cases (longer categories exist for inherited, disputed, or non-resident applicants). **[Documented] Fees: ৳70** application and notice fee, **৳1,100** DCR fee — **৳1,170** total. *Verify against the official fee schedule at `land.gov.bd/vumisheba-fee` before relying on these figures; they are set by circular and change.*

#### 6.1.2 Process flow

```mermaid
flowchart TD
    START([Citizen buys/inherits land]) --> REG{Registered on portal?}
    REG -->|No| SIGNUP["Register: mobile + NID + DOB → OTP → password"]
    REG -->|Yes| LOGIN["Login"]
    SIGNUP --> LOGIN
    LOGIN --> APPLY["Fill application:<br/>division/district/upazila/mouza<br/>khatian, dag, share, ownership basis"]
    APPLY --> DOCS["Upload: deed, prior khatian,<br/>latest LD tax receipt, warish certificate,<br/>NID, photo"]
    DOCS --> FEE1["Pay ৳70 application + notice fee"]
    FEE1 --> SUBMIT["Application ID issued<br/>SMS confirmation"]
    SUBMIT --> ROUTE["Auto-route to jurisdictional AC Land office"]
    ROUTE --> ULAO["Union Land Office verification<br/>ULAO field report"]
    ULAO --> KAN{"Map/measurement<br/>issue?"}
    KAN -->|Yes| SURVEY["Kanungo / Surveyor report"]
    KAN -->|No| HEARING
    SURVEY --> HEARING["AC Land hearing (শুনানি)<br/>notice to interested parties"]
    HEARING --> DECISION{Order}
    DECISION -->|Rejected| REJECT["Rejection order<br/>→ appeal to ADC(Revenue) / Land Appeal Board"]
    DECISION -->|Approved| KHAT["Office assistant prepares new khatian"]
    KHAT --> SMS2["SMS: pay DCR ৳1,100"]
    SMS2 --> PAY2["Online payment: MFS / card / bank"]
    PAY2 --> CHALLAN["Automatic challan posting"]
    CHALLAN --> ISSUE["Download QR-coded<br/>khatian PDF + DCR PDF"]
    ISSUE --> LDT["New holding → LD Tax system"]
    LDT --> END([Title record updated])

    style DECISION fill:#c9a227,color:#000
    style REJECT fill:#7c2d12,color:#fff
    style END fill:#1a5632,color:#fff
```

#### 6.1.3 Where the clock actually goes

```mermaid
gantt
    title e-Mutation — 28 working day SLA vs. observed reality
    dateFormat X
    axisFormat %s

    section Target (28 wd)
    Citizen submission          :done, 0, 1
    Case creation               :done, 1, 3
    ULAO verification           :done, 3, 14
    Kanungo check               :done, 14, 18
    AC Land hearing + order     :done, 18, 24
    Khatian prep + DCR + issue  :done, 24, 28

    section Commonly reported
    Citizen submission          :active, 0, 1
    Case creation               :active, 1, 5
    ULAO verification (bottleneck) :crit, 5, 30
    Kanungo check               :active, 30, 38
    AC Land hearing + order     :active, 38, 48
    Khatian prep + DCR + issue  :active, 48, 55
```

**The bottleneck is step 4, not the software.** Field verification is a human, physical, discretionary activity. Digitisation has compressed steps 1–3 and 7–11 to near-zero, which makes the untouched middle stand out more sharply. Design implication: *stop optimising the parts that are already fast.* The remaining leverage is in **making step 4 visible and accountable** — timestamped assignment, published ageing dashboards per office, automatic escalation to the AC Land and Deputy Commissioner on breach.

#### 6.1.4 Documented failure modes

| Failure | Root cause | Citizen-visible symptom | Fix |
|---|---|---|---|
| Application rejected after weeks | Missing prior LD tax receipt or mismatched khatian generation | Vague rejection text | Pre-submission validation: check tax status and khatian existence *before* accepting fee |
| "Paid but no DCR" | Lost payment callback | Money gone, no document | Idempotency key + reconciliation job + self-service "recheck payment" |
| Wrong jurisdiction | Mouza name collision across districts | Case sits in wrong office | Route on mouza **code + JL number**, never on name |
| Share arithmetic disputes | Fractional হিস্যা handled manually | Recorded share ≠ legal entitlement | Rational-number arithmetic in the domain model; show the derivation to the applicant |
| Duplicate mutation on same dag | No lock between concurrent applications | Two claimants both progress | Pessimistic lock on (mouza, dag, khatian) while a case is open; flag conflicts immediately |

### 6.2 Land Development Tax (ভূমি উন্নয়ন কর)

**[Documented]** Manual counter collection has been phased out in favour of online দাখিলা, which makes this system's availability a matter of statutory compliance, not convenience.

```mermaid
flowchart TD
    A([Citizen]) --> B["ldtax.gov.bd → নাগরিক নিবন্ধন"]
    B --> C["Mobile + NID + DOB → OTP → 6–8 digit password"]
    C --> D["Add land: division → district → upazila → mouza<br/>→ RS khatian → holding no → ownership type"]
    D --> E["Upload porcha / khatian copy"]
    E --> F{"Land office<br/>verifies & approves"}
    F -->|Rejected| G["Correct and resubmit"]
    F -->|Approved| H["Holding attached to citizen's LD-Tax ID"]
    H --> I["System computes দাবি:<br/>slab rate × area × land class<br/>+ arrears + late fee"]
    I --> J["Pay: bKash / Nagad / Rocket / Upay / card / bank"]
    J --> K{"Payment<br/>confirmed?"}
    K -->|Yes| L["Challan auto-generated"]
    K -->|Pending| M["Reconciliation — receipt within 72h"]
    L --> N["Download দাখিলা (receipt)"]
    M --> N
    N --> O([Compliance complete])

    style F fill:#c9a227,color:#000
    style O fill:#1a5632,color:#fff
```

**Assessment logic [Documented]** from the project's stated outputs — tax is computed from the interaction of:
land class (নাল / ভিটি / পাহাড় / commercial), area held, slab-based rate, ceiling rules, and location (mouza/dag), with **automatic late-fee and interest calculation**.

**The structural weak point:** step F. The citizen cannot self-serve — a land office must approve the holding attachment. This one human gate turns an otherwise fully automated service into a queue, and it is the point where citizens most often report needing an intermediary.

| Problem | Impact | Recommended fix |
|---|---|---|
| Holding attachment requires office approval | Blocks first-time users entirely | Auto-approve where uploaded khatian matches the digitised record; route only mismatches to a human |
| Legacy paper arrears not digitised | Citizen shows compliant online, owes offline | Reconciliation drive; show a clear "records digitised up to FY____" banner per mouza |
| Multiple holdings across districts | No consolidated view | Single "my land" portfolio across all holdings nationally |
| Receipt lag up to 72 hours | Citizen cannot prove payment for a mutation filing | Issue provisional receipt on broker confirmation; final on challan posting |
| Seasonal peak (Boishakh) | Timeouts at deadline | Queue-based write path, autoscaling, and a published availability SLA |

### 6.3 Smart Bhumi Naksha (map.land.gov.bd)

**[Observed]** Runs under the *Mouza and Plot Based National Digital Land Zoning Project*, branded BDMLS, built by IWM–SYNESIS (JV). Core functions per the published privacy policy: view plot and land use, area-based land-use information, and current-location-based mouza plot information. The mobile app requests fine and coarse location.

```mermaid
flowchart LR
    U["Citizen"] --> M["Map client (web / app)"]
    M --> GEO["Geolocation → mouza resolution"]
    M --> Q["Plot query: mouza + dag"]
    GEO --> TILE["Tile / vector layer service"]
    Q --> ATTR["Plot attributes: land use, zoning, area"]
    TILE --> R["Rendered map"]
    ATTR --> R
    R --> U

    style R fill:#1a5632,color:#fff
```

| Strength | Gap |
|---|---|
| National plot-level digital coverage | Not linked to ownership or tax status in the citizen view |
| Location-aware mobile lookup | Privacy policy last updated **April 2023** and is thin on retention, encryption, and legal basis |
| Zoning and land-use classification | No published accuracy statement or survey vintage per mouza |
| — | This host showed the **weakest security headers** of those reviewed (see F-1) |

### 6.4 Grievance Redress (GRS) and Hotline 16122

**[Observed]** `hotline.land.gov.bd` offers two service types — অভিযোগ প্রতিকার (grievance redress) and কারিগরি সহায়তা (technical support) — with citizen and administrative logins that redirect into the central Keycloak IdP for `grs.land.gov.bd`.

```mermaid
flowchart TD
    C([Citizen]) --> CH{Channel}
    CH -->|Phone| H["16122 hotline agent"]
    CH -->|Web| W["hotline.land.gov.bd → GRS"]
    CH -->|App| A["Mobile app"]
    H --> T["Ticket created"]
    W --> T
    A --> T
    T --> CLS{"Classify"}
    CLS -->|Technical| TECH["Vendor / project support queue"]
    CLS -->|Service delay| OFF["Concerned land office"]
    CLS -->|Misconduct| ADM["Administrative / disciplinary channel"]
    TECH --> RES["Resolution + citizen notification"]
    OFF --> RES
    ADM --> RES
    RES --> FB["Feedback / satisfaction capture"]
    FB --> ANA["Analytics → recurring-defect register"]

    style ANA fill:#1a5632,color:#fff
```

**The missing loop:** a grievance system's value is not in closing tickets, it is in **feeding the defect register that changes the software and the SLA**. Publishing anonymised, per-upazila grievance statistics — volume, category, median resolution time — would convert 16122 from a complaint sink into the ecosystem's primary quality instrument. That is a policy decision, not an engineering one, and it costs almost nothing.

### 6.5 Cross-process dependency map

```mermaid
flowchart LR
    DEED["Deed registration<br/>(Ministry of Law)"] -->|manual paper| MUT["Mutation"]
    LDT["LD Tax clearance"] -->|prerequisite| MUT
    REC["Khatian record<br/>(DLRMS)"] -->|source of truth| MUT
    MAP["Mouza map"] -->|boundary evidence| MUT
    MUT -->|creates| NEWK["New khatian"]
    NEWK -->|creates| NEWH["New holding"]
    NEWH --> LDT
    MUT -->|disputes| CASE["Revenue case / appeal"]
    ALL["Any step failing"] --> GRS["GRS / 16122"]

    style DEED fill:#7c2d12,color:#fff
    style MUT fill:#c9a227,color:#000
```

Note the **circular dependency**: you need a paid LD Tax receipt to mutate, but you cannot get a holding to pay tax on newly acquired land until the mutation is done. Citizens resolve this by paying against the *seller's* holding — a workaround the software should model explicitly rather than leave to counter staff to improvise.

---

## Part E — UX Analysis and Recommendations

### 7.1 Who the actual users are

Design decisions must be anchored to the real population, not to the urban smartphone user who is easiest to imagine.

| Segment | Share of land-service users | Defining constraint |
|---|---|---|
| Rural landholder, low digital literacy | Largest | Bangla-only, entry-level Android, intermittent data, relies on a helper |
| Union Digital Centre (UDC) operator | High volume per head | Processes many citizens per day; needs speed and bulk handling |
| Urban owner / buyer | Moderate | Time-sensitive, transacting, wants status certainty |
| Non-resident Bangladeshi | Small but high-stakes | Cannot appear physically; OTP to a foreign number often fails |
| Land office staff | Internal | Volume, keyboard-first, must work when connectivity is poor |
| Lawyer / surveyor / intermediary | Persistent | Will keep existing while self-service remains hard |

> The presence of the last group is a **measurement of UX failure**. Every taka paid to a middleman to operate a free government portal is a quantifiable usability defect. "Reduction in intermediary dependence" is the correct north-star metric for this programme — not page views or registered accounts.

### 7.2 Friction inventory

| # | Friction point | Severity | Affected | Root cause |
|---|---|---|---|---|
| U-1 | **Separate accounts per portal** — mutation, LD tax, GRS, map | 🔴 Critical | All | Vendor-siloed delivery; central IdP exists but is not universally applied |
| U-2 | **No single "my land / my applications" view** | 🔴 Critical | All | No cross-service aggregation layer |
| U-3 | **OTP delivery failure / SIM change / foreign numbers** | 🔴 Critical | NRB, rural | Single-factor dependence on SMS |
| U-4 | **Opaque status semantics** ("প্রক্রিয়াধীন" for weeks) | 🔴 Critical | Applicants | Internal workflow states not mapped to citizen-meaningful labels |
| U-5 | **Rejection reasons are generic** | 🟠 High | Applicants | Free-text rejection instead of structured reason codes |
| U-6 | **Document upload fails on large phone photos** | 🟠 High | Rural | No client-side compression; hard size limits; unclear errors |
| U-7 | **Payment succeeds, receipt doesn't appear** | 🟠 High | All | Missing callback + no self-service reconciliation |
| U-8 | **Mouza / khatian selection requires knowledge the citizen lacks** | 🟠 High | First-timers | Data model exposed raw as cascading dropdowns |
| U-9 | **Heavy pages, slow on 2G/3G and low-RAM devices** | 🟠 High | Rural | No performance budget; unoptimised bundles |
| U-10 | **Inconsistent Bangla terminology and UI between portals** | 🟡 Medium | All | No shared design system or content style guide |
| U-11 | **Bangla numeral vs Arabic numeral inconsistency** | 🟡 Medium | All | No standard for numeric display and input |
| U-12 | **Peak-time unavailability (Boishakh tax deadline)** | 🟡 Medium | All | Synchronous write path, no queueing |
| U-13 | **Accessibility: contrast, tap targets, screen-reader labels** | 🟡 Medium | Elderly, disabled | No WCAG conformance target |
| U-14 | **No offline/assisted mode for UDC operators** | 🟡 Medium | UDC | Web-only assumption |

### 7.3 Prioritisation: impact vs effort

```mermaid
quadrantChart
    title UX interventions — citizen impact vs implementation effort
    x-axis "Low effort" --> "High effort"
    y-axis "Low impact" --> "High impact"
    quadrant-1 "Major projects"
    quadrant-2 "Do first"
    quadrant-3 "Fill-in"
    quadrant-4 "Reconsider"
    "Unified SSO across all portals": [0.42, 0.95]
    "Single my-applications dashboard": [0.55, 0.92]
    "Plain-language status labels": [0.12, 0.80]
    "Structured rejection reason codes": [0.20, 0.78]
    "Client-side image compression": [0.14, 0.66]
    "Self-service payment recheck": [0.22, 0.74]
    "Performance budget + light mode": [0.30, 0.70]
    "Shared design system": [0.60, 0.62]
    "Registry to mutation event feed": [0.88, 0.97]
    "Map linked to ownership view": [0.72, 0.55]
    "WCAG 2.2 AA conformance": [0.45, 0.48]
    "Voice/IVR status via 16122": [0.35, 0.58]
    "Offline UDC assisted mode": [0.66, 0.42]
    "Bangla numeral standardisation": [0.10, 0.30]
```

**Read the top-left quadrant first.** Plain-language status labels, structured rejection codes, image compression, and a payment-recheck button are all small engineering tasks with disproportionate citizen impact. They should not wait for the platform consolidation programme.

### 7.4 Recommended technology per problem

| Problem | Recommended technology / approach | Why this choice |
|---|---|---|
| U-1 Fragmented login | Extend the **existing Keycloak realm `lsg`** to every citizen-facing portal; enforce **OIDC + PKCE** for mobile | The IdP is already deployed and rotating clients — this is configuration and integration, not new procurement |
| U-2 No unified view | **Backend-for-Frontend (BFF)** aggregating mutation, LD tax, GRS and record services behind one API, with **GraphQL or a composed REST facade** | Kong already fronts the services; a BFF avoids rewriting them |
| U-3 OTP fragility | Multi-channel OTP (SMS + email + WhatsApp/IVR), **TOTP authenticator option**, passkeys/WebAuthn for repeat users, recovery via UDC with in-person identity check | Removes single-point dependency on telecom delivery |
| U-4 Opaque status | **Explicit citizen-facing state machine**: 8–10 named states, each with "who has it now", "what happens next", "expected by" date | Status ambiguity is the #1 driver of hotline volume and of middleman engagement |
| U-5 Generic rejections | **Enumerated reason codes** (`E-DOC-MISSING-TAX-RECEIPT`) rendered as Bangla explanation + exact remedy + resubmit deep link | Makes rejections analysable and machine-actionable |
| U-6 Upload failures | Browser-side resize/compress (`canvas`/`WebAssembly`), **resumable uploads (tus)**, on-device **document quality check** before submit | Cuts failed submissions and support tickets sharply |
| U-7 Payment limbo | **Idempotency keys**, signed webhooks with replay protection, scheduled **reconciliation job**, user-facing "recheck payment status" | Turns a support ticket into a self-service button |
| U-8 Data-model exposure | **Search-first entry**: type an address, NID-linked holdings, or drop a map pin → system proposes mouza/khatian/dag | Citizens know where their land *is*, not its JL number |
| U-9 Performance | **Performance budget** (≤200 KB critical JS), SSR + streaming, route-level code splitting, **self-hosted Bangla webfont subset**, image `AVIF/WebP`, **PWA with offline shell** | Next.js is already in use; these are configuration and discipline |
| U-10/U-11 Inconsistency | **Government design system for land services**: shared component library, Bangla content style guide, single numeral convention, agreed terminology glossary | Also reduces per-vendor build cost over time |
| U-12 Peak load | **Queue-based write path** (RabbitMQ is already deployed), read replicas, autoscaling, static caching of assessment lookups, staged deadlines | Broker exists; use it to absorb bursts |
| U-13 Accessibility | Target **WCAG 2.2 AA**; automated axe checks in CI; manual screen-reader testing in Bangla | Legal and ethical baseline for a mandatory public service |
| U-14 Assisted service | **Operator console** with queue, batch upload, offline draft sync, and explicit "assisted by UDC #____" audit attribution | UDCs are the real last mile; build for them deliberately |

### 7.5 Proposed target architecture

```mermaid
flowchart TB
    subgraph CH["Channels"]
        W["Web PWA"]
        M["Mobile apps"]
        U["UDC operator console"]
        I["IVR / 16122"]
        WA["WhatsApp / chatbot status"]
    end

    subgraph EDGE["Edge"]
        CDN["CDN + WAF + bot mgmt"]
        GW["Kong: routing · rate limit · JWT · mTLS to services"]
    end

    subgraph BFF["Experience layer"]
        BF["Backend-for-Frontend<br/>aggregation · caching · shaping"]
        DS["Shared design system<br/>+ Bangla content standards"]
    end

    subgraph ID["Identity"]
        KC["Keycloak realm lsg<br/>OIDC + PKCE + step-up auth"]
        CONS["Consent & audit register (PDPO)"]
    end

    subgraph DOM["Domain services"]
        MUTS["Mutation"]
        TAXS["LD Tax"]
        RECS["Records / khatian"]
        GEOS["Geospatial"]
        GRSS["Grievance"]
        PAYS["Payment orchestration"]
        NOTS["Notification"]
    end

    subgraph PLAT["Platform"]
        MQ["Event bus"]
        AUD["Append-only audit ledger"]
        OBS["Observability: logs · metrics · traces"]
        SEC["Secrets vault · key management"]
    end

    subgraph EXTS["External"]
        NIDX["NID verification"]
        REGX["Deed registry event feed ★new"]
        MFSX["MFS / banks / treasury"]
        SMSX["SMS / IVR"]
    end

    CH --> CDN --> GW --> BF --> DOM
    BF --> KC
    DOM --> MQ
    DOM --> AUD
    DOM --> EXTS
    MQ --> NOTS
    DOM --> OBS
    DOM --> SEC

    style REGX fill:#1a5632,color:#fff
    style BF fill:#c9a227,color:#000
    style AUD fill:#c9a227,color:#000
```

**What changes versus today:** an experience layer that hides service fragmentation from the citizen, one identity for everything, an append-only audit ledger that makes every decision traceable, and — the decisive addition — an **event feed from the deed registry** so that mutation becomes a proactive prompt from the state rather than an errand for the citizen.

### 7.6 Content and language guidance

Bangla-language government UI has recurring, fixable problems:

| Practice | Do | Avoid |
|---|---|---|
| Terminology | Fix one term per concept across all portals (নামজারি vs মিউটেশন vs খারিজ — pick one, gloss the others) | Different words for the same thing on different screens |
| Register | Everyday Bangla with the legal term in parentheses | Unglossed administrative Bangla (সরকারি ভাষা) |
| Numerals | One convention system-wide; accept both on input | Mixing ১২৩ and 123 within one screen |
| Status text | "আপনার আবেদন ইউনিয়ন ভূমি অফিসে যাচাইয়ের অপেক্ষায় — সাধারণত ১০ কার্যদিবস" | "প্রক্রিয়াধীন" with no actor and no date |
| Errors | State what happened, why, and the exact next action | "Something went wrong" / raw exception text |
| Typography | Self-hosted subset of a high-quality Bangla font; test conjunct rendering on Android 8–11 | CDN-loaded full font; untested যুক্তাক্ষর on low-end devices |
| Forms | One question per screen on mobile; save drafts continuously | Long multi-section forms that lose data on session timeout |

### 7.7 UX measurement framework

| Metric | Definition | Baseline | 12-month target |
|---|---|---|---|
| Self-service completion rate | Applications completed without intermediary or office visit | Establish | +40 pp |
| First-attempt submission success | Submissions accepted without correction | Establish | ≥ 85% |
| Median time-to-first-status | Submission → first substantive state change | Establish | ≤ 3 working days |
| SLA adherence | Cases closed within 28 working days | Establish | ≥ 90% |
| Payment-limbo rate | Debits without receipt within 24h | Establish | < 0.1% |
| Hotline contact rate | 16122 contacts per 1,000 applications | Establish | −50% |
| Mobile p75 load time on 3G | Time to interactive | Establish | ≤ 5 s |
| Accessibility conformance | WCAG 2.2 AA automated + manual pass | Not measured | 100% of citizen journeys |

> Every one of these requires instrumentation that does not currently appear to exist publicly. **Publishing them quarterly** would do more for accountability than any additional feature.

---

## Part F — Security Posture, Risks and Fixes

> **Framing.** This part is written for the *system owner* — the Ministry of Land, the Land Management Automation Project, and its vendors. It describes categories of weakness and how to close them. It deliberately contains **no exploitation technique, no proof-of-concept, and no attack methodology**. Every observation below is taken from headers and policies the servers publish to every visitor. Under the **Cyber Security Ordinance 2025**, unauthorised access to these systems is a criminal offence; a genuine assessment must be commissioned, scoped in writing, and conducted by authorised testers.

### 8.1 Why land records are a high-value target

Land systems are attractive to attackers in a way that most government portals are not:

```mermaid
flowchart LR
    A["Land record<br/>= legal title"] --> B["Directly convertible<br/>to money"]
    A --> C["Alteration is<br/>hard to reverse"]
    A --> D["Victim may not<br/>notice for years"]
    A --> E["Contains full PII:<br/>NID, name, address,<br/>phone, family links"]
    B --> F["Fraudulent sale<br/>or mortgage"]
    C --> G["Litigation lasting<br/>a decade"]
    D --> H["Detection gap"]
    E --> I["Identity theft at<br/>national scale"]

    style A fill:#7c2d12,color:#fff
```

A stolen password can be reset. **A fraudulently mutated title cannot be reset — it must be litigated.** This asymmetry is why land systems warrant controls closer to banking than to typical e-government.

### 8.2 Observed security posture

**[Observed]** — response headers on `GET /`, 18 August 2026. This is a snapshot of publicly visible configuration, not an assessment of the applications behind it.

| Control | land.gov.bd | mutation | map | hotline | ldtax |
|---|---|---|---|---|---|
| HTTPS + HSTS preload | ✅ 180d | ✅ 180d | ❌ **absent** | ✅ 180d | ✅ 180d |
| Content-Security-Policy | ❌ absent | ⚠️ present, permissive | ❌ **absent** | ❌ absent | ❌ absent |
| X-Frame-Options / frame-ancestors | ❌ absent | ✅ `frame-ancestors 'self'` | ❌ **absent** | ⚠️ conflicting (DENY + SAMEORIGIN) | ✅ SAMEORIGIN |
| X-Content-Type-Options | ✅ | ✅ | ❌ **absent** | ✅ | ✅ |
| Referrer-Policy | ❌ absent | ❌ absent | ❌ absent | ✅ same-origin | ✅ same-origin |
| Permissions-Policy | ❌ absent | ⚠️ partial | ❌ absent | ✅ restrictive | ❌ absent |
| `Access-Control-Allow-Origin` | not set | ⚠️ **`*`** | ⚠️ **`*`** | scoped by origin | not set |
| Session cookie `HttpOnly` | n/a | ✅ | ✅ | ✅ | — |
| Session cookie `SameSite` | n/a | ✅ `strict` | ⚠️ `lax` | ⚠️ `lax` | — |
| Server/stack disclosure | ⚠️ `x-powered-by: Next.js` | ⚠️ `via: kong/3.6.1` | ⚠️ `SERVER=citizen2` cookie | minimal | minimal |
| Edge WAF / bot protection | ✅ Cloudflare | ✅ Cloudflare | ❌ **no CF headers** | ✅ Cloudflare | ✅ Cloudflare (403 to non-browser UA) |
| `security.txt` | ⚠️ present but **expired 2025-10-31** | — | — | — | — |

#### Summary scoring

```mermaid
xychart-beta
    title "Observable security-header posture by host (0 = none, 10 = complete)"
    x-axis ["ldtax", "hotline", "mutation", "land.gov.bd", "map"]
    y-axis "Score" 0 --> 10
    bar [7, 7, 6, 4, 1]
```

**The pattern is unmistakable: security configuration tracks the vendor, not the sensitivity of the data.** `map.land.gov.bd` — which handles geolocation and plot data and is built by a different joint venture — sits far below the others. Nothing about the map's data justifies weaker protection than the hotline's.

### 8.3 Threat model (STRIDE)

| Threat class | Concrete scenario in this ecosystem | Primary control |
|---|---|---|
| **S**poofing | Attacker registers using someone else's NID + DOB obtained from a prior national data leak; SIM-swap intercepts OTP | Strong identity proofing; multi-factor beyond SMS; step-up auth before any title-affecting action |
| **T**ampering | Unauthorised change to owner name, share, or dag area in a khatian record | Append-only audit ledger; four-eyes approval; cryptographic record signing |
| **R**epudiation | Officer denies making a change; citizen denies submitting an application | Tamper-evident logs bound to authenticated identity; digital signature on orders |
| **I**nformation disclosure | Bulk extraction of owner PII via an under-authorised read endpoint or a permissive CORS policy | Per-record authorisation, output minimisation, rate limits, anomaly detection on bulk reads |
| **D**enial of service | Boishakh tax-deadline flood; targeted attack on the mandatory-payment window | Edge WAF + queueing + autoscaling + staged deadlines |
| **E**levation of privilege | Citizen-level token accepted by an officer-level endpoint; staging credentials reaching production | Server-side role checks on every endpoint; hard environment separation |

**The two most likely attack paths, based on what the sector has actually experienced:**

```mermaid
flowchart TD
    subgraph P1["Path 1 — Data disclosure (most common in BD)"]
        A1["A public endpoint returns more data<br/>than the caller is entitled to"] --> A2["Automated bulk collection"] --> A3["PII corpus"] --> A4["Resale, identity fraud,<br/>targeted social engineering"]
    end
    subgraph P2["Path 2 — Title tampering (most damaging)"]
        B1["Credential compromise of an<br/>office-level account"] --> B2["Legitimate-looking workflow action"] --> B3["Fraudulent mutation or<br/>tax-record alteration"] --> B4["Sale or mortgage of<br/>land the actor does not own"]
    end

    style A4 fill:#7c2d12,color:#fff
    style B4 fill:#7c2d12,color:#fff
```

Note that **Path 2 does not require breaking any cryptography.** It requires one officer's password. This is why insider-threat and account-security controls matter more here than perimeter hardening.

### 8.4 Sector precedent

**[Documented]** Bangladesh has already experienced exactly the failure mode Path 1 describes:

- **2023:** a government portal exposed personal data of roughly **50 million citizens** — names, phone numbers, email addresses and NID numbers. The ICT minister stated it resulted from **security weaknesses in a website, not a cyberattack**. Officials attributed it to a partner organisation retaining Election Commission data it was not authorised to keep. The researcher who found it reported difficulty getting any response from the authorities.
- **2023 onward:** leaked NID data subsequently circulated openly on Telegram channels.
- **2025:** a threat actor advertised a database claimed to contain 4.1 million records from a Bangladeshi civil-registration portal, including names, addresses, phone numbers, NID numbers and dates of birth.

**Three lessons that apply directly to the land ecosystem:**

1. The damage came from **weak configuration and over-retention**, not sophisticated intrusion. The controls that would have prevented it are unglamorous ones.
2. **The reporting channel failed.** A researcher tried repeatedly to notify the government and could not. The land portal's `security.txt` being **expired since 31 October 2025** and pointing to a vendor employee's personal address rather than an institutional inbox repeats this exact mistake.
3. **Once NID data is public, NID + date of birth is no longer proof of identity.** Yet NID + DOB + mobile is precisely the registration credential for both `ldtax.gov.bd` and the mutation portal. This is the single most important security assumption in the ecosystem, and the sector's own history has invalidated it.

### 8.5 Risk register

Likelihood × Impact, scored 1–5.

| ID | Risk | L | I | Score | Priority |
|---|---|---|---|---|---|
| **F-1** | Inconsistent security headers / missing CSP, HSTS, frame protection on some hosts | 5 | 3 | **15** | 🔴 |
| **F-2** | Broken object-level authorisation — records readable by callers not entitled to them | 3 | 5 | **15** | 🔴 |
| **F-3** | Identity proofing built on NID + DOB, which are already public from prior leaks | 5 | 5 | **25** | 🔴 |
| **F-4** | Staging hosts (`dlrms-stg`, `stg-gen2idp`) reachable from production context | 4 | 4 | **16** | 🔴 |
| **F-5** | Wildcard `Access-Control-Allow-Origin: *` on citizen-facing hosts | 4 | 3 | **12** | 🟠 |
| **F-6** | Message broker endpoint exposed to browsers | 3 | 4 | **12** | 🟠 |
| **F-7** | Insider misuse — officer account alters title records | 3 | 5 | **15** | 🔴 |
| **F-8** | SMS OTP as sole second factor (SIM swap, SS7, delivery failure) | 4 | 4 | **16** | 🔴 |
| **F-9** | Payment integrity — unsigned/replayable callbacks, non-idempotent writes | 3 | 4 | **12** | 🟠 |
| **F-10** | Document upload as a malware/injection vector | 3 | 3 | **9** | 🟠 |
| **F-11** | Third-party analytics on pages handling land ownership data | 4 | 2 | **8** | 🟠 |
| **F-12** | No functioning responsible-disclosure channel (expired `security.txt`) | 5 | 3 | **15** | 🔴 |
| **F-13** | Multi-vendor sprawl without an enforced platform security baseline | 5 | 3 | **15** | 🔴 |
| **F-14** | Privacy policies outdated; PDPO 2025 obligations not reflected | 5 | 3 | **15** | 🔴 |
| **F-15** | Availability during statutory payment deadlines | 4 | 3 | **12** | 🟠 |
| **F-16** | Weak audit trail / non-repudiation for administrative decisions | 3 | 5 | **15** | 🔴 |
| **F-17** | Secrets and credential management across vendors | 3 | 4 | **12** | 🟠 |
| **F-18** | Backup, ransomware resilience, and verified restore for the title registry | 2 | 5 | **10** | 🟠 |

```mermaid
quadrantChart
    title Risk heat map — likelihood vs impact
    x-axis "Low likelihood" --> "High likelihood"
    y-axis "Low impact" --> "High impact"
    quadrant-1 "URGENT"
    quadrant-2 "Prepare"
    quadrant-3 "Monitor"
    quadrant-4 "Fix cheaply"
    "F-3 NID-based identity": [0.92, 0.94]
    "F-8 SMS-only 2FA": [0.78, 0.76]
    "F-4 Staging exposure": [0.74, 0.74]
    "F-2 Object-level authz": [0.55, 0.94]
    "F-7 Insider misuse": [0.52, 0.92]
    "F-16 Weak audit trail": [0.50, 0.90]
    "F-18 Backup/ransomware": [0.32, 0.94]
    "F-1 Header inconsistency": [0.92, 0.52]
    "F-12 No disclosure channel": [0.92, 0.50]
    "F-13 Vendor sprawl": [0.90, 0.55]
    "F-14 Policy/PDPO gap": [0.90, 0.48]
    "F-5 Wildcard CORS": [0.74, 0.50]
    "F-9 Payment integrity": [0.55, 0.72]
    "F-6 Broker exposure": [0.50, 0.70]
    "F-15 Peak availability": [0.72, 0.50]
    "F-11 Third-party analytics": [0.76, 0.34]
    "F-10 Upload vector": [0.52, 0.52]
    "F-17 Secrets management": [0.50, 0.72]
```

### 8.6 Findings and fixes in detail

---

#### F-1 · Inconsistent security headers 🔴

**What was seen.** `map.land.gov.bd` returns no HSTS, no CSP, no `X-Frame-Options`, no `X-Content-Type-Options`, and no Cloudflare edge headers. `land.gov.bd` has no CSP and no frame protection. `hotline` sends two conflicting `X-Frame-Options` values. Only `mutation` sends a CSP, and it permits `'unsafe-inline'` and `'unsafe-eval'` for scripts.

**Why it matters.** These headers are the browser's instructions for containing a compromise. Without CSP and frame protection, an injected script or a clickjacking overlay has far more room to operate. `'unsafe-eval'` substantially weakens what CSP can promise.

**Fix.**
1. Define **one baseline security-header policy** and enforce it at the shared edge (Cloudflare Transform Rules / Kong response plugin) so no vendor can ship without it:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `Content-Security-Policy` with `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`
2. Eliminate `'unsafe-inline'` / `'unsafe-eval'` by moving to **nonce- or hash-based CSP**; run `Content-Security-Policy-Report-Only` first to find breakage.
3. Put **every** land subdomain behind the same WAF — including `map.land.gov.bd`.
4. Remove `x-powered-by`, and stop returning backend node identifiers such as the `SERVER=citizen2` cookie.
5. Add CSP violation reporting and monitor it.

**Effort:** low. **Timeline:** 2–4 weeks. **This is the highest return-per-taka item in the entire document.**

---

#### F-2 · Object-level authorisation 🔴

**What it means.** The most common serious flaw in record-centric government systems is not a missing login — it is a *present* login that fails to check whether *this* authenticated user is entitled to *this specific record*. Identifiers such as `mouza + khatian + dag` are inherently guessable because they are public, structured, and sequential.

**Fix.**
1. Enforce authorisation **server-side on every read and write**, evaluated against the requesting identity — never trust a client-supplied scope.
2. Adopt a **default-deny** policy layer (e.g. OPA, or Kong plugin + service-level policy) so a new endpoint is unreachable until a policy is written for it.
3. Distinguish **public** land data (plot geometry, land class, zoning) from **protected** data (owner name, NID, phone, share) and never return protected fields on unauthenticated paths.
4. Apply **per-identity rate limits and anomaly detection**: a legitimate citizen queries a handful of holdings; sequential enumeration is a detectable signature.
5. Include authorisation tests in CI — every endpoint must have a test proving another user's token is rejected.
6. Commission an authorised penetration test focused specifically on this class.

---

#### F-3 · Identity proofing built on already-leaked data 🔴 *(highest score)*

**What it means.** Registration on the land portals uses **NID number + date of birth + mobile number**. Following the 2023 exposure of ~50 million citizens' records and their subsequent circulation, these three fields must be treated as **public knowledge, not secrets**. The current model authenticates *knowledge of a citizen's data* rather than the citizen.

**Fix.**
1. Add **biometric or documentary verification** for account creation where feasible — live face match against the NID photo, as used in MFS e-KYC in Bangladesh.
2. Require **step-up authentication** — re-verification at a higher assurance level — before any *title-affecting* action, even if the session is already valid. Viewing a record and transferring a record must not carry the same assurance.
3. Send an **unconditional out-of-band notification** to all recorded owners of a dag whenever a mutation application touching it is filed, with a one-tap objection path. This single control substantially closes the fraudulent-mutation window even when an account is compromised.
4. Support **in-person identity binding** at UDCs and land offices, with the assisting operator recorded in the audit trail.
5. Apply a **cool-off period with notification** for high-value changes, mirroring banking practice for new-payee additions.

---

#### F-4 · Staging environments referenced from production 🔴

**What was seen.** `backoffice.dlrms-stg.land.gov.bd` and `stg-gen2idp.land.gov.bd` appear in the production mutation portal's CSP.

**Why it matters.** Staging systems characteristically have weaker credentials, verbose error output, outdated patches, and — most seriously — are often populated with **copies of production data**. A production frontend legitimately calling a staging identity provider or backoffice is an environment-separation failure.

**Fix.**
1. Remove all non-production hosts from production configuration; fail the build if a hostname matching `stg|dev|test|uat` appears in a production artefact.
2. Place non-production environments on **separate domains, separate networks, and behind access control** (VPN, mTLS, or IP allow-list) — never publicly resolvable.
3. **Never use production personal data in non-production.** Use synthetic or irreversibly anonymised datasets. Under PDPO 2025 this is a compliance requirement, not merely good practice.
4. Rotate any credential that has ever existed in a shared or staging context.
5. Audit DNS for all `*.land.gov.bd` records and decommission orphans — stale subdomains are a standing takeover risk.

---

#### F-5 · Wildcard CORS 🟠

**What was seen.** `Access-Control-Allow-Origin: *` on both `mutation.land.gov.bd` and `map.land.gov.bd`.

**Why it matters.** A wildcard tells every browser that any website may read responses from that origin. It is acceptable only for genuinely public, non-credentialed data. On a host that also serves authenticated citizen data, it is a serious misconfiguration.

**Fix.** Replace the wildcard with an **explicit allow-list** of first-party origins; never combine a wildcard with `Access-Control-Allow-Credentials`; split genuinely public read-only APIs onto a separate origin that carries no session cookies; restrict allowed methods and headers.

---

#### F-6 · Message broker exposed to the browser 🟠

**What was seen.** `mutation-rabbitmq.land.gov.bd` in the browser-enforced `connect-src`.

**Why it matters.** Brokers are internal infrastructure. Directly browser-reachable brokers historically suffer from over-broad topic permissions, shared credentials embedded in client code, and management interfaces exposed alongside the data plane.

**Fix.** Terminate real-time connections at an **application-owned WebSocket/SSE service** that authenticates the user, authorises the subscription, and translates to the broker internally. Keep the broker on a private network. Ensure no broker credential is ever shipped to a client. Confirm the management UI is not internet-reachable.

---

#### F-7 · Insider misuse 🔴

**Why it matters.** The system grants officers legitimate authority to alter title records. A compromised or corrupt officer account is the **most damaging and least detectable** scenario in the model, and does not require any technical vulnerability.

**Fix.**
1. **Phishing-resistant MFA (hardware keys or passkeys) mandatory for every official account** — no exceptions, no SMS fallback for staff.
2. **Four-eyes approval** for high-value changes: area above a threshold, area corrections, owner-name changes, retrospective edits.
3. **Behavioural analytics**: alert on out-of-hours activity, actions outside jurisdiction, unusual approval velocity, repeated access to the same high-value plot.
4. **Immutable, append-only audit ledger** — write-once storage or cryptographic chaining so that even an administrator cannot silently rewrite history.
5. **Owner-visible history**: let a citizen see every access and change to their own record. Transparency to the data subject is the cheapest and most effective insider deterrent available.
6. Segregate duties so no single role can initiate, approve, and issue.

---

#### F-8 · SMS OTP as the only second factor 🔴

**Why it matters.** SMS is vulnerable to SIM swap and interception, and it simply fails for overseas users and in poor-coverage areas — making this both a security and a UX defect (see U-3).

**Fix.** Offer **TOTP authenticator apps** and **passkeys/WebAuthn** as preferred factors; keep SMS only as fallback. Notify on every new-device login. Enforce a **cool-off with notification after any SIM/number change** before high-value actions. Rate-limit and lock out OTP attempts. Add device binding for the mobile apps.

---

#### F-9 · Payment integrity 🟠

**Fix.** Require **idempotency keys** on every payment write. Verify webhook signatures (HMAC) with a strict replay window and nonce tracking. Run **automated daily reconciliation** between broker and application records with a dashboard for unmatched transactions. Never allow client-supplied amounts — always recompute server-side. Log every state transition to the audit ledger. Expose a citizen-facing "recheck payment status" action.

---

#### F-10 · Document upload as an attack surface 🟠

**Fix.** Validate content type by inspecting file contents, not by extension or client-declared MIME. Enforce size and page limits. **Re-encode images and flatten PDFs** to strip embedded active content. Run malware scanning. Store uploads in a **separate object store on a distinct origin** with no execution capability, served only through signed, expiring URLs. Strip EXIF metadata. Never serve user-uploaded files from the application's own origin.

---

#### F-11 · Third-party analytics on sensitive pages 🟠

**What was seen.** `mutation.land.gov.bd`'s CSP permits Google Tag Manager, Google Analytics, and `insightdb.ai`.

**Why it matters.** Third-party scripts on authenticated land-ownership pages can capture URLs, referrers, and — depending on configuration — form field contents. Under PDPO 2025 this raises questions about consent, cross-border transfer, and the legal basis for sharing.

**Fix.** Move to **self-hosted, privacy-preserving analytics** for authenticated areas; if third-party analytics remain, restrict them to unauthenticated marketing pages only, with consent. Document every processor in a public register with its legal basis. Verify no PII or record identifiers appear in URLs, since URLs propagate to analytics and referrer headers.

---

#### F-12 · No functioning responsible-disclosure channel 🔴

**What was seen.**

```
Contact: mailto: shiful@ba-systems.com
Expires: 2025-10-31T10:10:00Z
```

Three defects in two lines: the policy has been **expired for nearly ten months**; the contact is a **vendor employee's individual address** rather than an institutional inbox; and there is no encryption key, no policy URL, no acknowledgement commitment, and no preferred language.

**Why it matters.** In 2023 a researcher who found a 50-million-record exposure could not get a response from Bangladeshi authorities, and the data stayed exposed. An expired `security.txt` pointing at one person's mailbox reproduces that failure exactly. **The cheapest security control available to this programme is a mailbox that someone reads.**

**Fix.**
1. Publish a current, RFC 9116-compliant `security.txt` on **every** land subdomain: institutional contact (`security@land.gov.bd`), policy URL, PGP key, preferred languages (`bn, en`), and an `Expires` date under 12 months with a renewal reminder in the ops calendar.
2. Publish a **Vulnerability Disclosure Policy** with a safe-harbour statement — researchers acting in good faith within scope will not face legal action. Without safe harbour, the Cyber Security Ordinance 2025's penalties actively discourage the people most likely to find problems first.
3. Commit to acknowledgement within 72 hours and triage within 10 working days.
4. Route to a monitored team inbox with an on-call rota, and formalise escalation to **BGD e-GOV CIRT** and the National Cyber Security Agency.
5. Consider a coordinated disclosure or bug-bounty programme once the baseline is stable.

---

#### F-13 · Multi-vendor sprawl without a platform baseline 🔴

**What was seen.** Different frameworks (Next.js, Laravel, Django), different session schemes, and materially different security postures per subdomain — correlating with the four-plus vendors credited across the ecosystem.

**Fix.**
1. Publish a mandatory **Land Platform Security Baseline** — headers, TLS, authentication, logging, dependency policy, secrets handling, data classification — and make conformance a **contractual acceptance criterion** with payment milestones tied to it.
2. Enforce it centrally at the edge and gateway so conformance is not left to vendor discipline.
3. Require **SBOMs** and automated dependency scanning from every vendor.
4. Require **independent security assessment before go-live** for every release, paid for by the project, not the vendor.
5. Maintain a single asset inventory of domains, services, and data flows, with a named owner per asset.
6. Include **source-code escrow and exit obligations** so security does not depend on one supplier's continued cooperation.

---

#### F-14 · Legal and privacy compliance 🔴

**Legal context [Documented].**

| Instrument | Status | Relevance |
|---|---|---|
| **Personal Data Protection Ordinance 2025** | Promulgated 6 Nov 2025; some sections effective 18 months after gazette | Consent, purpose limitation, data-subject rights, DPO appointment, breach notification |
| **PDP (Amendment) Ordinance 2026** | Promulgated 5 Feb 2026 | Requires at least one synchronised real-time in-country copy for *restricted* personal data and **Critical Information Infrastructure** data |
| **Cyber Security Ordinance 2025** | Gazetted 21 May 2025 | Establishes the National Cyber Security Agency, CII designation and obligations, incident response duties |
| **National Data Governance Ordinance 2025** | Approved Oct 2025 | Establishes the National Data Governance Authority as enforcement body |

**Gap.** The Smart Bhumi Naksha privacy policy is dated **April 2023** — pre-dating all of the above. It does not identify a legal basis for processing, a retention period, a data protection officer, data-subject rights, or a breach-notification procedure, and its security section commits only to notifying users after a breach.

**Fix.**
1. **Assess whether the land registry is Critical Information Infrastructure** under the Cyber Security Ordinance 2025. It very likely qualifies — which triggers specific obligations including in-country real-time replication under the amended PDPO.
2. **Appoint a Data Protection Officer** for the Ministry of Land and publish the contact.
3. **Rewrite every privacy policy** to PDPO standard: categories of data, purposes, legal basis, retention, recipients and processors, cross-border transfers, data-subject rights and how to exercise them, breach procedure, DPO contact. Publish in **Bangla and English**.
4. **Data minimisation review**: the 2023 breach was attributed to an organisation retaining data it was not supposed to keep. Audit what each land service stores, and delete what is not needed. Ask specifically whether the map application needs to retain user location history at all.
5. **Records of Processing Activities** across all land systems.
6. **Formal breach-notification runbook** with defined timelines and CIRT/NDGA escalation, rehearsed at least annually.
7. **DPIA** for each system handling land ownership data.

---

#### F-15 · Availability during statutory deadlines 🟠

Because manual counter collection has been withdrawn, LD Tax portal downtime near a deadline is not an inconvenience — it prevents legal compliance.

**Fix.** Publish an availability SLA. Queue-based writes absorbing bursts (the broker already exists). Autoscaling with load testing at 5× projected peak. Static caching of assessment lookups. Graceful degradation — accept the payment intent even if receipt generation is delayed. A documented **legal grace provision** for verified outage periods. A public status page.

---

#### F-16 · Audit trail and non-repudiation 🔴

**Fix.** Every state change recorded with actor identity, role, timestamp, source IP, session ID, before/after values, and reason code. **Append-only storage** with cryptographic chaining (each entry hashing the previous) so tampering is detectable. Retention aligned to the legal limitation period for land disputes — decades, not months. **Digital signatures on AC Land orders and issued khatians**, verifiable via the QR code already printed on them. Audit access to the audit log itself. Give citizens a view of their own record's history.

---

#### F-17 · Secrets management 🟠

**Fix.** A central secrets vault (HashiCorp Vault or equivalent); no credentials in source, config files, or container images. Automated rotation. Short-lived, workload-identity-based service credentials instead of static keys. Pre-commit and CI secret scanning across all vendor repositories. Immediate rotation of anything ever exposed. The observed date-stamped OIDC client naming (`…-live-20260412`) suggests rotation discipline already exists — extend it everywhere.

---

#### F-18 · Backup and ransomware resilience 🟠

The title registry is a national record of legal ownership. Its permanent loss or encryption would be a catastrophe with no straightforward recovery path.

**Fix.** **3-2-1-1-0 strategy**: three copies, two media, one off-site, **one immutable/air-gapped**, zero errors after verified restore testing. **Test restores quarterly and document the result** — an untested backup is a hypothesis. Offline immutable copies that ransomware cannot reach. Geographic separation. A defined RPO/RTO for the registry, agreed with the Ministry. **Full disaster-recovery exercise annually.** In-country replication is additionally required under the amended PDPO if the registry is designated CII.

### 8.7 Control maturity: current vs target

```mermaid
xychart-beta
    title "Security control maturity (0 = absent, 5 = mature) — current vs 12-month target"
    x-axis ["Edge/WAF", "Headers/CSP", "IAM/MFA", "Authorization", "Audit trail", "Env separation", "Secrets mgmt", "Vuln disclosure", "Privacy compliance", "DR/backup", "SecSDLC", "Monitoring"]
    y-axis "Maturity" 0 --> 5
    line [4, 2, 3, 2, 2, 1, 2, 1, 1, 2, 1, 2]
    bar [5, 5, 5, 5, 5, 5, 4, 4, 5, 4, 4, 4]
```

*The line is the current estimate; the bars are the recommended 12-month target. Current values for internal controls are **[Inferred]** from external signals and must be re-baselined from inside.*

### 8.8 What a proper security programme looks like here

```mermaid
flowchart TD
    GOV["Governance:<br/>Ministry-level security ownership + DPO"] --> BASE["Published Platform Security Baseline<br/>(contractually binding on vendors)"]
    BASE --> BUILD["Secure SDLC:<br/>threat modelling · SAST/DAST/SCA in CI ·<br/>peer review · SBOM"]
    BUILD --> TEST["Independent assessment before every go-live"]
    TEST --> RUN["Runtime: WAF · rate limits ·<br/>anomaly detection · centralised SIEM"]
    RUN --> DETECT["24/7 monitoring + CIRT escalation"]
    DETECT --> IR["Incident response:<br/>documented, rehearsed, legally aligned"]
    IR --> LEARN["Post-incident review →<br/>baseline update"]
    LEARN --> BASE
    VDP["Public VDP + safe harbour"] --> DETECT
    AUDIT["Annual independent audit + DPIA"] --> GOV

    style GOV fill:#1a5632,color:#fff
    style VDP fill:#c9a227,color:#000
```

**The organisational point matters more than any single control.** Most findings above are not hard engineering problems — they are consequences of having no single accountable owner for security across a multi-vendor programme. Fix the governance and the technical findings become routine maintenance; leave the governance unfixed and they will recur with every new vendor and every new module.

---

## Part G — Implementation Roadmap

### 9.1 Sequenced plan

```mermaid
gantt
    title Land services modernisation and hardening roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %Y

    section Phase 0 — Stop the bleeding (0–3 months)
    Publish current security.txt + VDP + safe harbour :crit, p0a, 2026-09-01, 21d
    Uniform security headers at edge (all subdomains)  :crit, p0b, 2026-09-01, 30d
    Remove staging hosts from production config        :crit, p0c, 2026-09-10, 30d
    Replace wildcard CORS with allow-list              :p0d, 2026-09-10, 21d
    Appoint DPO + start PDPO gap assessment            :crit, p0e, 2026-09-01, 60d
    Plain-language status labels + reason codes        :p0f, 2026-09-15, 45d
    Payment reconciliation job + recheck button        :p0g, 2026-09-15, 45d
    Asset inventory + domain audit                     :p0h, 2026-09-01, 45d

    section Phase 1 — Baseline (3–9 months)
    Platform Security Baseline (contractual)           :crit, p1a, 2026-12-01, 90d
    Authorised penetration test (authz focus)          :crit, p1b, 2026-12-01, 60d
    MFA rollout for all official accounts              :crit, p1c, 2026-12-15, 90d
    Append-only audit ledger                           :p1d, 2027-01-01, 120d
    Owner notification on mutation filing              :crit, p1e, 2026-12-01, 75d
    Unified SSO across all citizen portals             :p1f, 2027-01-15, 120d
    Secrets vault + rotation                           :p1g, 2027-01-01, 90d
    DR test + immutable backups                        :p1h, 2027-02-01, 90d
    Performance budget + light mode                    :p1i, 2026-12-01, 90d

    section Phase 2 — Experience (9–18 months)
    Backend-for-Frontend + my-land dashboard           :p2a, 2027-06-01, 150d
    Shared design system + Bangla content standards    :p2b, 2027-06-01, 120d
    Search-first / map-pin land selection              :p2c, 2027-08-01, 120d
    Passkeys + step-up authentication                  :p2d, 2027-07-01, 120d
    UDC operator console + offline drafts              :p2e, 2027-09-01, 120d
    WCAG 2.2 AA conformance                            :p2f, 2027-07-01, 150d
    Public SLA + grievance analytics dashboards        :p2g, 2027-06-01, 90d

    section Phase 3 — Structural (18–36 months)
    Deed registry to mutation event feed               :crit, p3a, 2028-01-01, 270d
    Parcel lineage model (CS/SA/RS/BS)                 :p3b, 2028-01-01, 300d
    Documented public API + open data                  :p3c, 2028-03-01, 180d
    CII designation + compliance programme             :p3d, 2028-01-01, 180d
    Digital signatures on orders and khatians          :p3e, 2028-04-01, 180d
```

### 9.2 Phase 0 detail — the 90-day list

Nothing here requires new procurement, new architecture, or a new project. All of it is configuration, content, or policy.

| # | Action | Owner | Effort | Impact |
|---|---|---|---|---|
| 1 | Publish a current `security.txt` + VDP with safe harbour on every land subdomain | Project + Ministry | 1 week | 🔴 High |
| 2 | Apply the uniform security-header policy at Cloudflare/Kong | Platform team | 2–4 weeks | 🔴 High |
| 3 | Put `map.land.gov.bd` behind the same WAF as the rest | Platform team | 1 week | 🔴 High |
| 4 | Purge staging hostnames from production config; add a CI guard | All vendors | 2–4 weeks | 🔴 High |
| 5 | Replace `ACAO: *` with an explicit origin allow-list | Vendors | 2 weeks | 🟠 Medium |
| 6 | Appoint and publish a DPO; begin the PDPO gap assessment | Ministry | 4–8 weeks | 🔴 High |
| 7 | Rewrite privacy policies to PDPO standard, in Bangla and English | Ministry + legal | 6 weeks | 🔴 High |
| 8 | Rewrite every citizen-facing status string in plain Bangla with actor + expected date | Content + product | 4 weeks | 🔴 High |
| 9 | Introduce structured rejection reason codes with remedies | Product + vendors | 6 weeks | 🟠 Medium |
| 10 | Daily payment reconciliation + citizen "recheck status" button | Payments team | 6 weeks | 🟠 Medium |
| 11 | Client-side image compression before upload | Frontend | 2 weeks | 🟠 Medium |
| 12 | Complete asset/domain inventory; decommission orphaned subdomains | Platform team | 4 weeks | 🟠 Medium |
| 13 | Enable MFA for all administrative accounts (hardware keys preferred) | IT | 6 weeks | 🔴 High |
| 14 | Verify a full restore of the registry from backup and document it | Infrastructure | 4 weeks | 🔴 High |

### 9.3 Success metrics

| Domain | Metric | 12-month target |
|---|---|---|
| Security | Subdomains meeting the header baseline | 100% |
| Security | Non-production hosts referenced from production | 0 |
| Security | Median time to acknowledge a disclosure report | ≤ 72 hours |
| Security | Official accounts with phishing-resistant MFA | 100% |
| Security | Verified restore tests completed | ≥ 4 per year |
| Privacy | Systems with a current PDPO-compliant policy and DPIA | 100% |
| Reliability | Portal availability during statutory deadline windows | ≥ 99.9% |
| Reliability | Payments debited without a receipt within 24h | < 0.1% |
| Experience | Applications completed without an intermediary | +40 pp |
| Experience | First-attempt submission acceptance | ≥ 85% |
| Experience | 16122 contacts per 1,000 applications | −50% |
| Service | Mutations closed within the 28-working-day SLA | ≥ 90% |

---

## Appendices

### A. Glossary

| Bangla | Transliteration | English |
|---|---|---|
| ভূমি মন্ত্রণালয় | Bhumi Montronaloy | Ministry of Land |
| নামজারি | Namjari | Mutation — transfer of title in the record |
| জমাভাগ | Jomabhag | Sub-division of a holding |
| জমা একত্রীকরণ | Jomo Ekotrikoron | Consolidation of holdings |
| খারিজ | Kharij | Colloquial term for mutation |
| খতিয়ান | Khatian | Record of rights |
| পর্চা | Porcha | Copy of the khatian |
| দাগ | Dag | Surveyed plot / parcel number |
| মৌজা | Mouza | Revenue village — smallest map unit |
| জে.এল. নম্বর | JL Number | Jurisdiction List number identifying a mouza |
| হোল্ডিং | Holding | Tax account unit |
| দাখিলা | Dakhila | Land development tax receipt |
| ভূমি উন্নয়ন কর | Bhumi Unnayan Kor | Land development tax |
| খাজনা | Khajna | Colloquial term for land tax |
| ডি.সি.আর. | DCR | Duplicate Carbon Receipt — mutation fee receipt |
| হিস্যা | Hissa | Fractional ownership share |
| ওয়ারিশ সনদ | Warish Sonod | Inheritance/succession certificate |
| সহকারী কমিশনার (ভূমি) | AC Land | Assistant Commissioner (Land) — approving authority |
| ইউনিয়ন ভূমি সহকারী কর্মকর্তা | ULAO / Tahsildar | Union Land Assistant Officer — field verification |
| কানুনগো | Kanungo | Revenue/survey supervisory officer |
| সার্ভেয়ার | Surveyor | Measurement officer |
| শুনানি | Shunani | Hearing |
| সি.এস. / এস.এ. / আর.এস. / বি.এস. | CS / SA / RS / BS | Successive cadastral survey generations |
| অভিযোগ প্রতিকার ব্যবস্থা | GRS | Grievance Redress System |
| ইউনিয়ন ডিজিটাল সেন্টার | UDC | Union Digital Centre — assisted service point |

### B. Technical evidence log

All observations from public HTTP responses and page content on 18–19 August 2026.

| Host | Observation | Interpretation |
|---|---|---|
| `www.land.gov.bd` | `x-powered-by: Next.js`, `/_next/image`, `vary: rsc, next-router-state-tree` | Next.js App Router with SSR |
| `www.land.gov.bd` | `server: cloudflare`, `cf-ray`, `cf-cache-status: DYNAMIC` | Cloudflare edge |
| `www.land.gov.bd` | `strict-transport-security: max-age=15552000; includeSubDomains; preload` | HSTS at 180 days |
| `lsg-portal-admin.land.gov.bd` | `/storage/...` asset paths | Laravel-based admin/CMS |
| `mutation.land.gov.bd` | `via: kong/3.6.1`, `x-kong-upstream-latency`, `x-kong-request-id` | Kong API gateway |
| `mutation.land.gov.bd` | Encrypted `XSRF-TOKEN` + `_session`, `samesite=strict`, `httponly` | Laravel session handling |
| `mutation.land.gov.bd` | CSP enumerating ~15 backend hosts | Microservice topology, self-disclosed |
| `mutation.land.gov.bd` | `script-src ... 'unsafe-inline' 'unsafe-eval'` | Weakened CSP |
| `mutation.land.gov.bd` | `access-control-allow-origin: *` | Wildcard CORS |
| `map.land.gov.bd` | No CF headers, no HSTS, no CSP, no XFO, no nosniff | Weakest observed posture |
| `map.land.gov.bd` | `SERVER=citizen2` cookie, `x-request-id` | Backend node name disclosed |
| `map.land.gov.bd` | `csrf-token` meta, Laravel encrypted session | Laravel Blade application |
| `hotline.land.gov.bd` | `sessionid` cookie, `/static/` paths, `vary: origin, Cookie` | Django application |
| `hotline.land.gov.bd` | Duplicate `x-frame-options: DENY` and `SAMEORIGIN` | Conflicting configuration |
| `hotline.land.gov.bd` | Restrictive `permissions-policy`, `referrer-policy: same-origin` | Best header profile observed |
| `office-idp.land.gov.bd` | `/auth/realms/lsg/protocol/openid-connect/auth?response_type=code&…` | Keycloak, OIDC auth-code flow |
| `office-idp.land.gov.bd` | `client_id=lsg-…-live-20260412` | Date-stamped client rotation |
| `ldtax.gov.bd` | HTTP 403 to non-browser user agent | Active bot protection |
| `www.land.gov.bd/.well-known/security.txt` | `Expires: 2025-10-31`; vendor personal email | Expired disclosure policy |

### C. Primary sources

**Official portals**
- Ministry of Land information portal — https://www.land.gov.bd/
- Citizen benefits (Bangla) — https://land.gov.bd/nagorik-subidha?lang=bn
- Project outputs — https://www.land.gov.bd/proklpo-output
- e-Mutation — https://mutation.land.gov.bd/
- Land Development Tax — https://ldtax.gov.bd/
- LDTax user manual — https://traininglims.land.gov.bd/limslrb/ldtax/citizen/user_manual
- Smart Bhumi Naksha — https://map.land.gov.bd/
- Smart Bhumi Naksha privacy policy — https://map.land.gov.bd/land-zoning/privacy-policy
- Land Service Hotline 16122 — https://hotline.land.gov.bd/
- Manuals — https://www.land.gov.bd/manual
- Service fee schedule — https://www.land.gov.bd/vumisheba-fee
- Grievance redress — https://portal-citizen.land.gov.bd/login

**Legal and regulatory**
- Personal Data Protection Ordinance 2025 (promulgated 6 Nov 2025)
- Personal Data Protection (Amendment) Ordinance 2026 (5 Feb 2026)
- Cyber Security Ordinance 2025 (gazetted 21 May 2025)
- National Data Governance Ordinance 2025
- BGD e-GOV CIRT; National Cyber Security Agency

**Standards referenced**
- OWASP Application Security Verification Standard (ASVS)
- OWASP API Security Top 10
- RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure (`security.txt`)
- NIST SP 800-63B — Digital Identity Guidelines (authentication assurance)
- WCAG 2.2 Level AA
- ISO/IEC 27001 — Information Security Management

### D. Limitations of this review

1. **External perspective only.** No internal code, infrastructure, database, or configuration was examined. Items marked **[Inferred]** are engineering hypotheses requiring internal confirmation.
2. **No testing was performed.** The absence of a finding is not evidence of security. Conversely, findings in Part F are *indicators* warranting investigation, not confirmed exploitable vulnerabilities.
3. **Point-in-time snapshot.** Headers and configuration observed 18–19 August 2026 may already have changed.
4. **Fees, SLAs and procedures change by circular.** All figures cited must be verified against current official sources before operational use.
5. **JavaScript-rendered content was not fully enumerated.** Single-page applications (mutation, LDTax) return minimal server-rendered HTML, so functional coverage of those portals is based on documentation and public reporting rather than direct inspection.
6. **Not a legal opinion.** The PDPO and Cyber Security Ordinance analysis is a technologist's reading and should be reviewed by qualified counsel in Bangladesh.

---

## Closing note

The Bangladesh land services ecosystem has the components of a genuinely modern platform: an API gateway, a central identity provider, discrete services, an event broker, a payment abstraction, and national geospatial coverage. That is more than many comparable programmes achieve.

The weaknesses are **not architectural — they are organisational.** Inconsistent headers, staging hosts in production, an expired disclosure contact, and divergent UI conventions all trace back to the same cause: several vendors building in parallel without a single enforced baseline and a single accountable owner.

That is encouraging, because organisational problems are cheaper to fix than architectural ones. The Phase 0 list in §9.2 requires no new procurement and no new architecture, and it would measurably improve both the security posture and the citizen experience within a single quarter.

The deeper prize is structural. As long as a citizen must personally carry paper from the deed registry to the land office, the state has outsourced its own integration problem to the people it serves — and that gap is exactly where intermediaries and fraud live. **Closing it is the work that would matter most.**

---

*Prepared as an independent technical review from publicly available information. All security findings are provided for defensive purposes to the system owner. No testing, scanning, or unauthorised access was performed at any point.*
