# 🚀 Deploy Offline Pay Backend to Render

## ✅ Backend is Now Ready for Render Deployment!

### Files Created:
- `render.yaml` - Render deployment configuration
- `.env.example` - Environment variables template
- `.gitignore` - Prevent committing sensitive files
- Updated `db.js` - Support for MongoDB Atlas
- Updated `index.js` - Production-ready CORS & health check
- Updated `package.json` - Node version & scripts

---

## 📋 Step-by-Step Render Deployment Guide

### **Step 1: Create MongoDB Atlas (Free Cloud Database)**

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up with Google/GitHub (easiest)
3. Choose **FREE M0 tier** (512MB free)
4. Select cloud provider: **AWS** (default is fine)
5. Choose region closest to you (e.g., Mumbai for India)
6. Click **Create Cluster** (takes 3-5 minutes)

### **Step 2: Get MongoDB Connection String**

1. In Atlas Dashboard, click **Connect**
2. Choose: **Connect your application**
3. Driver: **Node.js**
4. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<username>` and `<password>` with your credentials
6. Add database name at the end:
   ```
   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/offline_pay?retryWrites=true&w=majority
   ```

**Security Settings:**
- Go to **Network Access** → Add IP Address → **Allow Access from Anywhere** (0.0.0.0/0)
- Go to **Database Access** → Create a user with username/password

---

### **Step 3: Deploy to Render**

#### **Method A: Deploy using GitHub (Recommended)**

1. First, create a GitHub repository for your backend:
```powershell
cd C:\Users\ashle\OneDrive\Desktop\offline-pay-system\mobile-app\offline-pay-backend
git init
git add .
git commit -m "Initial commit - Offline Pay Backend for Render"
```

2. Create a new repository on GitHub and push:
```powershell
# Replace <your-username> with your GitHub username
git remote add origin https://github.com/<your-username>/offline-pay-backend.git
git branch -M main
git push -u origin main
```

3. Go to: https://render.com
4. Click **Sign Up** → Sign in with **GitHub**
5. Click **New** → **Web Service**
6. Choose **Build and deploy from a Git repository**
7. Connect your `offline-pay-backend` repository
8. Configure the service:
   - **Name**: `offline-pay-backend-production`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Select **Free** (0$ per month)

#### **Method B: Deploy using Render CLI (Alternative)**

1. Install Render CLI:
```powershell
npm install -g @render/cli
```

2. Login to Render:
```powershell
render login
```

3. Deploy from local directory:
```powershell
render deploy --service-type web --name offline-pay-backend
```

---

### **Step 4: Configure Environment Variables in Render**

1. In your Render service dashboard, go to **Environment** tab
2. Click **Add Environment Variable** and add these:

```
MONGODB_URI=mongodb+srv://your-connection-string-from-step2
JWT_SECRET=your_random_secret_key_12345
NODE_ENV=production
PORT=10000
**Generate a secure JWT_SECRET:**
```powershell
# Run this in PowerShell to get a random secret
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Important Notes:**
- **PORT**: Render automatically assigns a port, but our code uses `process.env.PORT || 4000` which works perfectly
- **NODE_ENV**: Set to `production` for optimal performance
- After adding variables, Render will automatically redeploy

---

### **Step 5: Get Your Render URL**

1. Once deployment completes, go to your service dashboard
2. You'll see the **Live URL** at the top (like: `https://offline-pay-backend-production.onrender.com`)
3. **Copy this URL!** - This is your permanent backend URL
4. It may take 2-3 minutes for the first deployment to be ready

---

### **Step 6: Update Your React Native App**

Open `app/config/api.ts` and update:

```typescript
export const API_BASE_URL = "https://your-render-app.onrender.com";
// Replace with your actual Render URL (no trailing slash)
// Example: https://offline-pay-backend-production.onrender.com
```

Save the file and **restart Expo**!

---

## ✅ Testing Your Render Deployment

1. **Test Dashboard**: Visit `https://your-render-url.onrender.com`
   - Should see the dashboard with voucher statistics
   - If you see "Database not initialized", wait 1-2 minutes for MongoDB connection

2. **Test Health Check**: Visit `https://your-render-url.onrender.com/api/health`
   - Should return:
   ```json
   {
     "status": "healthy",
     "message": "Offline Pay Backend API",
     "database": "connected",
     "uptime": 123.45,
     "timestamp": "2026-02-13T..."
   }
   ```

3. **Test Mobile App**:
   - Register a new user in your app
   - Check Render logs (in Render dashboard → **Logs** tab)
   - Should see: `🚀 New user registered: U_...`

---

## 🎯 What You Get with Render

✅ **Free Tier**: 750 hours/month (enough for development)
✅ **Automatic HTTPS**: SSL certificates included
✅ **Zero-downtime deploys**: Updates without interruption
✅ **Git-based deployments**: Auto-deploy on Git push
✅ **Environment variables**: Secure config management
✅ **Persistent logs**: View all application logs
✅ **Global CDN**: Fast worldwide access
✅ **24/7 monitoring**: Service health checks

---

## 🔧 Troubleshooting

### **If deployment fails:**
1. Check **Logs** tab in Render dashboard
2. Look for build errors or runtime errors
3. Verify all dependencies in `package.json`
4. Ensure Node.js version compatibility

### **If health check fails:**
1. Verify MongoDB connection string is correct
2. Check Network Access in Atlas allows all IPs (0.0.0.0/0)
3. Confirm database user has read/write permissions
4. Wait 2-3 minutes after deployment for DB connection

### **If mobile app can't connect:**
1. Verify URL in `api.ts` has no trailing slash
2. Test API endpoints in browser first
3. Check Render service status (should be green)
4. Verify environment variables are set correctly

### **If service spins down (Free tier limitation):**
- Render free services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds (cold start)
- For demo, send a test request before showing professors
- Solution: Upgrade to paid plan ($7/month) for always-on service

---

## 💰 Render Pricing

- **Free Tier**: 
  - 750 hours/month
  - Service sleeps after 15 minutes of inactivity  
  - Perfect for student projects and demos
  
- **Paid Tier**: $7/month
  - Always-on (no sleeping)
  - Faster builds
  - Better for production apps

- **MongoDB Atlas**: Free tier (512MB) - enough for development

---

## 🚀 Next Steps After Deployment

1. **Complete Testing**:
   ```bash
   # Test all endpoints
   curl https://your-render-url.onrender.com/api/health
   ```

2. **Update Mobile App** with new Render URL

3. **Test Full Flow**:
   - User registration & login
   - Balance loading (dummy money)
   - Offline voucher generation
   - QR code scanning
   - Merchant sync
   - Transaction history

4. **Monitor Logs** in Render dashboard during testing

5. **Demo Ready**: Show professors the live Render URL! 🎓

---

## 🎓 Ready for Production Demo

Your Offline Payment System now has:
- ✅ Cloud backend on Render
- ✅ MongoDB Atlas database
- ✅ JWT authentication  
- ✅ Digital signature security
- ✅ Offline voucher system
- ✅ Merchant dashboard
- ✅ Real-time transaction sync

**Total Setup Time**: 15-20 minutes  
**Total Cost**: $0 (Free tiers)

Need help with deployment? I'm here to guide you through each step! 🚀
