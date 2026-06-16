# SissyTrends Boutique 🌸

**Curated Sarees & Jewellery — Cultural · Modern · Curated**

A full-stack boutique website with admin portal, live product catalog, wishlist, and WhatsApp ordering.

---

## Stack
- **Frontend** — HTML, CSS, Vanilla JS
- **Backend** — Python 3 (stdlib only, no frameworks)
- **Database** — SQLite (`data/sissytrends.db`, auto-created on first run)
- **Hosting** — Render.com (backend) + GoDaddy (domain)

---

## Local Setup

1. Install [Python 3](https://python.org/downloads) — tick **Add Python to PATH**
2. Clone the repo
3. Double-click `start.bat`
4. Open `http://localhost:5000`

The database is created automatically from `products_CSVBasic.csv` on first run.

---

## Admin Portal

`http://localhost:5000/admin/`

Credentials are stored in `admin/env-config.js` (gitignored — create from `admin/env-config.example.js`).

---

## Deployment (Render.com)

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render.com](https://render.com)
3. Connect your GitHub repo
4. Set:
   - **Build command:** `python init_db.py`
   - **Start command:** `python api.py`
5. Point your GoDaddy domain CNAME to your Render URL

---

## Project Structure

```
austroindie/
├── index.html              # Homepage
├── api.py                  # Python backend + static file server
├── init_db.py              # DB creator + CSV seeder
├── start.bat               # One-click local server (Windows)
├── products_CSVBasic.csv   # Product catalog (source of truth)
├── requirements.txt        # No pip installs needed (stdlib only)
├── admin/
│   ├── index.html          # Admin portal
│   └── env-config.js       # ⚠ Gitignored — create manually
├── pages/
│   ├── collections.html
│   ├── categories.html
│   ├── contact.html
│   └── heritage.html
├── css/style.css
├── js/main.js
├── Images/
└── data/                   # ⚠ Gitignored — auto-created
    └── sissytrends.db
```

---

## Environment Variables (Render)

| Variable | Value |
|---|---|
| `PORT` | Set automatically by Render |

No other environment variables needed.
