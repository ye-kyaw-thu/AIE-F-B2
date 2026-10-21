# ASSIGNMENT: Rapid Prototype for Myanmar Logistics & Tracking System

**Deadline:** 18 Sept 2026   
**Team Size:** 4 Groups (~11 Members per group)  
**Deliverable:** Live Prototype Demo & 30-Minute Presentation on 20 Sept 2026 (SAT)   

## The Background

Given the current complexities of logistics and import/export in Myanmar, moving goods is more challenging than ever. Border gates can close unexpectedly, checkpoints are frequent, and communication between drivers, traders, and logistics managers is often chaotic.  

Your challenge is to build a highly localized, robust tracking system prototype, a "Real-Time Logistics Monitoring for Myanmar Trading", that solves these exact pain points.  

## The Objective

Using **"LLM-based coding / Vibe Coding"**, your group will rapidly design, generate, and deploy a working prototype of a logistics tracking system. You will not be writing every line of code from scratch; instead, you will architect the system, write effective prompts, manage AI outputs, and integrate the components into a cohesive application.  

## Core Feature Requirements

Your prototype must demonstrate the following functionalities:  

1. **Role-Based Access Control (RBAC):**  

* **Admin:** Oversees all shipments, manages border gate statuses, and broadcasts alerts.
* **Trader (User):** Submits transport requests, tracks their specific cargo, and receives real-time gate/delay alerts.
* **Driver (Simulated Mobile View):** Updates location, uploads document photos, and reports status (e.g., "Arrived at Checkpoint").

2. **The Tracking Dashboard:**

* Visual timeline of the shipment (e.g., *Picked Up → In Transit → Customs → Delivered*).
* Simulated live GPS mapping of the truck.

3. **Myanmar-Specific Logistics Features:**

* **Gate/Route Status Control:** Admin panel to toggle the status of major routes (e.g., Muse, Myawaddy) which instantly alerts affected traders.
* **Offline Capabilities:** Propose or simulate how the driver app caches data during internet blackouts.

## Methodology: "Vibe Coding"

You have about 17 days. Traditional manual coding will be too slow. You are expected to use AI engineering tools (ChatGPT, Claude, Cursor, GitHub Copilot, etc.) to accelerate development.  

* Focus on system architecture, database schema design, and prompt engineering. 
* Use fast-deployment frameworks and Backend-as-a-Service (e.g., React/Next.js, Tailwind, Firebase/Supabase).  
* Debug and stitch together AI-generated code efficiently.  

## Managing Your 11-Member Team

With 11 members, coordination is your biggest risk. You must divide and conquer. Suggested roles:  

* **Product Manager (1-2):** Defines the exact shipment flow, keeps the team on schedule, and ensures the UI makes sense for the Myanmar market.
* **Lead AI Coders - Frontend (2-3):** Uses AI to generate the web dashboards and UI components.
* **Lead AI Coders - Backend (2-3):** Uses AI to set up the database, authentication, and API endpoints.
* **QA / Integrators (2):** Tests the code, finds bugs, and asks the AI to fix them. Ensures the frontend actually talks to the backend.
* **Presenters / Pitch Deck (2):** Prepares the final presentation, maps out the live demo flow, and creates the slide deck.

## Final Presentation (30 Minutes Per Group)

On presentation day, your group will have exactly 30 minutes to showcase your work. Your presentation must include:  

1. **The Problem & Solution (5 mins):** Briefly explain your specific approach to the Myanmar logistics problem.  
2. **Live Demo (15 mins):** Walk us through a shipment lifecycle. Log in as an Admin, a Trader, and a Driver. Show us a simulated gate closure and how the system reacts.  
3. **AI Engineering Reflection (10 mins):** Tell the class *how* you built it. What AI tools did you use? What prompts worked best? What were the biggest failures or hallucinations the AI produced, and how did you fix them?  

*Good luck. Build something that matters.*  
