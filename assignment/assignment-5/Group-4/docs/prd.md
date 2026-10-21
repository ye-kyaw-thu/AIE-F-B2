# Real-Time Logistics Monitoring for Myanmar Trading

Course: AIE-F B2 — Assignment 5

Prototype Deadline: 18 September 2026

Live Demo: 20 September 2026

Version: 1.0 (15.9.2026)

---

## 1. Product Overview

This is a web-based logistics monitoring system designed for transportation and trading activities in Myanmar.

The system allows:

- Traders to create and monitor shipments.

- Drivers to update shipment status and location.

- Administrators to monitor all shipments, manage route conditions, and broadcast alerts.

The system focuses on problems that can occur during transportation in Myanmar, including:

- Difficulties knowing the current location of a vehicle.
- Delays during transportation.
- Route or border-gate closures.
- Poor communication between traders and drivers.
- Internet connectivity problems.
- Difficulty monitoring multiple shipments at the same time.
- The prototype will use simulated GPS locations rather than real vehicle GPS hardware.

---

## 2. Product Vision

**To provide a simple, real-time logistics monitoring system that helps Myanmar traders, drivers, and administrators understand where shipments are, what is happening to them, and whether route problems may cause delays.**

---

## 3. Problem Statement

- During transportation, traders may not always have an easy way to know:
- Where their shipment currently is.
- Whether the driver has reached an important location.
- Whether a shipment is delayed.
- Whether a major route has been closed.
- Whether a route problem affects their shipment.
- Whether a driver has successfully reported an update.

Drivers may also face:

- Poor internet connectivity.
- Difficulty communicating updates.
- Delays at checkpoints.
- Route disruptions.

Administrators need a centralized view of:
- Active shipments.
- Shipment locations.
- Route conditions.
- Delays.
- Important alerts.

---

## 4. Proposed Solution

This provides three role-based interfaces:

**Admin**

Monitors and manages the entire logistics system.

**Trader**

Creates shipments and monitors their own shipments.

**Driver**

Updates shipment progress, location, and documents.

- The system also provides:
- Shipment timeline
- Simulated GPS tracking
- Myanmar map
- Route status
- Route closure alerts
- Real-time updates
- Offline update simulation
- Document/photo upload

---

## 5. Target Users

**5.1 Admin**

The person responsible for monitoring and managing logistics activities.

**5.2 Trader**

A person or business sending goods from one location to another.

**5.3 Driver**

The person transporting the shipment.

---

## 6. User Roles and Permissions

| Feature | Admin | Trader | Driver |
| :--- | :---: | :---: | :---: |
| **View all shipments** | Yes | No | No |
| **View own shipments** | Yes | Yes | Assigned only |
| **Create shipment** | Yes | Yes | No |
| **Update shipment status** | Yes | No | Yes |
| **Update location** | Yes | No | Yes |
| **View map** | Yes | Yes | Yes |
| **Manage routes** | Yes | No | No |
| **Close/open route** | Yes | No | No |
| **Receive alerts** | Yes | Yes | Yes |
| **Upload documents** | Yes | No | Yes |
| **Offline updates** | No | No | Yes |

---

## 7. Authentication

Users must log in before accessing the system.

After login, the system identifies the user's role and redirects them to the appropriate dashboard.

Example:
```
Login
   ↓
Check user role
   ↓
Admin   → Admin Dashboard
Trader  → Trader Dashboard
Driver  → Driver Dashboard
```

---

## 8. Role-Based Access Control

The system must enforce permissions based on user roles.

Users must not be able to access functions that belong to another role simply by manually entering a URL.

For example:

- A Trader must not access the Admin route-management page.

- A Driver must not close a route.

- A Trader must not modify another trader's shipment.

- An Admin can view all shipments.

---

## 9. Admin Dashboard

The Admin Dashboard provides an overview of the entire logistics system.

**Dashboard information**

- The Admin should be able to see:
- Total shipments
- Active shipments
- Delayed shipments
- Delivered shipments
- Closed routes
- Recent alerts
- Current vehicle locations

### Main sections

**Shipment Overview**

- Displays shipment status and information.

**Live Map**

- Displays simulated truck locations.

**Route Management**

- Allows Admin to open or close routes.

**Alerts**

- Displays important system alerts.

---

