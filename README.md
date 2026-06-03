# AustroIndie Boutique Website

**Austrian × Indian Collaboration** — A luxury static e-commerce website

---

## 📁 Folder Structure

```
austroindie/
├── index.html              ← Homepage
├── css/
│   └── style.css           ← Shared styles
├── js/
│   └── main.js             ← Shared JS + product data
├── pages/
│   ├── collections.html    ← All products with filters
│   ├── categories.html     ← Products by category
│   ├── heritage.html       ← Our story / timeline
│   └── contact.html        ← Contact form
└── admin/
    └── index.html          ← Admin panel (password protected)
```

---

## 🔐 Admin Credentials

> **Keep these private — only share with trusted team members**

- **URL:** `https://YOUR-USERNAME.github.io/austroindie/admin/`
- **Username:** `austroindie_admin`
- **Password:** `Imperial@2025`

To change the password, open `admin/index.html` and edit lines:
```javascript
const ADMIN_USER = 'austroindie_admin';
const ADMIN_PASS = 'Imperial@2025';
```

---

## 🚀 Deploy to GitHub Pages — Step by Step

### Step 1 — Create a GitHub Account (if you don't have one)
1. Go to [github.com](https://github.com)
2. Click **Sign up** and create a free account

---

### Step 2 — Create a New Repository
1. After logging in, click the **+** button (top right) → **New repository**
2. Name it: `austroindie`
3. Set it to **Public**
4. **Do NOT** check "Add a README file"
5. Click **Create repository**

---

### Step 3 — Upload Your Files
1. On the new repo page, click **uploading an existing file**
2. Drag and drop the **entire `austroindie` folder contents** (all files and subfolders)
3. Or click **choose your files** and select everything
4. Scroll down, write a commit message like `Initial deploy`
5. Click **Commit changes**

> ⚠️ Make sure the folder structure is preserved: `css/`, `js/`, `pages/`, `admin/` should all be at the root of the repository.

---

### Step 4 — Enable GitHub Pages
1. In your repository, click **Settings** (top tab)
2. Scroll down to **Pages** (in the left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Set Branch to **main** and folder to **/ (root)**
5. Click **Save**

---

### Step 5 — Your Site is Live! 🎉
- After ~2 minutes, your site will be available at:
  ```
  https://YOUR-USERNAME.github.io/austroindie/
  ```
- Admin panel:
  ```
  https://YOUR-USERNAME.github.io/austroindie/admin/
  ```

---

## 🛠 Customization

### Change WhatsApp Number
Search for `919999999999` in all files and replace with your number (include country code, no + or spaces).

### Change Instagram Handle
Search for `austroindie` (in href attributes) and replace with your handle.

### Change Email
Replace `hello@austroindie.com` with your actual email.

### Add Products via Admin Panel
1. Go to `/admin/` and log in
2. Click **+ Add Product**
3. Fill in the form and click **Add Product**
4. Products are saved in the visitor's browser (localStorage)

> 💡 **Note:** Since this is a static site, products added via admin are stored in browser localStorage. Each visitor sees the default products. For a shared product database, you'd need a backend service like Firebase (free tier available).

---

## 📱 Features
- ✅ Fully responsive (mobile-first)
- ✅ Imperial palace aesthetic (Habsburg × Mughal)
- ✅ WhatsApp order button on every product
- ✅ Instagram link throughout
- ✅ 5 pages: Home, Collections, Categories, Heritage, Contact
- ✅ Admin panel with login, add/edit/delete products
- ✅ Scroll reveal animations
- ✅ Gold filigree ornamental details
- ✅ Jali lattice and arch background patterns

---

*AustroIndie — Vienna × Jaipur · Est. 2025*
