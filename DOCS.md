# HA Reporting Dashboard - Technical Documentation

## Executive Overview
The **HA Reporting Dashboard** is a high-performance telemetry visualization system designed for mission-critical infrastructure monitoring. It provides a unified interface for real-time observability across multi-cloud and on-premise clusters, integrating directly with Zabbix and other enterprise monitoring protocols.

---

## Core Functionality

### 1. Observability Modes
*   **LIVE MODE**: Real-time telemetry streaming with rolling windows (1h, 6h, 24h, 7d). Data is refreshed every 5 seconds (simulated) or via Zabbix API polling.
*   **HISTORICAL MODE**: Post-mortem analysis and audit mode. Allows users to select specific date ranges and granularities (5m, 1h, 1d) for forensic performance review.

### 2. Main Dashboards
*   **Executive Overview (Custom Dashboards)**: A flexible grid-based layout where users can construct personalized views.
    *   **KPI Cards**: High-density scalar values with trend indicators.
    *   **Trend Charts**: Time-series visualization (Area, Line, Bar, Pie) with multi-series support.
*   **Network Topology**: A visual graph representing infrastructure connectivity, link loads, and security perimeter status.
*   **Infrastructure Inventory**: A comprehensive asset management view showing hardware specifications, compute loads, and operational statuses.
*   **Event Log**: A centralized trigger stream with severity classification (Low, Medium, High) and manual intervention controls (Acknowledge).

---

## Technical Architecture

### Component Architecture
*   **Frontend**: React 18+ with Vite for ultra-fast HMR and build performance.
*   **Styling**: Tailwind CSS for a utility-first, modern "Aero-Technical" aesthetic.
*   **Animations**: Framer Motion for smooth transitions, staggered entrances, and micro-interactions.
*   **Charts**: Recharts for responsive, SVG-based data visualization.
*   **Icons**: Lucide React for consistent, high-quality iconography.

### Data Flow
1.  **Telemetry Sync**: `App.tsx` manages the primary state machine, coordinating between `view` modes, `filters`, and `widgets`.
2.  **Persistence**: Dashboard configurations are persisted in `localStorage`, allowing for persistent user workspaces without a complex backend during the evaluation phase.
3.  **Zabbix Integration**: A dedicated API proxy endpoint handles authentication and requests to Zabbix RPC, converting them into standardized internal telemetry formats.

---

## Configuration & Customization

### Configuring Zabbix
1.  Navigate to the **Settings** menu.
2.  Enter your Zabbix API Endpoint URL and Auth Token.
3.  Click **Save Configuration**. The system will automatically perform asset discovery and populate host/metric dropdowns.

### Widget Construction
1.  In "My Dashboard", click **+ KPI** or **+ CHART**.
2.  Hover over the new widget and click the **Gear Icon** (Settings).
3.  In the **Module Constructor**:
    *   Set the **Branding Label**.
    *   Choose **Viz Mode** (Area, Line, etc.).
    *   Select **Target Host Groups** and **Metric Streams**.
    *   Configure **Aggregation** (Sum, Avg, None).
4.  Click **Save**.
5.  Reposition or resize widgets using the drag handles and move controls.

---

## Responsiveness
The dashboard is fully optimized for all form factors:
*   **Desktop**: Full sidebar navigation and dense 12-column grid.
*   **Tablet**: Reflowing 6-column grid and condensed headers.
*   **Mobile**: Collapsible hamburger menu, stacked telemetry controls, and full-screen widget reflow for readability on small portrait displays.

---

## Simulated Mode vs Live Mode
When Zabbix configuration is missing, the dashboard enters **Simulated Mode**.
*   **Visual Indicator**: A blinking "SIMULATED" badge appears in the sidebar and dashboard headers.
*   **Behavior**: Data is generated via a pseudo-random seed based on the current timestamp and selected range, ensuring visual consistency during UX validation.
