import express from "express";
import cors from "cors";
import crypto from "crypto";
import pkg from "elliptic";
import dotenv from "dotenv";
import { connectDB, getDB } from "./db.js";
import { hashPassword, comparePassword, generateToken, authMiddleware, optionalAuthMiddleware } from "./auth.js";

dotenv.config();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const { ec: EC } = pkg;
const ec = new EC("secp256k1");

const app = express();

// CORS configuration - allow all origins for mobile app compatibility
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "OFFLINE_DEMO_SECRET_123456";
const SIGNING_SECRET = "OFFLINE_DEMO_SECRET_123456";

function computeSignature(payload) {
  const data = JSON.stringify(payload);
  return crypto
    .createHash("sha256")
    .update(SIGNING_SECRET + "|" + data)
    .digest("hex");
}

// Health check endpoint for Render/monitoring
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection
    const db = getDB();
    const dbStatus = await db.admin().ping();
    
    const healthInfo = {
      status: 'healthy',
      message: 'Offline Pay Backend API',
      database: 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };

    res.status(200).json(healthInfo);
  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorInfo = {
      status: 'unhealthy',
      message: 'Offline Pay Backend API',
      database: 'disconnected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      error: error.message
    };

    res.status(503).json(errorInfo);
  }
});

// Simple API status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    api: 'Offline Pay Backend',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/status - API status',
      'POST /api/auth/register - User registration',
      'POST /api/auth/login - User login',
      'POST /api/auth/merchant/register - Merchant registration',
      'POST /api/auth/merchant/login - Merchant login',
      'POST /api/vouchers/sync - Sync offline vouchers',
      'GET / - Dashboard'
    ]
  });
});

