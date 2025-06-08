// api/upload-orders.js
export default async function handler(req, res) {
  // Enhanced CORS configuration
  const allowedOrigins = [
    'https://salpasistemas.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log('=== REQUEST START ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Validar body
    const { orders } = req.body || {};
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      throw new Error('Invalid orders array in request body');
    }

    // Variables de entorno
    const ODOO_URL      = process.env.ODOO_URL;
    const ODOO_DB       = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_PASSWORD = process.env.ODOO_PASSWORD;
    const missing = ['ODOO_URL','ODOO_DB','ODOO_USERNAME','ODOO_PASSWORD']
      .filter(v => !process.env[v]);
    if (missing.length) {
      return res.status(500).json({ success: false, error: `Missing env vars: ${missing.join(', ')}` });
    }

    console.log('=== ODOO AUTH ===');
    const authUrl = `${ODOO_URL}/web/session/authenticate`;
    const authPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD }
    };
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload)
    });

    if (!authResponse.ok) {
      const err = await authResponse.text();
      throw new Error(`Auth failed: ${authResponse.status} ${err}`);
    }

    // 1) capturar la cookie de sesión
    const rawSetCookie = authResponse.headers.get('set-cookie');
    if (!rawSetCookie) {
      throw new Error('No se recibió Set-Cookie de Odoo');
    }
    // 2) quedarnos solo con session_id=...
    const sessionCookie = rawSetCookie.split(';')[0];
    console.log('✅ sessionCookie:', sessionCookie);

    // 3) parsear el JSON
    const authData = await authResponse.json();
    if (!authData.result || !authData.result.uid) {
      throw new Error(`Auth error: ${JSON.stringify(authData.error || authData)}`);
    }
    console.log('✅ Authenticated UID:', authData.result.uid);

    // Procesar pedidos
    console.log(`=== PROCESSING ${orders.length} ORDERS ===`);
    const results = [];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`-- Order ${i+1}`, order);
      try {
        const orderUrl = `${ODOO_URL}/web/dataset/call_kw`;
        const orderPayload = {
          jsonrpc: "2.0",
          method: "call",
          params: {
            model: "sale.order",
            method: "create",
            args: [order],
            kwargs: {}
          }
        };
        const orderRes = await fetch(orderUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          body: JSON.stringify(orderPayload)
        });
        if (!orderRes.ok) {
          const text = await orderRes.text();
          throw new Error(`HTTP ${orderRes.status}: ${text}`);
        }
        const orderData = await orderRes.json();
        if (orderData.error) {
          throw new Error(orderData.error.message || JSON.stringify(orderData.error));
        }
        console.log(`✅ Created sale.order ID=${orderData.result}`);
        results.push({ index: i, success: true, orderId: orderData.result });
      } catch (e) {
        console.error(`❌ Order ${i+1} error:`, e.message);
        results.push({ index: i, success: false, error: e.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    return res.status(200).json({
      success: true,
      processed: orders.length,
      successful,
      results,
      message: `Processed ${successful} of ${orders.length}`
    });

  } catch (error) {
    console.error('=== HANDLER ERROR ===', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check function logs'
    });
  }
}
