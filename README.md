# glpi-dashboard

> Helpdesk dashboard for GLPI 10.x — KPIs, SLA, technician statistics, LDAP/AD authentication.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Node.js%20%2B%20MySQL-blue)
![Auth](https://img.shields.io/badge/auth-Local%20%2B%20LDAP%20%2F%20AD-green)
![Docker](https://img.shields.io/badge/deploy-Docker%20Compose-informational)
![License](https://img.shields.io/badge/license-MIT-blue)

[Version française](README.fr.md)

---

## Overview

glpi-dashboard reads the ticket data of an existing GLPI 10.x instance and presents it as a helpdesk dashboard: volumes, statuses, SLA compliance, resolution times and workload per technician or group. The GLPI database is never modified: it is accessed read-only.

![Dashboard](docs/screenshot-dashboard.png)

![Login](docs/screenshot-login.png)

---

## Features

### Global dashboard

- **KPIs**: total tickets, resolved/closed, overall SLA rate, average resolution time
- **Time evolution**: volume per day/week/month (bar chart)
- **Status breakdown**: interactive donut chart
- **SLA by priority**: progress bars with configurable targets
- **Technician/group workload**: comparative horizontal bar chart

### Technician statistics

- Selector with search
- Individual KPIs and comparison with the team average
- Activity evolution, status/priority breakdown, top handled categories

### Periods

`Today` · `This week` · `This month` · `Last month` · `Quarter` · `Semester` · `Custom range`

### Authentication

- **Local**: bcrypt (12 rounds) + JWT (8 h)
- **Active Directory**: bind through `userPrincipalName` or `DOMAIN\username`
- **OpenLDAP**: `member` / `memberUid` / `uniqueMember`
- **Access groups**: LDAP group to `admin`/`viewer` role mapping, recomputed at each login

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser — http://IP                                │
│  React 18 + Recharts + Tailwind CSS                 │
└────────────────────┬────────────────────────────────┘
                     │ /api/* (nginx proxy)
┌────────────────────▼────────────────────────────────┐
│  Node.js 20 / Express — port 4000                   │
│  JWT · bcrypt · ldapjs                              │
└────────┬────────────────────┬───────────────────────┘
         │                    │
┌────────▼──────┐    ┌────────▼──────────────────────┐
│  MySQL :3307  │    │  Existing GLPI MySQL          │
│  app_config   │    │  READ ONLY                    │
│  app_users    │    │  glpi_tickets + users + groups│
└───────────────┘    └───────────────────────────────┘
```

---

## Requirements

| Component         | Minimum version                   |
| ----------------- | --------------------------------- |
| Docker            | 24+                               |
| Docker Compose v2 | `docker compose` (plugin)         |
| MySQL / MariaDB   | GLPI server reachable on the network |

---

## Installation

### 1. Clone the repository

```
git clone https://github.com/9LivesITSolutions/glpi-dashboard.git
cd glpi-dashboard
```

### 2. Create the `.env` file

```
cp .env.example .env
```

Fill in the values in `.env`:

```
# Generate with: openssl rand -hex 32
JWT_SECRET=<your_random_secret>

DB_ROOT_PASSWORD=<mysql_root_password>
APP_DB_USER=dashboard_user
APP_DB_PASSWORD=<app_password>

FRONTEND_PORT=80
```

> **Warning:** never commit the `.env` file — it is listed in `.gitignore`.

### 3. Start the containers

```
docker compose up -d --build
```

| Container              | Exposed port          | Role          |
| ---------------------- | --------------------- | ------------- |
| `glpi_dashboard_front` | **80** (configurable) | Web interface |
| `glpi_dashboard_api`   | 4000 (internal)       | REST API      |
| `glpi_dashboard_db`    | 3307 (local)          | Application MySQL |

### 4. Check the startup

```
docker compose ps
docker compose logs backend --tail=20
```

Expected:

```
✅ Bootstrap DB effectué.
🚀 GLPI Dashboard API démarré sur http://localhost:4000
```

### 5. Open the interface

**http://[SERVER-IP]** — the configuration wizard is displayed automatically on first launch.

---

## Configuration

### Initial wizard

#### Step 1 — GLPI database

Create a **read-only** MySQL user on the GLPI server:

```
-- MySQL 8.0+ (two separate commands)
CREATE USER 'glpi_readonly'@'%' IDENTIFIED BY 'StrongPassword!';
GRANT SELECT ON glpi.* TO 'glpi_readonly'@'%';
FLUSH PRIVILEGES;

-- Check
SHOW GRANTS FOR 'glpi_readonly'@'%';
```

Fill in the wizard:

| Field    | Value                    |
| -------- | ------------------------ |
| Host     | IP of the GLPI MySQL server |
| Port     | `3306`                   |
| Database | `glpi`                   |
| User     | `glpi_readonly`          |
| Password | The chosen password      |

> **Warning:** if the server hostname does not resolve from Docker (`EAI_AGAIN`), use its **IP address**.

#### Step 2 — LDAP / Active Directory (optional)

Active Directory:

| Field           | Example                                                   | Notes           |
| --------------- | --------------------------------------------------------- | --------------- |
| Type            | Active Directory                                          |                 |
| Server          | `192.168.x.x`                                             | IP recommended  |
| Port            | `389` / `636`                                             | 636 = LDAPS     |
| Base DN         | `DC=mydomain,DC=local`                                    |                 |
| Bind DN         | `CN=svc-glpidashboard,OU=Services,DC=mydomain,DC=local`   | Service account |
| Login attribute | `sAMAccountName`                                          | AD standard     |

OpenLDAP:

| Field           | Value                             |
| --------------- | --------------------------------- |
| Login attribute | `uid`                             |
| Bind DN         | `cn=admin,dc=mydomain,dc=local`   |

#### Step 3 — Local administrator account

**Fallback** account, available even when LDAP is down. Minimum 8 characters.

> **Important:** keep these credentials safe — it is the only way into the administration if AD is down.

### Administration

Available from **user menu → Administration** (`admin` role only).

#### LDAP configuration

Change the LDAP configuration without going through the wizard again. The service account password can be left empty to keep the existing one.

#### LDAP access groups

Map AD/LDAP groups to the `admin` and `viewer` roles.

```
LDAP login
  ↓
Fetch the user's groups
  │  AD       → memberOf attribute
  │  OpenLDAP → member + memberUid + uniqueMember
  ↓
1. Member of an Admin group  → admin role
2. Member of a Viewer group  → viewer role
3. No match                  → viewer (or denied if the option is enabled)
```

Group DN format:

```
CN=GroupName,OU=Groups,DC=mydomain,DC=local
```

> The role is **recomputed at each login**: a revocation in AD takes effect immediately.

**"Deny if no group" option**: when enabled, a user with no matching group is blocked.

#### LDAP diagnostic

**Administration → LDAP Diagnostic** simulates the login step by step. Useful to identify AD configuration problems:

| Step | Checks                                           |
| ---- | ------------------------------------------------ |
| 2b   | Service account bind                             |
| 3b   | User found + `userPrincipalName` retrieved       |
| 4a   | Chosen bind method (UPN / DOMAIN\user / DN)      |
| 4    | User bind (password)                             |
| 5    | Role resolved from groups                        |

#### User management

- Create additional local accounts (viewer or admin)
- Change roles inline (a sync icon = driven by LDAP groups)
- Delete (except your own account)

### Manual SLA

SLA computed independently from the GLPI SLA modules.

Default targets:

| Priority | Label     | Target |
| -------- | --------- | ------ |
| 6        | Major     | 2h     |
| 1        | Very high | 4h     |
| 2        | High      | 8h     |
| 3        | Medium    | 24h    |
| 4        | Low       | 72h    |
| 5        | Very low  | 168h   |

Change them through the API:

```
curl -X PUT http://localhost:4000/api/sla/targets \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"1":4,"2":8,"3":24,"4":72,"5":168,"6":2}'
```

---

## API Reference

All KPI endpoints accept:

- `?period=today|week|month|last_month|quarter|semester`
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Setup

| Method | Endpoint                  | Description                  |
| ------ | ------------------------- | ---------------------------- |
| GET    | `/api/setup/status`       | Wizard completed?            |
| POST   | `/api/setup/test-db`      | Test the GLPI connection     |
| POST   | `/api/setup/save-db`      | Save the GLPI configuration  |
| POST   | `/api/setup/test-ldap`    | Test the LDAP connection     |
| POST   | `/api/setup/save-ldap`    | Save the LDAP configuration  |
| POST   | `/api/setup/create-admin` | Create admin + finish wizard |

### Auth

| Method | Endpoint                 | Description                                        |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/api/auth/login`        | `{ username, password, mode }` → `{ token, user }` |
| GET    | `/api/auth/me`           | Current user                                       |
| GET    | `/api/auth/ldap-enabled` | `{ enabled: bool }`                                |

### KPIs

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/api/tickets/summary`          | Totals by status               |
| GET    | `/api/tickets/by-status`        | Status breakdown               |
| GET    | `/api/tickets/evolution`        | Time evolution                 |
| GET    | `/api/resolution/average`       | Average resolution time        |
| GET    | `/api/resolution/evolution`     | Resolution time evolution      |
| GET    | `/api/sla/summary`              | Global SLA rate + by priority  |
| GET    | `/api/sla/targets`              | Target times                   |
| PUT    | `/api/sla/targets`              | Change the target times        |
| GET    | `/api/techniciens`              | Workload per technician        |
| GET    | `/api/techniciens/groupes`      | Workload per group             |
| GET    | `/api/technicien-stats/list`    | Technician list                |
| GET    | `/api/technicien-stats/:userId` | Detailed statistics            |

### Admin *(admin role required)*

| Method | Endpoint                        | Description                |
| ------ | ------------------------------- | -------------------------- |
| GET    | `/api/admin/ldap`               | Current LDAP configuration |
| POST   | `/api/admin/ldap/test`          | Test the connection        |
| POST   | `/api/admin/ldap/test-group`    | Check a group DN           |
| POST   | `/api/admin/ldap/save`          | Save the configuration     |
| GET    | `/api/admin/users`              | User list                  |
| POST   | `/api/admin/users`              | Create a local user        |
| PUT    | `/api/admin/users/:id/role`     | Change the role            |
| PUT    | `/api/admin/users/:id/password` | Change the password        |
| DELETE | `/api/admin/users/:id`          | Delete                     |
| POST   | `/api/debug/ldap-login`         | Step-by-step LDAP diagnostic |

### GLPI tables used *(read-only)*

| Table                 | Usage                              |
| --------------------- | ---------------------------------- |
| `glpi_tickets`        | Volume, statuses, priorities, dates |
| `glpi_tickets_users`  | Technician assignment (type=2)     |
| `glpi_groups_tickets` | Group assignment (type=2)          |
| `glpi_users`          | Technician names                   |
| `glpi_groups`         | Group names                        |
| `glpi_itilcategories` | Categories (technician view)       |

---

## Project Structure

```
glpi-dashboard/
├── .env.example             # Template — copy to .env and fill in
├── docker-compose.yml
├── README.md
├── README.fr.md
├── LICENSE
├── backend/                 # Node.js / Express API
│   ├── Dockerfile
│   ├── server.js
│   ├── db/                  # appDb.js, glpiDb.js (read-only), bootstrap.js
│   ├── middleware/          # auth.js (JWT check)
│   ├── routes/              # setup, auth, tickets, resolution, techniciens, technicienStats, sla, admin, debug
│   └── services/            # ldap.js (LDAP/AD auth), config.js (app_config CRUD)
├── frontend/                # React 18 + Vite + Tailwind
│   ├── Dockerfile
│   ├── nginx.conf           # SPA routing + /api/ proxy
│   └── src/                 # pages, components (wizard, dashboard), context
└── docs/                    # Screenshots
```

---

## Troubleshooting

### Backend does not start

```
docker compose logs backend --tail=30
```

| Error                | Cause                  | Solution                                       |
| -------------------- | ---------------------- | ---------------------------------------------- |
| `Access denied`      | Wrong DB credentials   | Check the `APP_DB_*` variables in `.env`       |
| `ECONNREFUSED`       | Application DB not ready | Wait until `app-db` is healthy               |
| `Cannot find module` | Outdated image         | `docker compose up -d --build`                 |

### 502 error on the interface

```
docker compose logs backend --tail=50
```

### Permission denied on `docker`

```
sudo usermod -aG docker $USER && newgrp docker
```

### GLPI hostname not resolved in Docker (`EAI_AGAIN`)

Use the IP address instead of the hostname, or add to `docker-compose.yml`:

```
backend:
  extra_hosts:
    - "glpi-server-name:192.168.x.x"
```

### Reset the wizard

```
UPDATE app_config SET `value` = 'false' WHERE `key` = 'setup_completed';
```

### Inspect the application database (DBeaver / TablePlus)

```
Host: localhost  |  Port: 3307
Database: glpi_dashboard_app
User / Password: see your .env
```

---

## Security

- GLPI database accessed **read-only**: no write
- Passwords hashed with **bcrypt (12 rounds)**
- **Signed JWT** tokens with a random secret — regenerate it in production
- LDAP password **never returned** by the API
- `/api/debug/ldap-login` endpoint **restricted to authenticated admins**
- LDAP roles **recomputed at each login**: no persistence of privileges

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my-feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. For major changes, open an issue first.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Maintained by **9 Lives IT Solutions** — Healthcare IT & Infrastructure Automation.