## 10. Trader Dashboard

The Trader Dashboard allows traders to manage and monitor their own shipments.

The Trader can:

- Create a shipment.
- View shipment list.
- View shipment details.
- View shipment timeline.
- View truck location.
- Receive route alerts.
- Receive delay alerts.

---

## 11. Driver Dashboard

The Driver Dashboard is designed to be simple because drivers may use mobile phones and may have unreliable internet connectivity.

The Driver can:

- View assigned shipment.
- View destination.
- Update shipment status.
- Update simulated location.
- Report checkpoint arrival.
- Upload document/photo.
- Work in simulated offline mode.
- Synchronize pending updates when connection returns.

---

## 12. Shipment

A shipment represents goods being transported from an origin to a destination.

Each shipment should contain:

- Tracking number
- Trader
- Driver
- Origin
- Destination
- Route
- Cargo description
- Current status
- Current latitude
- Current longitude
- Created date
- Updated date

```python
# Example

Tracking Number: MYT-2026-001
Cargo: Agricultural products
Origin: Yangon
Destination: Muse
Driver: Aung Aung
Route: Yangon → Mandalay → Lashio → Muse
Status: In Transit
```

---


## 13. Shipment Statuses

The system should use simple shipment stages.

### 13.1 Requested
```
The trader has created a shipment request.
Meaning: ကုန်ပစ္စည်း ပို့ဆောင်ရန် တောင်းဆိုထားသည်။
```

### 13.2 Picked Up
```
The driver has collected the goods.
Meaning: ကားသမားက ကုန်ပစ္စည်းကို လက်ခံယူပြီးဖြစ်သည်။
```

### 13.3 In Transit
```
The shipment is currently being transported.

Meaning: ကုန်ပစ္စည်းသည် လမ်းပေါ်တွင် ပို့ဆောင်နေသည်။
```

### 13.4 Checkpoint
```
The driver has reached a designated checkpoint.

Meaning: ကားသည် စစ်ဆေးရေးနေရာသို့ ရောက်ရှိနေသည်။
```

### 13.5 Delayed
```
The shipment is experiencing a delay.

Meaning: ပို့ဆောင်မှုတွင် နောက်ကျမှု ဖြစ်နေသည်။
```

### 13.6 Customs — Conditional
```
Customs should NOT be required for every shipment.
This stage is used only when the shipment involves an international border/trade process.
For example, a shipment traveling toward a border crossing may enter a customs-related stage when appropriate.
Meaning: အကောက်ခွန်နှင့် သက်ဆိုင်သော စစ်ဆေးမှုများ ပြုလုပ်နေသည်။
For a purely domestic shipment, this stage is skipped.
```

### 13.7 Delivered
```
The shipment has reached its destination.
Meaning: ကုန်ပစ္စည်းကို သတ်မှတ်ထားသော နေရာသို့ ပို့ဆောင်ပြီးဖြစ်သည်။
```

### 14. Shipment Flow
```python
# For a normal domestic shipment

Requested
    ↓
Picked Up
    ↓
In Transit
    ↓
Checkpoint
    ↓
In Transit
    ↓
Delivered
```

```python
# If a problem occurs

In Transit
    ↓
Delayed
    ↓
In Transit
```
```python
# For a shipment involving an international border:

Requested
    ↓
Picked Up
    ↓
In Transit
    ↓
Checkpoint
    ↓
Customs
    ↓
In Transit
    ↓
Delivered
```

Therefore, Customs is an optional stage, not a mandatory stage.

---

### 15. Shipment Timeline

Each shipment should display a visual timeline.

```python
Example:

✓ Shipment Requested
       ↓
✓ Goods Picked Up
       ↓
✓ In Transit
       ↓
✓ Checkpoint Reached
       ↓
● In Transit
       ↓
○ Delivered
```

The timeline should show:
- Status
- Time
- Location
- Optional description

---

## 16. GPS Tracking

The prototype will simulate vehicle location.

A real GPS device is NOT required.

The Driver can select predefined locations.
```
Example route:
Yangon
   ↓
Mandalay
   ↓
Lashio
   ↓
Muse
```
The Driver can press: ```Update Location```

The system updates:

- Latitude
- Longitude
- Current location

The Admin and Trader can see the updated position.

---

## 17. Myanmar Map

