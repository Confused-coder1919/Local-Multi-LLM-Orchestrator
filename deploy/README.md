# Multi-machine deployment kit

This folder provides env templates and scripts for a distributed LLM Council deployment over a LAN.

## Roles and ports
- Orchestrator API: 9000
- UI dev server: 5173
- Chairman: 9100
- Council members: 8001, 8002, 8003 (or any port per member)

## Example multi-machine mapping
Example with four machines:
- PC1 (192.168.1.10): orchestrator + UI
- PC2 (192.168.1.21): council_member #1
- PC3 (192.168.1.22): council_member #2
- PC4 (192.168.1.24): chairman + council_member #3

## Configure env files
Copy the templates and update the LAN IPs:
- `deploy/env/orchestrator.env.example`
- `deploy/env/chairman.env.example`
- `deploy/env/member.env.example`

For the health and ping scripts, create a cluster config from the template:
- `deploy/env/cluster.env.example`

## Orchestrator notes
The orchestrator accepts remote URLs via:
- `COUNCIL_MEMBERS=http://ip1:8001,http://ip2:8002,...`
- `CHAIRMAN_URL=http://ip3:9100`
Run history is persisted to SQLite by default (`PERSISTENCE_DB=./data/orchestrator.db`).

## Health checks
Run a basic health scan across the cluster:
```bash
./deploy/scripts/check_health.sh /path/to/cluster.env
```

## End-to-end ping
Run a full stage1 -> stage2 -> stage3 cycle (no UI):
```bash
./deploy/scripts/ping_cluster.sh /path/to/cluster.env
```

## Optional systemd units
Template units are available in `deploy/systemd`. Update paths and env file locations before use.
