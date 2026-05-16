# HA Reporting: Executive Solution Overview

## 1. Project Vision
**HA Reporting** is a high-availability telemetry visualization platform designed for mission-critical infrastructure monitoring. Developed specifically for "closed-loop" and air-gapped environments, it provides real-time visibility into complex hardware and network stacks without requiring external internet dependencies.

## 2. Core Functional Pillars

### A. Dynamic Executive Dashboards
*   **Module Constructor**: A flexible dashboard engine allowing administrators to build custom views using a block-based architecture.
*   **KPI Widgets**: High-impact numerical indicators for tracking "North Star" metrics like Uptime, Bandwidth, and CPU Load.
*   **Trend Charts**: Time-series visualizations (Area and Line charts) for identifying patterns, cyclic behavior, and anomalies.

### B. Network Topology (Visual Mesh)
*   **Traffic Mapping**: Live visualization of data flow between Gateways, Core Switches, and Application Clusters.
*   **Link Analysis**: Dynamic animation speeds representing link saturation and latency directly on the topology graph.

### C. Hardware Inventory (Infra Management)
*   **Asset Signature**: Deep visibility into physical host specifications (Model, CPU, RAM, Disk).
*   **Health State**: Immediate color-coded status classification (Optimal, High Load, Idle, Critical).
*   **Uptime Tracking**: Precise counter per asset to monitor long-term hardware reliability.

### D. Intelligent Event Log
*   **Severity Classification**: Categorization of issues from "Information" to "Disaster."
*   **Signal Filtering**: Global search and classification tools to find specific triggers across thousands of endpoints.

## 3. Operations & Configuration

### Connecting to the Zabbix Backend
1.  Navigate to **Configuration > Zabbix Gateway**.
2.  Input your internal **Endpoint URL** (e.g., `https://zabbix.internal/api_jsonrpc.php`).
3.  Provide the **API Token** generated from the Zabbix service account.
4.  The system will switch from **Simulated Mode** to **Live Mode** once a handshake is established.

### Widget Customization Workflow
1.  **Addition**: Click **+ KPI** or **+ CHART** in the top-right header.
2.  **Setup**: A "Constructor" menu appears. Define:
    *   **Label Branding**: The display name of the metric.
    *   **Telemetry ID**: The Zabbix Item ID to track.
    *   **Aggregation**: Mean, Max, or Last value logic.
3.  **Refinement**: Widgets can be deleted or re-configured at any time by clicking their contextual edit icons.
4.  **Layout**: The dashboard automatically adjusts its "Bento-style" grid to ensure optimal readability on any screen size.

### E. Simulation Layer
*   **Purpose**: Allows immediate UX and workflow validation without a live backend.
*   **Transition to Production**: When a valid Zabbix configuration is detected, the "Simulated" badge in the status bar will change to "Live".
*   **Infrastructure & Network Populating**: 
    *   **Architecture Note**: Currently, these views use a **Deterministic Simulated Model**. Values and network relationships are derived from the selected time period to ensure the UI feels responsive during validation.
    *   **Production Readiness**: In a full production deployment, these views would be connected to the Zabbix Discovery and Maps API to automatically fetch physical hardware assets and dynamic network relationships.

## 4. Technical Architecture
*   **Offline-First**: Zero external CDNs or API dependencies. All icons, fonts, and libraries are bundled in the build.
*   **Simulation Layer**: Built-in data generator for end-to-end UX validation without requiring a live backend for demos.
*   **High Performance**: Minimal footprint React application with hardware-accelerated animations via Framer Motion.

---
*Confidential - Internal Use Only*