The system will display a Myanmar map using:
```
Leaflet
OpenStreetMap
```

The map will show:

- Shipment location
- Truck marker
- Route information

The project does not need to create its own Myanmar map.

---

## 18. Simulated GPS

Because this is a prototype, GPS movement will be simulated.
```
Location 1 → Yangon
Location 2 → Mandalay
Location 3 → Lashio
Location 4 → Muse
```

When the Driver clicks Update Location, the truck marker moves to the next predefined location.
This demonstrates the concept of real-time tracking without requiring physical GPS hardware.

---

## 19. Real-Time Updates

The system should use real-time communication so that users do not need to refresh the page manually.
```python
Driver
   ↓
Updates location
   ↓
Database
   ↓
Real-time update
   ↓
Admin Dashboard
Trader Dashboard
```

The same approach is used for alerts.

---

## 20. Route Management

Admins can manage important transportation routes.

Each route has:

- Route name
- Starting location
- Destination
- Current status
- Description
- Last updated time

Possible route statuses:
- OPEN
- CLOSED

---

## 21. Myanmar-Specific Routes

The prototype will demonstrate important Myanmar transportation routes.
```
Route 1
Yangon → Mandalay → Lashio → Muse

Route 2
Yangon → Bago → Naypyidaw → Myawaddy
```

These are used primarily for demonstration purposes.

The system should not claim that these routes represent all real-world logistics routes or current operating conditions.

---

## 22. Route Closure

An Admin can change a route from:
```python
OPEN
to:
CLOSED

# Example

Muse Route → CLOSED

The system then identifies active shipments associated with that route.
```

---

## 23. Automatic Alerts

When a route is closed, affected users receive an alert.
```
Example:
Muse လမ်းကြောင်း ပိတ်ထားပါသည်။ သင်၏ကုန်ပစ္စည်း ပို့ဆောင်မှု နောက်ကျနိုင်ပါသည်။

The alert may be sent to:
- Trader
- Driver
- Admin
```

## 24. Alert Severity

Alerts can have different levels.

**Normal**: General information.

**Warning**: Possible delay or route problem.

**High**: Important disruption requiring attention.
```
Example:
HIGH

Muse လမ်းကြောင်း ပိတ်ထားပါသည်။
သင်၏ပို့ဆောင်မှု နောက်ကျနိုင်ပါသည်။
```

---

## 25. Offline Capability

The Driver may lose internet connectivity during transportation.

The prototype will simulate this situation.

When the Driver is offline:
```python
Internet unavailable
       ↓
Driver updates status
       ↓
Update stored locally
       ↓
Pending update created

# When the connection returns:
Internet restored
       ↓
Pending updates synchronized
       ↓
Database updated
```

---


## 26. Offline User Interface

The Driver should see a clear indicator.
Example:
```
🔴 Offline
Pending updates: 2
```
```
After reconnection:
🟢 Online
2 updates synchronized
```

---

## 27. Document Upload

Drivers can upload photos related to a shipment.

- Delivery document
- Cargo document
- Checkpoint document
- Other relevant photo

The prototype will use cloud storage.

The system stores:
- File name
- File location
- Shipment
- Driver
- Document type
- Upload time

---

## 28. Database

The prototype will use ```Supabase``` ```PostgreSQL```.

Main tables:
- profiles
- routes
- shipments
- shipment_events
- alerts
- documents

---

## 29. Profiles Table

Stores user information.

Fields:
- id
- name
- email
- role
- created_at

Possible roles:
- ADMIN
- TRADER
- DRIVER

---

## 30. Routes Table

Stores transportation routes.

Fields:
- id
- name
- origin
- destination
- status
- description
- updated_at

---

## 31. Shipments Table

Stores shipment information.

Fields:
- id
- tracking_number
- trader_id
- driver_id
- route_id
- cargo_description
- origin
- destination
- status
- latitude
- longitude
- created_at
- updated_at

---

## 32. Shipment Events Table

Stores shipment history.

Fields:
- id
- shipment_id
- status
- description
- latitude
- longitude
- created_by
- created_at

This table allows the system to build the shipment timeline.

---

## 33. Alerts Table

Stores notifications.
Fields:
- id
- route_id
- shipment_id
- recipient_id
- message
- severity
- is_read
- created_at

---

## 34. Documents Table

