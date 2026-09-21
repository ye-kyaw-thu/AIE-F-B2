# Myanmar Logistics Tracking System

A web-based logistics management system for managing **shipments, routes, drivers, and users** with role-based access.

## Features

* **Admin**

  * Manage users
  * Create and manage routes
  * Assign drivers to routes
  * Open/close routes
  * Monitor shipments

* **Trader**

  * Create shipments
  * Select available routes
  * Track shipment status
  * View alerts and documents

* **Driver**

  * View assigned shipments
  * View assigned routes
  * Update shipment status

## Shipment Status

`Requested` → `Picked Up` → `In Transit` → `Checkpoint` → `Delivered`

Additional statuses include `Delayed` and `Customs`.

## Tech Stack

* React
* Vite
* JavaScript
* CSS
* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Edge Functions

## Project Structure

```text
logistics-frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/
│   ├── App.jsx
│   ├── App.css
│   └── index.css
├── supabase/
│   └── functions/
│       └── create-user/
├── package.json
└── README.md
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run the application

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

## Security

* Supabase Authentication handles user login.
* Role-based access controls the dashboards.
* User creation uses a Supabase Edge Function.
* The Supabase Service Role Key is never exposed in the frontend.

## Group 4 Members

* Aung Khant Myat
* Htoo Eaindra Tin
* Kyawt Kyawt Zin
* Kaung Myat Kyaw
* Min Khant Kyaw
* Myint Thu Soe
* Myo Thet
* Soe Thandar Tint
* Thida Aye
* Thant Sin Tun
* Wai Yan Htet Aung

---

