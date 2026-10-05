# 🇧🇩 Bangladesh Digital Land Management & Cadastral Automation Platform
### গণপ্রজাতন্ত্রী বাংলাদেশ সরকার — ভূমি সেবা ও অটোমেশন পোর্টাল (DLRS & AC Land Portal)

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB.svg)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Backend-Express%20%7C%20Node.js%20%7C%20TypeScript-339933.svg)](https://nodejs.org/)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma-2D3748.svg)](https://www.prisma.io/)
[![PostGIS](https://img.shields.io/badge/Spatial%20DB-PostgreSQL%2015%20%2B%20PostGIS-336791.svg)](https://postgis.net/)
[![n8n Automation](https://img.shields.io/badge/Workflows-n8n%20CDC%20%26%20Webhooks-FF6D5A.svg)](https://n8n.io/)

---

## 📖 Executive Summary

The **Bangladesh Digital Land Management & Cadastral Automation Platform** is an enterprise-grade, geospatial-first digital governance solution designed to modernize land administration across Bangladesh. It integrates **PostGIS spatial geometry layers (EPSG:4326 / WGS84)**, **Prisma ORM relational schemas**, **n8n automated event-driven workflows**, and a **Nova Full-Screen React Dashboard** with minimal **Anek Bangla** typography.

---

## 🏛️ System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Citizen & Revenue Officers)"]
        UI["React 18 + Vite SPA<br/>(Full-Screen Nova Night & Light Themes)"]
        BanglaTypo["Anek Bangla Minimal Typography"]
        CanvasGIS["Interactive Geospatial Vector Canvas"]
        UI --> BanglaTypo
        UI --> CanvasGIS
    end

    subgraph APILayer ["Backend API Gateway (:5000)"]
        Express["Express.js REST Service"]
        Prisma["Prisma ORM Client"]
        Express --> Prisma
    end

    subgraph StorageLayer ["Spatial & Relational Database (:5433)"]
        Postgres[("PostgreSQL 15")]
        PostGIS["PostGIS Spatial Engine<br/>(WGS84 EPSG:4326 Vector Layers)"]
        Postgres --- PostGIS
    end

    subgraph AutomationLayer ["Event-Driven Automation Engine (:5678)"]
        n8n["n8n Workflow Engine"]
        Webhook["Webhook Ingress Endpoints"]
        CDC["PostgreSQL Spatial CDC Listener"]
        SMS["Citizen SMS & Notification Radar"]
        n8n --> Webhook
        n8n --> CDC
        n8n --> SMS
    end

    subgraph ExternalGovServices ["Authoritative External Services"]
        eParcha["e-Parcha Khatiyan Service"]
        DLRS["DLRS Drone Cadastral Vector Map"]
        SubRegistry["Sub-Registry Deed Vault"]
        PayGateway["bKash / Nagad / Ekpay Gateway"]
    end

    UI <-->|JSON REST & Proxied API| Express
    Prisma <-->|SQL & Geometry Queries| Postgres
    Express <-->|Trigger Workflows| Webhook
    CDC <-->|Change Data Capture| Postgres
    Express <-->|Cross-Audit Synchronization| ExternalGovServices
    PayGateway <-->|IPN Webhook Settlement| Webhook
```

---

## 🔄 Core Workflows & Logic Flows

### 1. Multi-Source Cadastral Cross-Audit & Reconciliation

```mermaid
graph TD
    Start([Initiate Cross-Audit]) --> FetchSources[Gather Record Sources for UPID]
    FetchSources --> S1[e-Parcha Digital Khatiyan]
    FetchSources --> S2[DLRS Drone Vector Cadastre]
    FetchSources --> S3[Sub-Registry Registered Deed]
    FetchSources --> S4[Upazila Holding Register]

    S1 & S2 & S3 & S4 --> ReconEngine{Cross-Audit Matching Engine}

    ReconEngine -->|Ownership Name & NID Check| Match1[Ownership: 100% Match]
    ReconEngine -->|Dag & Plot Alignment| Match2[Dag No: 1204 Exact Match]
    ReconEngine -->|Polygon Area vs Deed Area| Match3{Area Variance <= 0.05 Dec?}

    Match3 -->|Yes: Variance Acceptable| FlagLow[Status: Flag Low Severity Variance]
    Match3 -->|No: Boundary Encroachment| FlagHigh[Status: High Risk Overlap Discrepancy]

    FlagLow & FlagHigh --> AuditLog[(Update Discrepancy Table in PostGIS)]
    AuditLog --> NotifyOfficer[Dispatch Warning to AC Land Portal]
```

---

### 2. e-Mutation (ই-নামজারি) 4-Stage Judicial Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Citizen Submits Application with Deed & NID
    SUBMITTED --> KANUNGO_VERIFICATION: Automated Assignment to Union Land Assistant Officer (ULAO)
    
    state KANUNGO_VERIFICATION {
        [*] --> SpotInspection: Physical Land Verification
        SpotInspection --> MouzaMapVerification: RS / BS Sheet Comparison
        MouzaMapVerification --> ReportGenerated: Submission of Field Report
    }

    KANUNGO_VERIFICATION --> AC_LAND_HEARING: File Forwarded to Assistant Commissioner (Land)
    
    state AC_LAND_HEARING {
        [*] --> HearingNotice: SMS Notice Sent to All Co-sharers
        HearingNotice --> JudicialSession: Objection Settlement
        JudicialSession --> OrderPassed: Mutation Approval Order Signed
    }

    AC_LAND_HEARING --> DCR_PAYMENT_PENDING: Generation of Duplicate Carbon Receipt (DCR) Fee (1,150 BDT)
    DCR_PAYMENT_PENDING --> APPROVED: Payment Settled via Digital Gateway
    APPROVED --> NewKhatianGenerated: Automated Creation of Certified New Khatian
    NewKhatianGenerated --> [*]
```

---

### 3. LD Tax Payment & Cryptographic e-Dakhila Generation

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen / Land Owner
    participant Web as Web Portal (:5173)
    participant API as Backend API (:5000)
    participant DB as PostGIS DB (:5433)
    participant n8n as n8n Engine (:5678)
    participant Gateway as Payment Gateway (bKash/Nagad/Ekpay)

    Citizen->>Web: Select Pending Fiscal Year Tax (e.g. 2026-2027)
    Web->>API: POST /api/payments/pay-tax
    API->>Gateway: Initiate Gateway Checkout (Total Due BDT)
    Gateway-->>API: Transaction Success (TrxID: BKASH_89201948)
    API->>DB: Update TaxRecord (status='VERIFIED', dakhilaNumber='DAK-2026-849102')
    API->>n8n: Dispatch Webhook (/webhook/payment-reconciled)
    n8n->>Citizen: Dispatch Confirmation SMS to Registered Phone
    API-->>Web: Return Verified TaxRecord & Digital Dakhila Metadata
    Web->>Citizen: Render Printable Official Government Dakhila with Verified QR Code
```

---

## 🗄️ Database Entity-Relationship Diagram

```mermaid
erDiagram
    PARCEL ||--o{ TAX_RECORD : assesses
    PARCEL ||--o{ MUTATION : tracks
    PARCEL ||--o{ TIMELINE_EVENT : logs
    PARCEL ||--o{ DISCREPANCY : audits
    PARCEL ||--o{ DOCUMENT : vaults
    PARCEL ||--o{ COMPLAINT : registers

    PARCEL {
        string id PK "UPID (e.g. BD-DHK-SAV-000001)"
        string division
        string district
        string upazila
        string mouza
        int jlNumber
        string khatianNo
        string dagNo
        string holdingNo
        string landClass
        float areaDecimal
        string currentOwner
        string nidNumber
        string phone
        string email
        json geojsonBoundary "PostGIS Vector Polygon"
    }

    TAX_RECORD {
        string id PK
        string parcelId FK
        string fiscalYear
        float annualDemandBDT
        float arrearAmountBDT
        float totalDueBDT
        float paidAmountBDT
        string status "PENDING | VERIFIED | RECONCILED"
        string trxId
        string paymentMethod
        string dakhilaNumber
        string qrCodeUrl
        datetime paymentDate
    }

    MUTATION {
        string id PK
        string parcelId FK
        string caseNumber "e.g. MUT-SAV-2026-0891"
        string applicantName
        string applicantNid
        string applicantPhone
        string proposedOwner
        string status "SUBMITTED | KANUNGO_VERIFICATION | AC_LAND_HEARING | APPROVED"
        string currentStage
        datetime hearingDate
        float dcrAmount "1150 BDT"
        string remarks
    }

    TIMELINE_EVENT {
        string id PK
        string parcelId FK
        string eventType
        string title
        string description
        string actor
        string referenceDoc
        datetime eventDate
    }

    DISCREPANCY {
        string id PK
        string parcelId FK
        string mismatchType
        string sourceA
        string sourceB
        string severity "LOW | MEDIUM | HIGH"
        boolean isResolved
        string flaggedBy
    }

    DOCUMENT {
        string id PK
        string parcelId FK
        string docType
        string fileName
        string fileUrl
        string ocrText
    }

    COMPLAINT {
        string id PK
        string parcelId FK
        string trackingNo
        string complainant
        string phone
        string category
        string description
        string assignedOffice
        string status
    }
```

---

## 🚀 Interactive Portal Modules

| # | Module Name | Bengali Term | Description |
|---|---|---|---|
| **1** | **Overview & Title** | *মালিকানা ও খতিয়ান বিবরণ* | Displays certified owner particulars, NID, verified phone, ownership deed basis, and automated metric conversions (Decimals, Sq Ft, Katha). |
| **2** | **Cadastral GIS Map** | *ডিএলআরএস জিআইএস নকশা* | Renders interactive vector spatial boundaries over WGS84 coordinates with drone survey overlays and adjacent plot boundaries. |
| **3** | **Data Cross-Audit** | *বহুস্তরীয় সমম্বয় অডিট* | Automated 4-way consistency audit checking e-Parcha, DLRS GIS, Sub-Registry deeds, and Upazila registers. |
| **4** | **e-Mutation Tracker** | *ই-নামজারি ট্র্যাকার* | Tracks AC (Land) court hearing milestones, case logs, and handles digital application filing with legal DCR calculation. |
| **5** | **LD Tax & Dakhila** | *ভূমি কর ও ই-দাখিলা* | Calculates annual and arrear tax demands, simulates multi-gateway payments, and issues official printable digital Dakhilas with QR codes. |
| **6** | **Automation Hub** | *অটোমেশন পাইপলাইন* | Monitors 7 active background automations, n8n webhook ingress listeners, and real-time CDC telemetry streams. |

---

## 📡 REST API Reference

### Health Check
- **`GET /api/health`**  
  Returns system connectivity, database engine status, and timestamp.

### Cadastral Holdings
- **`GET /api/parcels`**  
  Retrieves a summary list of all cadastral parcels in the database.
- **`GET /api/parcels/:parcelId`**  
  Retrieves full parcel entity including tax records, active mutations, historical timeline events, discrepancies, and vaulted documents.

### Land Development Tax
- **`POST /api/payments/pay-tax`**  
  Settles pending tax demand and issues a cryptographically verifiable Dakhila.  
  ```json
  {
    "parcelId": "BD-DHK-SAV-000001",
    "fiscalYear": "2026-2027",
    "amount": 1250.0,
    "paymentMethod": "bKash Digital Gateway",
    "trxId": "BKASH_89201948"
  }
  ```

### e-Mutation Application
- **`POST /api/mutations`**  
  Registers a new mutation case with automated AC Land assignment.  
  ```json
  {
    "parcelId": "BD-DHK-SAV-000001",
    "applicantName": "Md. Tariqul Islam",
    "applicantNid": "19902691234567890",
    "applicantPhone": "+880 1819-123456",
    "proposedOwner": "Md. Tariqul Islam & Co.",
    "dcrAmount": 1150.0,
    "remarks": "Online application with deed metadata attached."
  }
  ```

### Automated Spatial Reconciliation
- **`POST /api/reconciliation/run`**  
  Dispatches an automated multi-source audit across e-Parcha and PostGIS layers.

---

## 💻 Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone -b demo https://github.com/pbs002-s/n8n-land-automation.git
cd n8n-land-automation
```

### 2. Start PostgreSQL + PostGIS via Docker
```bash
docker-compose up -d
```
> Database container `bd_land_postgis` will initialize on port `5433:5432`.

### 3. Initialize & Seed Database
```bash
cd backend
npm install
npx prisma db push
npm run prisma:seed
```

### 4. Start Backend API Server
```bash
npm run dev
```
> Server running at: `http://localhost:5000`

### 5. Start Frontend Dashboard
```bash
cd ../frontend
npm install
npm run dev
```
> Web Dashboard running at: `http://localhost:5173`

---

## 🎨 UI/UX Design System

- **Full-Screen Night Mood**: Deep `#030303` canvas with `#18181B` translucent glass cards (`backdrop-blur-xl`), `#27272A` borders, and `#34D399` emerald accents.
- **Geospatial Background Animation**: Floating HTML5 geodetic benchmark canvas reflecting coordinates across Bangladesh's 64 districts with sovereign emerald and crimson aura.
- **Minimalist Bengali Typography**: Clean `Anek Bangla` typography with lightweight font settings (`font-light` / `300-400`) and refined letter-spacing.
- **Micro-Animations**: Shimmer text headers (`shimmer-text`), live telemetry marquees, and smooth entrance transitions (`animate-fade-in-up`).

---

## 🛡️ Security & Privacy

- Sensitive credentials and environment variables are excluded via `.gitignore`.
- Citzen NID and phone numbers are encrypted in transit.
- Digital Dakhilas feature cryptographically unique identifiers and QR verification strings.

---

## 📜 License
Released under the [MIT License](LICENSE). Built for the digitalization of land governance in Bangladesh.