Stores uploaded document information.

Fields:
- id
- shipment_id
- driver_id
- file_name
- file_url
- document_type
- created_at

---

## 35. Security Requirements

The system must protect user access.

Requirements:

- Authentication required.
- Role-based permissions.
- Users can only access authorized data.
- Traders can only manage their own shipments.
- Drivers can only update assigned shipments.
- Only Admins can manage route status.
- Only authorized users can upload documents.

---

## 36. Realtime Architecture

The system will use Supabase Realtime.

Important real-time events:

**GPS update**
```
Driver changes location
        ↓
Database updated
        ↓
Admin/Trader map updates
```

**Route closure**
```
Admin closes route
        ↓
Affected shipments identified
        ↓
Alerts created
        ↓
Trader/Driver receives alert
```

---

## 37. Main Application Pages
```
Public
/login

Admin
/admin
/admin/shipments
/admin/routes
/admin/alerts

Trader
/trader
/trader/shipments
/trader/shipments/[id]
/trader/request

Driver
/driver
/driver/shipment
/driver/documents
```

---

## 38. Main UI Components

```
Reusable components should include:
Navbar
Sidebar
ShipmentCard
ShipmentTimeline
TrackingMap
RouteStatus
AlertCard
OfflineIndicator
StatusBadge
```
---

## 39. User Experience Requirements

The system should be:

- Simple
- Easy to understand
- Mobile-friendly
- Fast/Clear
- Suitable for users with limited technical knowledge
- 
The Driver interface should be especially simple.

**Important actions should be large and easy to identify.**

---

## 40. Main Trader Journey
```
Login
 ↓
Trader Dashboard
 ↓
Create Shipment
 ↓
Shipment Created
 ↓
View Shipment
 ↓
View Timeline
 ↓
View Truck Location
 ↓
Receive Route Alert
 ↓
Monitor Shipment
 ↓
Delivered
```

---

## 41. Main Driver Journey
```
Login
 ↓
Driver Dashboard
 ↓
View Assigned Shipment
 ↓
Pick Up Goods
 ↓
Start Transportation
 ↓
Update Location
 ↓
Reach Checkpoint
 ↓
Update Status
 ↓
Upload Document
 ↓
Continue Transportation
 ↓
Delivered
```

---

## 42. Main Admin Journey
```
Login
 ↓
Admin Dashboard
 ↓
View All Shipments
 ↓
View Map
 ↓
Monitor Routes
 ↓
Close Muse Route
 ↓
System Identifies Affected Shipments
 ↓
Alerts Generated
 ↓
Trader/Driver Receives Alert
```

---

## 43. Critical Live Demo Scenario

The main demonstration will use one shipment.

**Shipment**

```python
Tracking Number:
MYT-2026-001
```

**Cargo:**

```python
Agricultural products
```

Origin:
```python
Yangon
```

Destination:
```python
Muse
```

Driver:
```python
Aung Aung
```

#### Step 1 — Trader creates shipment

Trader creates:
```python
Yangon → Muse
```

Shipment status:
```python
Requested
```

#### Step 2 — Driver receives shipment

Driver accepts/starts the shipment.

Status:
```python
Picked Up
```

#### Step 3 — Driver starts transportation

Status:
```python
In Transit
```

#### Step 4 — Driver updates GPS

Driver moves the simulated truck:

```python
Yangon
 ↓
Mandalay
 ↓
Lashio
```

Trader sees the truck moving on the map.

#### Step 5 — Admin closes route

Admin changes:
```python
Muse Route
OPEN → CLOSED
```

#### Step 6 — System generates alert

The affected shipment receives:
```python
Muse လမ်းကြောင်း ပိတ်ထားပါသည်။ သင်၏ကုန်ပစ္စည်း ပို့ဆောင်မှု နောက်ကျနိုင်ပါသည်။
```

#### Step 7 — Driver goes offline

Driver switches the prototype into offline mode.

```python
Driver updates:
Checkpoint ရောက်ရှိ
```

The update is stored locally.

#### Step 8 — Driver reconnects

Driver switches back online.

```python
The pending update synchronizes with the database.
```

#### Step 9 — Shipment continues

Status returns to:
```python
In Transit
```

#### Step 10 — Delivery

Driver reaches the destination.
```python
Status:
Delivered
```