// Dashboard HTML page
app.get("/", async (req, res) => {
  try {
    const db = getDB();
    const vouchersDb = await db.collection('vouchers').find().toArray();
    const usersCount = await db.collection('users').countDocuments();
    
    const totalVouchers = vouchersDb.length;
    const totalAmount = vouchersDb.reduce((sum, v) => sum + v.amount, 0);
    const syncedCount = vouchersDb.filter(v => v.status === "synced").length;
    const offlineCount = vouchersDb.filter(v => v.status === "offline").length;
    const registeredUsers = usersCount;

    const voucherRows = vouchersDb.map(v => {
      // Convert to IST (India Standard Time - UTC+5:30)
      const timestamp = new Date(v.syncedAt || v.createdAt);
      const istTime = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(timestamp);

      return `
    <tr>
      <td>${v.voucherId}</td>
      <td>${v.merchantId}</td>
      <td>₹${v.amount}</td>
      <td>${v.issuedTo || 'N/A'}</td>
      <td><span class="badge ${v.status === 'synced' ? 'synced' : 'offline'}">${v.status}</span></td>
      <td>${istTime} <small>(IST)</small></td>
      <td style="font-family: monospace; font-size: 11px;">${v.signature.slice(0, 20)}...</td>
    </tr>
  `;
    }).join('');

    // Get current time in IST for dashboard
    const currentTimeIST = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit', 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date());

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Offline Pay Backend Dashboard</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card .number {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }
    .stat-card .label {
      color: #6c757d;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content { padding: 30px; }
    h2 { 
      color: #333; 
      margin-bottom: 20px;
      font-size: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 15px;
      border-bottom: 1px solid #e9ecef;
      color: #495057;
    }
    tr:hover { background: #f8f9fa; }
    tr:last-child td { border-bottom: none; }
    .badge {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge.synced {
      background: #d4edda;
      color: #155724;
    }
    .badge.offline {
      background: #fff3cd;
      color: #856404;
    }
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #6c757d;
    }
    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.3;
    }
    .refresh-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #667eea;
      color: white;
      border: none;
      padding: 15px 25px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s;
    }
    .refresh-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Offline Pay Backend</h1>
      <p>Secure Payment Voucher Management System</p>
      <p style="font-size: 14px; opacity: 0.8; margin-top: 10px;">
        📅 Last Updated: ${currentTimeIST} (IST)
      </p>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="number">${totalVouchers}</div>
        <div class="label">Total Vouchers</div>
      </div>
      <div class="stat-card">
        <div class="number">${syncedCount}</div>
        <div class="label">Synced</div>
      </div>
      <div class="stat-card">
        <div class="number">${offlineCount}</div>
        <div class="label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="number">₹${totalAmount}</div>
        <div class="label">Total Amount</div>
      </div>
      <div class="stat-card">
        <div class="number">${registeredUsers}</div>
        <div class="label">Registered Users</div>
      </div>
    </div>

    <div class="content">
      <h2>📋 All Vouchers</h2>
      ${totalVouchers === 0 ? `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <h3>No vouchers yet</h3>
          <p>Vouchers will appear here after merchant sync</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Voucher ID</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>User ID</th>
              <th>Status</th>
              <th>Date</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            ${voucherRows}
          </tbody>
        </table>
      `}
    </div>
  </div>

  <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>

  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>
  `;

    res.send(html);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).send("Database error");
  }
});

// ==================== AUTHENTICATION ROUTES ====================

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { phone, password, name, publicKeyHex } = req.body;
    
    if (!phone || !password || !name) {
      return res.status(400).json({ error: "Phone, password, and name are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: "User with this phone already exists" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate userId
    const userId = `user_${Date.now()}`;

    // Create user
    const newUser = {
      userId,
      phone,
      name,
      passwordHash,
      publicKeyHex: publicKeyHex || null,
      balance: 0, // Start with 0 balance
      createdAt: new Date().toISOString(),
      role: 'user',
    };

    await usersCollection.insertOne(newUser);

    // Generate token
    const token = generateToken({ userId, phone, role: 'user' });

    console.log("New user registered:", userId);

    res.json({
      success: true,
      token,
      user: {
        userId,
        phone,
        name,
        balance: 0,
        role: 'user',
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne({ phone });
    if (!user) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    // Generate token
    const token = generateToken({ userId: user.userId, phone: user.phone, role: user.role || 'user' });

    console.log("User logged in:", user.userId);

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        phone: user.phone,
        name: user.name,
        balance: user.balance || 0,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/auth/merchant/register
 * Register a new merchant
 */
app.post("/api/auth/merchant/register", async (req, res) => {
  try {
    const { phone, password, businessName, address } = req.body;
    
    if (!phone || !password || !businessName) {
      return res.status(400).json({ error: "Phone, password, and business name are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const merchantsCollection = db.collection('merchants');

    // Check if merchant already exists
    const existingMerchant = await merchantsCollection.findOne({ phone });
    if (existingMerchant) {
      return res.status(400).json({ error: "Merchant with this phone already exists" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate merchantId
    const merchantId = `M_${Date.now()}`;

    // Create merchant
    const newMerchant = {
      merchantId,
      phone,
      businessName,
      address: address || '',
      passwordHash,
      isVerified: false, // Requires admin verification
      createdAt: new Date().toISOString(),
      role: 'merchant',
    };

    await merchantsCollection.insertOne(newMerchant);

    // Generate token
    const token = generateToken({ merchantId, phone, role: 'merchant' });

    console.log("New merchant registered:", merchantId);

    res.json({
      success: true,
      token,
      merchant: {
        merchantId,
        phone,
        businessName,
        isVerified: false,
        role: 'merchant',
      },
    });
  } catch (error) {
    console.error("Merchant register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/merchant/login
 * Login existing merchant
 */
app.post("/api/auth/merchant/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    const db = getDB();
    const merchantsCollection = db.collection('merchants');

    // Find merchant
    const merchant = await merchantsCollection.findOne({ phone });
    if (!merchant) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, merchant.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    // Generate token
    const token = generateToken({ merchantId: merchant.merchantId, phone: merchant.phone, role: 'merchant' });

    console.log("Merchant logged in:", merchant.merchantId);

    res.json({
      success: true,
      token,
      merchant: {
        merchantId: merchant.merchantId,
        phone: merchant.phone,
        businessName: merchant.businessName,
        isVerified: merchant.isVerified || false,
        role: 'merchant',
      },
    });
  } catch (error) {
    console.error("Merchant login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    
    if (req.user.role === 'merchant') {
      const merchant = await db.collection('merchants').findOne({ merchantId: req.user.merchantId });
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      return res.json({
        merchantId: merchant.merchantId,
        phone: merchant.phone,
        businessName: merchant.businessName,
        isVerified: merchant.isVerified || false,
        role: 'merchant',
      });
    } else {
      const user = await db.collection('users').findOne({ userId: req.user.userId });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({
        userId: user.userId,
        phone: user.phone,
        name: user.name,
        balance: user.balance || 0,
        role: 'user',
      });
    }
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

/**
 * POST /api/auth/forgot-password
 * Reset password for user
 */
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    
    if (!phone || !newPassword) {
      return res.status(400).json({ error: "Phone and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Find user
    const user = await usersCollection.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "No account found with this phone number" });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await usersCollection.updateOne(
      { phone },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );

    console.log("Password reset for user:", user.userId);

    res.json({
      success: true,
      message: "Password reset successfully! You can now login with your new password.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

/**
 * POST /api/auth/merchant/forgot-password
 * Reset password for merchant
 */
app.post("/api/auth/merchant/forgot-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    
    if (!phone || !newPassword) {
      return res.status(400).json({ error: "Phone and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const merchantsCollection = db.collection('merchants');

    // Find merchant
    const merchant = await merchantsCollection.findOne({ phone });
    if (!merchant) {
      return res.status(404).json({ error: "No merchant account found with this phone number" });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await merchantsCollection.updateOne(
      { phone },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );

    console.log("Password reset for merchant:", merchant.merchantId);

    res.json({
      success: true,
      message: "Password reset successfully! You can now login with your new password.",
    });
  } catch (error) {
    console.error("Merchant forgot password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ==================== END AUTHENTICATION ROUTES ====================

// Admin endpoint to view all registered users (for testing)
app.get("/api/admin/users", async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection('users').find({}, {
      projection: { passwordHash: 0 } // Hide password hash
    }).toArray();
    
    res.json({
      total: users.length,
      users: users.map(u => ({
        userId: u.userId,
        phone: u.phone,
        name: u.name,
        balance: u.balance || 0,
        createdAt: u.createdAt,
        hasPublicKey: !!u.publicKeyHex,
      }))
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Admin endpoint to view all merchants (for testing)
app.get("/api/admin/merchants", async (req, res) => {
  try {
    const db = getDB();
    const merchants = await db.collection('merchants').find({}, {
      projection: { passwordHash: 0 } // Hide password hash
    }).toArray();
    
    res.json({
      total: merchants.length,
      merchants: merchants.map(m => ({
        merchantId: m.merchantId,
        phone: m.phone,
        businessName: m.businessName,
        address: m.address,
        isVerified: m.isVerified || false,
        createdAt: m.createdAt,
      }))
    });
  } catch (error) {
    console.error("Admin merchants error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// View all vouchers
app.get("/api/vouchers", async (req, res) => {
  try {
    const db = getDB();
    const vouchersDb = await db.collection('vouchers').find().toArray();
    res.json({
      totalVouchers: vouchersDb.length,
      vouchers: vouchersDb,
    });
  } catch (error) {
    console.error("Get vouchers error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * POST /api/vouchers/sync
 * Body: { merchantId: string, vouchers: Voucher[] }
 * Voucher: { voucherId, merchantId, amount, createdAt, signature }
 */
app.post("/api/vouchers/sync", async (req, res) => {
  console.log(">>> /api/vouchers/sync called at", new Date().toISOString());
  console.log("Incoming body (truncated):", JSON.stringify(req.body).slice(0, 4000));

  const { merchantId, vouchers } = req.body || {};
  if (!merchantId || !Array.isArray(vouchers)) {
    console.log("Bad request body:", req.body);
    return res.status(400).json({ error: "Invalid body" });
  }

  try {
    const db = getDB();
    const vouchersCollection = db.collection('vouchers');
    const usersCollection = db.collection('users');
    
    const syncedIds = [];
    const rejected = [];

    for (const v of vouchers) {
    // simple validation
    if (!v.voucherId || !v.merchantId || typeof v.amount !== "number" || !v.signature) {
      rejected.push({ voucherId: v.voucherId, reason: "Invalid format" });
      continue;
    }

    if (v.merchantId !== merchantId) {
      rejected.push({ voucherId: v.voucherId, reason: "Wrong merchantId" });
      continue;
    }

    // expect voucher includes issuedTo & signature (DER hex)
    const issuedTo = v.issuedTo;
    if (!issuedTo) {
      rejected.push({ voucherId: v.voucherId, reason: "Missing issuedTo" });
      continue;
    }

    // Use publicKeyHex from voucher (always included in new vouchers)
    let userPubHex = v.publicKeyHex;
    if (!userPubHex) {
      // Fallback: try to get from database
      const user = await usersCollection.findOne({ userId: issuedTo });
      userPubHex = user?.publicKeyHex;
    }
    
    if (!userPubHex) {
      rejected.push({ voucherId: v.voucherId, reason: "Missing public key in voucher" });
      continue;
    }

    // rebuild payload exactly as client did (without signature)
    const payload = {
      voucherId: v.voucherId,
      merchantId: v.merchantId,
      amount: v.amount,
      createdAt: v.createdAt,
      issuedTo: issuedTo
    };

    // compute hash same as client
    const payloadStr = JSON.stringify(payload);
    const msgHashHex = crypto.createHash("sha256").update(payloadStr).digest("hex");

    // verify DER signature hex
    try {
      const key = ec.keyFromPublic(userPubHex, "hex");
      const signatureOk = key.verify(msgHashHex, v.signature);
      if (!signatureOk) {
        rejected.push({ voucherId: v.voucherId, reason: "Bad signature" });
        continue;
      }
    } catch (err) {
      console.log("Signature verification error:", err);
      rejected.push({ voucherId: v.voucherId, reason: "Signature verify error" });
      continue;
    }

      // Check for duplicate
      const already = await vouchersCollection.findOne({ voucherId: v.voucherId });
      if (already) {
        rejected.push({ voucherId: v.voucherId, reason: "Duplicate voucherId" });
        continue;
      }

      // Auto-register user if not exists
      const user = await usersCollection.findOne({ userId: issuedTo });
      if (!user && userPubHex) {
        await usersCollection.insertOne({
          userId: issuedTo,
          publicKeyHex: userPubHex,
          registeredAt: new Date().toISOString(),
        });
        console.log("Auto-registered user:", issuedTo);
      }

      // Store voucher in database
      await vouchersCollection.insertOne({
        ...payload,
        signature: v.signature,
        merchantId,
        status: "synced",
        syncedAt: new Date().toISOString(),
      });

      // Deduct user balance when voucher is synced for the first time
      // This is the authoritative balance check — local AsyncStorage can be tampered on rooted devices
      const payingUser = await usersCollection.findOne({ userId: issuedTo });
      const backendBalance = (payingUser && typeof payingUser.balance === "number") ? payingUser.balance : 0;

      if (backendBalance < v.amount) {
        // User inflated local balance — reject voucher to prevent fraud
        console.warn(`🚨 Fraud attempt? User ${issuedTo} has ₹${backendBalance} backend balance but voucher is ₹${v.amount}`);
        rejected.push({ voucherId: v.voucherId, reason: "Insufficient balance" });
        // Also remove the voucher we just inserted
        await vouchersCollection.deleteOne({ voucherId: v.voucherId });
        continue;
      }

      const newBalance = backendBalance - v.amount;
      await usersCollection.updateOne(
        { userId: issuedTo },
        {
          $set: { balance: newBalance },
          $push: {
            balanceHistory: {
              type: "payment",
              amount: v.amount,
              timestamp: new Date().toISOString(),
              previousBalance: backendBalance,
              newBalance,
              merchantId,
              voucherId: v.voucherId,
            },
          },
        }
      );
      console.log(`💸 Synced deduct: user ${issuedTo} -₹${v.amount} → ₹${newBalance}`);

      syncedIds.push(v.voucherId);
    }

    const totalStored = await vouchersCollection.countDocuments();
    const result = { syncedIds, rejected, totalStored };
    console.log("Sync result:", result);
    return res.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ error: "Database error" });
  }
});

/**
 * GET /api/merchant/:id/summary
 * Shows total redeemed for that merchant
 */
app.get("/api/merchant/:id/summary", async (req, res) => {
  try {
    const db = getDB();
    const merchantId = req.params.id;
    const list = await db.collection('vouchers').find({ merchantId }).toArray();
    const total = list.reduce((sum, v) => sum + v.amount, 0);

    res.json({
      merchantId,
      totalRedeemedAmount: total,
      vouchersCount: list.length,
    });
  } catch (error) {
    console.error("Merchant summary error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/register-key", async (req, res) => {
  try {
    const db = getDB();
    const { userId, publicKeyHex } = req.body || {};
    if (!userId || !publicKeyHex) return res.status(400).json({ error: "Invalid body" });
    
    await db.collection('users').updateOne(
      { userId },
      { $set: { publicKeyHex, registeredAt: new Date().toISOString() } },
      { upsert: true }
    );
    
    console.log("Registered public key for", userId);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Register key error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * POST /api/balance/add
 * Add balance to user account (max 1000 Rs)
 */
app.post("/api/balance/add", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.userId;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (amount > 1000) {
      return res.status(400).json({ error: "Maximum load amount is ₹1000" });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Get current user
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update balance
    const newBalance = (user.balance || 0) + amount;
    await usersCollection.updateOne(
      { userId },
      { 
        $set: { balance: newBalance },
        $push: { 
          balanceHistory: {
            type: 'add',
            amount,
            timestamp: new Date().toISOString(),
            previousBalance: user.balance || 0,
            newBalance
          }
        }
      }
    );

    console.log(`💰 User ${userId} added ₹${amount} | New balance: ₹${newBalance}`);

    res.json({
      success: true,
      balance: newBalance,
      amount,
      message: `₹${amount} added successfully`
    });
  } catch (error) {
    console.error("Add balance error:", error);
    res.status(500).json({ error: "Failed to add balance" });
  }
});

/**
 * GET /api/balance
 * Get current user balance
 */
app.get("/api/balance", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDB();
    const user = await db.collection('users').findOne({ userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      balance: user.balance || 0,
      userId: user.userId,
      name: user.name,
      phone: user.phone
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile (name)
 */
app.put("/api/user/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const db = getDB();
    const result = await db.collection('users').updateOne(
      { userId },
      { $set: { name: name.trim(), updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`👤 User ${userId} updated name to: ${name.trim()}`);

    res.json({
      success: true,
      message: "Profile updated successfully",
      name: name.trim()
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * PUT /api/merchant/profile
 * Update merchant profile (name, shopName, address)
 */
app.put("/api/merchant/profile", authMiddleware, async (req, res) => {
  try {
    const merchantId = req.user.merchantId || req.user.userId;
    const { name, shopName, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const db = getDB();
    const result = await db.collection('merchants').updateOne(
      { merchantId },
      { 
        $set: { 
          name: name.trim(), 
          shopName: (shopName || name).trim(),
          address: (address || '').trim(),
          updatedAt: new Date().toISOString() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    console.log(`🏪 Merchant ${merchantId} updated profile: ${name.trim()} / ${(shopName || name).trim()} at ${(address || '').trim()}`);

    res.json({
      success: true,
      message: "Profile updated successfully",
      name: name.trim(),
      shopName: (shopName || name).trim(),
      address: (address || '').trim()
    });
  } catch (error) {
    console.error("Update merchant profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * POST /api/balance/deduct
 * Deduct balance from user (for payments)
 */
app.post("/api/balance/deduct", authMiddleware, async (req, res) => {
  try {
    const { amount, merchantId, voucherId } = req.body;
    const userId = req.user.userId;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Get current user
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentBalance = user.balance || 0;

    // Idempotency: if this voucherId was already deducted, return current balance without deducting again
    if (voucherId) {
      const alreadyDeducted = (user.balanceHistory || []).some(
        (h) => h.voucherId === voucherId && h.type === 'payment'
      );
      if (alreadyDeducted) {
        console.log(`⚠️ Duplicate deduct skipped for voucher ${voucherId}`);
        return res.json({ success: true, balance: currentBalance, amount, message: 'Already deducted' });
      }
    }

    if (currentBalance < amount) {
      return res.status(400).json({ 
        error: "Insufficient balance",
        required: amount,
        available: currentBalance
      });
    }

    // Deduct balance
    const newBalance = currentBalance - amount;
    await usersCollection.updateOne(
      { userId },
      { 
        $set: { balance: newBalance },
        $push: { 
          balanceHistory: {
            type: 'payment',
            amount,
            timestamp: new Date().toISOString(),
            previousBalance: currentBalance,
            newBalance,
            merchantId,
            voucherId
          }
        }
      }
    );

    console.log(`💸 User ${userId} paid ₹${amount} to ${merchantId} | Remaining: ₹${newBalance}`);

    res.json({
      success: true,
      balance: newBalance,
      amount,
      message: `Payment of ₹${amount} successful`
    });
  } catch (error) {
    console.error("Deduct balance error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Start server after DB connection
/**
 * GET /api/transactions/user
 * Get user transaction history (balance adds + payments sent)
 */
app.get("/api/transactions/user", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDB();
    
    // Get user's balance history
    const user = await db.collection('users').findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get payments made by this user (from vouchers collection — field is 'issuedTo')
    const payments = await db.collection('vouchers').find({ 
      issuedTo: userId 
    }).sort({ createdAt: -1 }).toArray();

    // Combine balance history and payments — deduplicate by voucherId
    const transactions = [];
    // Track voucherIds already added from the vouchers collection
    const addedVoucherIds = new Set(payments.map(p => p.voucherId));

    // Add balance additions (wallet top-ups); skip payment entries that are
    // already represented in the vouchers collection to avoid duplicates
    if (user.balanceHistory && Array.isArray(user.balanceHistory)) {
      user.balanceHistory.forEach(h => {
        // Skip deduction entries that are already in the vouchers collection
        if (h.type === 'payment' && h.voucherId && addedVoucherIds.has(h.voucherId)) return;
        transactions.push({
          id: `bal_${h.timestamp}`,
          type: h.type === 'add' ? 'credit' : 'debit',
          category: h.type === 'add' ? 'wallet_load' : 'payment',
          amount: h.amount,
          description: h.type === 'add' ? 'Added to wallet' : 'Payment sent',
          timestamp: h.timestamp,
          balance: h.newBalance
        });
      });
    }

    // Add payments from vouchers collection
    payments.forEach(p => {
      transactions.push({
        id: p.voucherId,
        type: 'debit',
        category: 'payment',
        amount: p.amount,
        description: `Paid to ${p.merchantName || p.merchantId}`,
        merchantId: p.merchantId,
        timestamp: p.createdAt,
        status: p.status
      });
    });

    // Sort by timestamp (newest first)
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

/**
 * GET /api/transactions/merchant
 * Get merchant transaction history (payments received)
 */
app.get("/api/transactions/merchant", authMiddleware, async (req, res) => {
  try {
    const merchantId = req.user.merchantId || req.user.userId;
    const db = getDB();

    // Get payments received by this merchant
    const payments = await db.collection('vouchers').find({ 
      merchantId: merchantId 
    }).sort({ createdAt: -1 }).toArray();

    const transactions = payments.map(p => ({
      id: p.voucherId,
      type: 'credit',
      category: 'payment_received',
      amount: p.amount,
      description: `Payment from ${p.payerName || p.payerId || 'Customer'}`,
      payerId: p.payerId,
      payerName: p.payerName,
      timestamp: p.createdAt || p.syncedAt,
      status: p.status
    }));

    // Calculate totals
    const totalReceived = transactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      transactions,
      count: transactions.length,
      totalReceived
    });
  } catch (error) {
    console.error("Get merchant transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`✅ Offline Pay backend running on:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`   - Network: http://192.168.0.116:${PORT}`);
    console.log(`✅ Accessible from phone at: http://192.168.0.116:${PORT}`);
    console.log(`✅ Server is ready and listening for connections...`);
    console.log(`✅ Process ID: ${process.pid}`);
    
    // Log every 5 seconds to show server is alive
    setInterval(() => {
      console.log(`💚 Server still running at ${new Date().toLocaleTimeString()}`);
    }, 5000);
  });
  
  // Keep the process alive
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
  });
  
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
