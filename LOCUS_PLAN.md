# Locus — Enterprise Google Maps Intelligence Platform
## Comprehensive Development Plan

**Developer:** Cloudz Computing | [www.cloudzcomputing.com](https://www.cloudzcomputing.com)
**Development Environment:** AI-Assisted Engineering (Claude / OpenCode + gstack)
**Document Version:** v2.0 — Rebranded Edition
**Architecture Target:** Production-Ready, Enterprise SaaS Standard
**Primary Markets:** B2B Lead Generation, Digital Marketing, Sales Intelligence — India & Global
**Core Data Points:** Business Name, Phone Numbers, Email Addresses, Location, Social Media
**Benchmark Platforms:** Clay, PhantomBuster, Outscraper, Apollo.io, Apify

---

## Section 1: Executive Overview & Vision

Locus is an enterprise-grade, AI-powered Google Maps data extraction and lead enrichment platform. It enables businesses, marketers, and sales teams to extract structured business intelligence — names, phone numbers, email addresses, and locations — directly from Google Maps, then enrich this raw data through a multi-stage AI pipeline into fully qualified B2B leads.

Built on a modern React + Next.js + Tailwind CSS frontend paired with a Node.js/Python extraction engine powered by Playwright headless browsers, residential proxy rotation, and an AI enrichment waterfall, Locus is designed to meet and exceed the standard set by Clay, Outscraper, and PhantomBuster — built for the Indian B2B market with global expansion capability.

### 1.1 Strategic Vision

- Transform raw Google Maps geographic data into fully enriched, sales-ready B2B leads
- Automate the complete pipeline: Scrape → Parse → Enrich → Export → CRM Push
- Support granular regional targeting across Indian cities and states
- Deliver a distinctive, premium UI/UX experience — not a templated default look
- Provide real-time progress visibility with live metrics and pipeline status tracking
- Enable bulk export in CSV, Excel, and JSON with one-click CRM integration

### 1.2 Target User Segments

| User Segment | Primary Use Case |
|---|---|
| B2B Sales Teams | Generate qualified leads for outbound prospecting and cold outreach |
| Digital Marketing Agencies | Build geo-targeted business lists for local SEO and ad campaigns |
| Market Research Firms | Extract comprehensive business datasets for competitive analysis |
| Real Estate & Finance | Find local businesses, professionals, and service providers at scale |
| Legal & Consulting Firms | Identify potential clients in specific industries and regions |
| Cloudz Computing (Internal) | Power lead generation for Cloudz Computing's own client-facing AI services |

---

## Section 2: Technical Architecture Blueprint

Locus is architected as a full-stack, cloud-native application. Every layer is purpose-built to handle enterprise-scale data extraction while maintaining stealth, speed, and accuracy.

### 2.1 Complete Technology Stack

| Layer | Technology & Rationale |
|---|---|
| Frontend Framework | React 18 + Next.js 14 (App Router) — SSR, performance, and SEO-ready |
| Styling System | Tailwind CSS 3.4 + CSS Variables — utility-first, dark-mode, responsive |
| UI Component Library | shadcn/ui + Radix UI primitives — accessible, composable components |
| State Management | Zustand (global) + React Query (server state) + React Hook Form |
| Iconography | Lucide React — consistent, lightweight icon set |
| Typography | Chosen deliberately per the Locus design system (see Section 3) — not a generic default pairing |
| Backend Runtime | Node.js 20 LTS + Express 5 — API server and orchestration layer |
| Web Scraping Engine | Playwright + Chromium (headless) — full DOM rendering, infinite scroll |
| Python Utilities | Python 3.12 + BeautifulSoup4 — HTML parsing and data cleaning |
| Database | PostgreSQL 16 (primary) + Redis 7 (caching + job queue) |
| Job Queue | BullMQ + Redis — async scrape job management with retry logic |
| Proxy Management | Residential proxy provider API — large IP pool, auto-rotation |
| AI Enrichment | Anthropic Claude API — email extraction, classification |
| Authentication | NextAuth.js v5 — JWT + OAuth2 (Google, GitHub) + API key management |
| File Export | Papa Parse (CSV) + ExcelJS (XLSX) + JSON streaming |
| Deployment | Vercel (frontend) + Railway/Render (backend) + Supabase (managed PG) |
| Monitoring | Sentry (error tracking) + PostHog (analytics) + Uptime Robot |
| Version Control | Git + GitHub — feature branching, CI/CD with GitHub Actions |

### 2.2 System Architecture Diagram (Textual)

**Locus Data Flow Architecture**

- **USER INPUT:** Keyword + Location + Radius → Command Center → Job Queue (BullMQ/Redis)
- **LAYER 1 — BROWSER ENGINE:** Playwright + Chromium → Google Maps DOM → Infinite Scroll Parser
- **LAYER 2 — PROXY ROTATION:** Residential Proxies → Anti-bot Mitigation → CAPTCHA Handler
- **LAYER 3 — DATA PARSER:** HTML/JSON Extractor → Business Name, Phone, Location, Website URL
- **LAYER 4 — AI ENRICHMENT:** Domain Crawler → Email Regex ML → Contact Page Parser → Claude API Validation
- **LAYER 5 — ENRICHMENT WATERFALL:** Hunter.io API → Clearbit API → Snov.io → LinkedIn Scraper → Fallback
- **LAYER 6 — DATA STORE:** PostgreSQL (leads) + Redis (cache) → Normalized Schema
- **LAYER 7 — OUTPUT:** CSV / XLSX / JSON Export | Webhook Push | CRM Integration (HubSpot, Salesforce)
- **FRONTEND:** React Dashboard → Real-time WebSocket Updates → Live Metrics Counter → History Panel

### 2.3 Database Schema Design

| Table | Key Fields |
|---|---|
| scrape_sessions | id, user_id, query, location, radius, status, started_at, completed_at, total_yield |
| business_leads | id, session_id, name, phone, email, email_verified, location, lat, lng, website, category |
| enrichment_log | id, lead_id, source, result_status, email_found, enriched_at, api_cost_credits |
| users | id, name, email, plan_type, credits_remaining, api_key, created_at |
| proxy_sessions | id, session_id, proxy_ip, provider, success_rate, requests_made, blocked_count |
| export_history | id, user_id, session_id, format (CSV/XLSX/JSON), file_size, downloaded_at |

---

## Section 3: Premium Design System — Distinctive, Not Default

**This is the most important departure from a generic AI-built SaaS look.** Locus must not read as a templated dark-mode dashboard with a default blue/indigo accent — the exact pattern most AI-assisted builds converge on by default. The design must be deliberately chosen for Locus specifically, not inherited from a generic component library default.

### 3.1 Design Principles to Follow

- **No default gradient-everywhere treatment.** Reserve any gradient or bold color treatment for one signature element — the logo, a single hero moment, or one key interaction — not every headline on every page.
- **A real color palette, chosen for Locus.** Define 4–6 named colors that reflect the product's identity (a geographic intelligence / data-extraction tool) rather than reaching for the generic dark-navy-plus-blue-accent combination every AI tool defaults to. Consider palettes grounded in the subject matter itself — mapping, geographic data, signal/precision — rather than a generic "premium SaaS" blue.
- **Deliberate typography pairing.** Choose a display face and a body face that are paired specifically for Locus's identity, not the first safe Google Fonts combination. A distinct type treatment should feel like part of the brand, not a neutral container for text.
- **Visual hierarchy over repetition.** Feature cards, pricing tiers, and dashboard panels should not all look identical. The most important information (recommended plan, primary metric, signature feature) should visually stand out from supporting content.
- **One signature element.** The design should have a single memorable visual moment — a distinctive data visualization, an interactive map element, a unique way of presenting the extraction pipeline — that makes Locus recognizable and not interchangeable with any other AI-generated SaaS dashboard.
- **Restraint elsewhere.** Spend boldness in one place; keep everything else disciplined, consistent, and easy to scan.

### 3.2 Component Architecture — 5 Core Modules

The application is composed of five primary UI modules, each purpose-built for a specific workflow stage:

**Module 1: Global Command Sidebar & Header**
- Persistent left sidebar with logo, navigation, and user profile card
- Navigation sections: Workspace (Dashboard, Active Scrapes, History) and Intelligence (AI Enrichment, Integrations, Analytics)
- System section: API Keys, Proxy Management, Settings
- Real-time "Active Scrapes" badge counter updated via WebSocket
- Top header with global AI-powered search bar (Cmd+K shortcut activation)
- Search bar autocomplete: suggests Google Maps categories and regional keywords (e.g., "Lead Generation Companies in Hyderabad")
- Status pill showing live proxy network health and connection status

**Module 2: Stats Dashboard Row**
- Four KPI cards: Total Leads Scraped, Emails Verified, Phone Numbers Extracted, Active Scrape Sessions
- Each card designed with clear visual hierarchy and a large, legible metric number
- Animated number counters on page load
- Subtle hover interaction feedback

**Module 3: Extraction Command Center**
- Primary keyword input: accepts natural language (e.g., "Software Agencies in Hyderabad")
- Location field with Google Places Autocomplete integration for verified addresses
- Radius selector: 5km, 10km, 25km, 50km, 100km, Unlimited
- Advanced Configuration panel (toggled): Concurrency (4/8/16/32 threads), Proxy Type, AI Enrichment Depth, Max Results, Language/Locale, JS Render Delay
- Credit cost estimator: real-time calculation shown as user adjusts parameters
- "Start Extraction" primary CTA that clearly communicates state changes (idle → running)
- "Save Config" button: persist frequently used query templates for one-click re-use

**Module 4: High-Fidelity Progress Indicator**
- Displayed only when a scrape is active — slides into view with smooth animation
- 5-stage pipeline visualization: Initializing Proxies → Navigating Maps DOM → Parsing Listings → Email/Phone Enrichment → Formatting Dataset
- Each stage shown clearly: idle, active (in progress), done
- Animated progress bar with clear completion state
- Real-time ETA counter updated dynamically based on record yield rate
- Live metrics row: Locations Found, Phones Extracted, Emails Verified, Fully Enriched — all counting up in real-time via WebSocket
- "Abort Mission" button: gracefully stops scrape and saves partial results
- Error recovery: if CAPTCHA detected, shows "Retry with Premium Proxies" inline option

**Module 5: Enterprise Data Table**
- 7 columns: Select (checkbox), Business Name (with avatar initials), Location (pin icon), Phone Number (monospace), Email Address (monospace), Status Badge, Actions
- Sticky table header with sorting on all columns (ascending/descending toggle)
- Clear row hover feedback
- Status badges: Verified, Enrich (clickable, triggers enrichment), Pending, Failed — each visually distinct
- In-table enrichment: clicking "Enrich" badge triggers background API call; badge animates through "Enriching..." to "Verified"
- Bulk actions: select all rows, then Export Selected / Push to CRM / Delete
- Table toolbar: filter by text search, filter chips (All, Verified, Needs Enrich), result count, Export menu
- Export menu: CSV, Excel (XLSX), JSON, Push to CRM (HubSpot/Salesforce webhook)
- Pagination: 25/50/100 rows per page, page number buttons, total record count
- Empty state: a designed empty state with call-to-action to start extraction
- New rows animate in as they're added during live scrape

**Module 6: History & Audit Panel**
- Right-panel sidebar showing all past scrape sessions in chronological order
- Each history card: Query name, Date/Time, Total Yield (leads + emails), Status indicator
- Action buttons per card: Download CSV (direct), Re-run (loads exact config to Command Center), View Details
- Configuration snapshots: exact parameters saved per session (keyword, location, radius, proxy type, AI depth)
- Full History view: paginated table with advanced filtering by date range, status, yield
- Failed session handling: "Retry with Premium Proxies" button, detailed error log expandable

---

## Section 4: Complete Feature Specifications

### 4.1 Data Extraction Engine — Technical Specs

| Feature | Implementation Detail |
|---|---|
| Headless Browser | Playwright with Chromium — full JavaScript rendering, cookie persistence, realistic viewport |
| Infinite Scroll | Automated scroll height tracking — stops when no new DOM elements detected after 3 consecutive scrolls |
| Pagination Bypass | Bypasses Google Maps 120-result default limit — extracts up to 500 results per keyword |
| Business Profile Depth | Clicks into each business profile to extract hours, reviews, rating, category, website URL |
| Phone Extraction | Regex pattern matching for Indian (+91) and international formats; validates format |
| Email Extraction | Domain crawler visits business website → scans contact pages → ML regex → Claude API validation |
| Proxy Rotation | Per-request IP rotation from residential proxy pool — auto-retire on CAPTCHA/timeout |
| CAPTCHA Handling | Automated CAPTCHA solving with graceful fallback (wait + retry) |
| Browser Fingerprinting | Randomized user agents, canvas fingerprints, hardware concurrency, WebGL parameters |
| Rate Limiting | Configurable delay between requests (500ms to 5000ms) — "Stealth Mode" mimics human browsing |
| Error Recovery | Automatic retry with 3 attempts per URL; exponential backoff; partial result saving |
| Concurrency | Up to 32 parallel browser instances (Enterprise tier) — managed via BullMQ worker pool |

### 4.2 AI Enrichment Waterfall Pipeline

The enrichment waterfall sequentially tries multiple sources to find verified emails — the core differentiator from basic scrapers:

1. Extract website URL from Google Maps business profile
2. Crawl business website — scan /contact, /about, /team pages for email addresses
3. Apply ML regex model to identify email patterns in page HTML
4. Validate found emails via SMTP verification (check MX record, inbox exists)
5. (Fallback) Query Hunter.io API with domain name
6. (Fallback) Query Clearbit Enrichment API with domain
7. (Fallback) Query Snov.io with business name + location
8. If all fail, flag as "Needs Manual Enrich" with LinkedIn profile URL if found
9. Claude API validates and classifies email type (generic vs. decision-maker)

### 4.3 Search & Discovery Intelligence

- Global search bar (Cmd+K): instant fuzzy search across all past scrapes, leads, and configurations
- AI autocomplete: suggests query completions based on industry categories and geography
- Saved searches: bookmark frequent queries for instant re-launch
- Natural language input: "Find all CA firms within 20km of Hyderabad" → parsed into API parameters
- Bulk search: upload CSV of multiple keywords/locations — scrape all in one queued job
- Geo-fence targeting: draw radius on embedded map to define custom extraction area

### 4.4 History, Audit, and Session Management

- Complete audit trail: every scrape session logged with parameters, timestamps, yield metrics, error log
- Configuration snapshots: duplicate any past run with one click ("Re-run" button)
- Session comparison: side-by-side comparison of two sessions to analyze yield differences
- Failed session recovery: "Retry with Premium Proxies" option on any failed run
- Data versioning: if the same business appears in multiple scrapes, system deduplicates and tracks changes over time
- Export history: all previous exports logged with filename, size, date, and download link

---

## Section 5: Development Phases & Timeline

The project is structured into sequential development phases, each producing testable, deployable output.

| Phase | Scope & Deliverables | Est. Duration |
|---|---|---|
| Phase 0 — Project Init | Initialize Next.js 14 project, configure Tailwind CSS, install dependencies, set up Git, configure ESLint + Prettier, establish folder structure | 1 day |
| Phase 1 — Design System | Implement CSS variables, typography scale, color tokens (per Section 3's distinctive design principles), global layout (sidebar + topbar + content), responsive grid, dark mode base, animation utilities | 2 days |
| Phase 2 — Command Center UI | Build search bar + global search, KPI stats row, extraction configuration form, advanced panel toggle, credit estimator, Start button states | 2 days |
| Phase 3 — Progress Indicator | Pipeline steps component, animated progress bar, WebSocket integration, real-time metrics counters, ETA calculator, Abort Mission handler | 2 days |
| Phase 4 — Data Table | Full enterprise table with 7 columns, sort/filter/search, status badges, in-table enrichment action, pagination, bulk select, empty state | 3 days |
| Phase 5 — History Panel | History card list, configuration snapshots, re-run functionality, full history page with filters, failed session recovery, export log | 2 days |
| Phase 6 — Backend Engine | Node.js API server, Playwright scraper integration, BullMQ job queue, PostgreSQL schema, Redis caching, proxy rotation logic | 5 days |
| Phase 7 — AI Enrichment | Enrichment waterfall pipeline, Claude API integration, Hunter.io/Clearbit API connectors, SMTP email validator, email classification model | 4 days |
| Phase 8 — Auth & Billing | NextAuth.js authentication, user dashboard, credit system, plan tiers, Razorpay/Stripe payment integration | 3 days |
| Phase 9 — Export & Integrations | CSV/XLSX/JSON export engine, HubSpot/Salesforce CRM webhooks, Zapier integration, API key management for external access | 2 days |
| Phase 10 — Polish & Deploy | Performance optimization, mobile responsiveness, Sentry monitoring, Vercel + Railway deployment, domain setup, final QA testing | 2 days |

---

## Section 6: Project Folder Structure

```
locus/
├── app/                         (Next.js App Router)
│   ├── (auth)/login/            (Login/Register pages)
│   ├── dashboard/               (Main dashboard page)
│   ├── history/                 (Full history page)
│   ├── settings/                (User settings page)
│   └── api/                     (Next.js API routes)
│       ├── scrape/              (POST: initiate scrape job)
│       ├── jobs/[id]/           (GET: job status via WebSocket)
│       ├── export/              (POST: generate export file)
│       └── enrich/[id]/         (POST: trigger enrichment for lead)
├── components/                  (All React components)
│   ├── layout/                  (Sidebar, Topbar, Shell)
│   ├── dashboard/                (StatsRow, CommandCenter, ProgressIndicator)
│   ├── table/                   (DataTable, TableRow, StatusBadge, Pagination)
│   ├── history/                 (HistoryPanel, HistoryCard, SessionDetails)
│   ├── search/                  (GlobalSearch, SearchSuggestions, SavedSearches)
│   └── ui/                      (Button, Card, Modal, Toast, Badge — design system)
├── lib/                         (Utility functions and API clients)
│   ├── scraper/                 (Playwright engine, scroll logic, parser)
│   ├── enrichment/               (Waterfall pipeline, email validator, Claude API)
│   ├── proxy/                   (Residential proxy integration, rotation, health check)
│   ├── db/                      (PostgreSQL client, schema, migrations)
│   ├── queue/                   (BullMQ job definitions, worker pool)
│   └── export/                  (CSV/XLSX/JSON generators)
├── stores/                      (Zustand global state stores)
├── hooks/                       (Custom React hooks: useScrape, useWebSocket, etc.)
├── styles/                      (Global CSS, Tailwind config, design tokens)
└── tests/                       (Jest unit tests + Playwright E2E tests)
```

---

## Section 7: API Endpoint Reference

| Endpoint | Method | Description |
|---|---|---|
| /api/scrape | POST | Initiates a new scrape job — accepts keyword, location, radius, config options |
| /api/jobs/:id | GET | Returns current job status (IDLE/SCRAPING/ENRICHING/COMPLETED/FAILED) |
| /api/jobs/:id/live | WebSocket | Real-time streaming of extracted records as they are found |
| /api/leads | GET | Paginated list of all extracted leads with filter/sort params |
| /api/leads/:id | GET | Single lead record with full enrichment history |
| /api/enrich/:id | POST | Trigger enrichment waterfall for a specific lead |
| /api/export | POST | Generate and return CSV/XLSX/JSON file for specified session |
| /api/history | GET | List of all scrape sessions with metadata |
| /api/history/:id | GET | Full detail of a specific scrape session including config snapshot |
| /api/history/:id/rerun | POST | Clone a past session's config and start a new scrape |
| /api/users/me | GET | Current user profile, credits remaining, plan tier |
| /api/webhooks/crm | POST | Push leads to CRM (HubSpot/Salesforce) via webhook |

---

## Section 8: Quality Assurance & Legal Compliance

### 8.1 Quality Standards

- Lighthouse Performance Score: 90+ on all pages
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Accessibility: WCAG 2.1 AA compliant — ARIA labels, keyboard navigation, focus management
- Mobile Responsive: fully functional at 375px (iPhone SE) through 2560px (4K)
- TypeScript: 100% typed components, strict mode enabled — zero `any` types
- Test Coverage: 80%+ unit test coverage; critical path E2E tests via Playwright
- Bundle Size: code-split by route; main bundle < 150KB gzipped
- API Response Time: < 200ms for all non-scrape endpoints; scrape status < 50ms

### 8.2 Legal & Ethical Framework

- Locus operates using publicly available data from Google Maps (analogous to Outscraper, Apify, Bright Data use cases)
- Mandatory rate limiting and request delays to minimize server impact
- Users accept Terms of Service confirming they will use data for legitimate business purposes
- GDPR / PDPB (India) compliance: data retention policy, user data deletion, consent logging
- Robots.txt compliance notifications: inform users if target site's robots.txt restricts scraping
- No personal data resale: platform prohibits reselling scraped data in ToS
- CAPTCHA solving disclosed: transparent communication about automated browser usage

---

## Section 9: Business Model & Pricing Architecture

| Plan | Price (INR/month) | Credits | Key Features |
|---|---|---|---|
| Starter | ₹999/month | 500 credits | Basic scraping, 100 leads/run, CSV export, email support |
| Professional | ₹3,499/month | 2,500 credits | AI enrichment, 500 leads/run, all export formats, priority proxies |
| Business | ₹8,999/month | 8,000 credits | 32-thread concurrency, CRM integration, API access, dedicated proxies |
| Enterprise | Custom Pricing | Unlimited | White-label option, on-premise deployment, SLA, dedicated account manager |
| Pay-as-you-go | ₹2 per credit | Top-up | Available for all plans — credits never expire |

### 9.1 Credit Consumption Model

- 1 credit = 1 business listing extracted with basic data (name, phone, location)
- 2 credits = 1 listing with website URL and category included
- 5 credits = 1 listing with full AI email enrichment attempted
- 10 credits = 1 listing with deep enrichment (LinkedIn, social media, decision maker)
- 0.5 credits per re-run of enrichment waterfall on existing lead
- 0 credits = export, history viewing, dashboard access, API status checks

---

## Section 10: Success Metrics & KPIs

| Metric | Target (Month 6) | Measurement Method |
|---|---|---|
| Monthly Active Users (MAU) | 500+ MAU | PostHog analytics dashboard |
| Monthly Recurring Revenue (MRR) | ₹5 Lakhs+ | Stripe/Razorpay revenue reporting |
| Lead Extraction Volume | 500,000+ leads/month platform-wide | PostgreSQL aggregate query |
| Email Match Rate | 65%+ of extracted leads have verified email | enrichment_log table analysis |
| Scrape Success Rate | 94%+ jobs complete without failure | scrape_sessions status aggregate |
| Average Session Yield | 300+ leads per scrape session | scrape_sessions yield average |
| User Retention (Month 2) | 60%+ users return for second month | PostHog cohort analysis |
| Net Promoter Score (NPS) | 50+ | In-app NPS survey (monthly) |
| P95 API Response Time | < 300ms for all data endpoints | Sentry performance monitoring |
| CAPTCHA Block Rate | < 3% of requests blocked | proxy_sessions blocked_count aggregate |

---

## Conclusion

Locus represents the fusion of enterprise-grade technical infrastructure with a distinctive, premium design identity. By implementing every element of this plan — the AI enrichment waterfall, the real-time pipeline progress UI, the comprehensive history audit system, and the intelligent Cmd+K search interface, all wrapped in a design that is unmistakably Locus's own rather than a generic AI-tool default — the platform is built to genuinely compete with market leaders like Clay, PhantomBuster, Outscraper, and Apify.

For Cloudz Computing, Locus represents both a standalone SaaS product and a foundational data intelligence layer that can power the company's other client-facing AI services. The business data it extracts becomes the fuel for downstream automation, outreach, and enrichment work across the Cloudz Computing portfolio.

### Locus — Final Checklist for Completion

- [ ] Business Name, Phone, Email, Location extraction — all four data points fully implemented
- [ ] Real-time 5-stage pipeline progress indicator with live metrics counters
- [ ] Enterprise data table: 7 columns, sort, filter, bulk actions, in-table enrichment
- [ ] Global AI search bar with Cmd+K shortcut and intelligent autocomplete
- [ ] History panel: full audit trail, config snapshots, re-run, failed session recovery
- [ ] AI enrichment waterfall: multi-step pipeline with Claude API validation
- [ ] Export: CSV, XLSX, JSON, CRM push (HubSpot, Salesforce)
- [ ] Residential proxy rotation with CAPTCHA handling and browser fingerprinting
- [ ] Authentication, credit system, and tiered billing (Starter to Enterprise)
- [ ] PostgreSQL + Redis + BullMQ backend for production-scale job management
- [ ] Fully responsive, WCAG 2.1 AA accessible, TypeScript-typed codebase
- [ ] A genuinely distinctive design system — not a generic dark-mode-plus-blue-accent template
- [ ] Deployed on Vercel + Railway with Sentry monitoring and PostHog analytics

---

**Prepared for Cloudz Computing**
[www.cloudzcomputing.com](https://www.cloudzcomputing.com)
