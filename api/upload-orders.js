// api/upload-orders.js
import xmlrpc from 'xmlrpc';

export default async function handler(req, res) {
  // CORS
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
      return res.status(400).json({ success: false, error: 'Invalid orders array' });
    }

    // Leer variables de entorno
    const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD } = process.env;
    const missing = ['ODOO_URL','ODOO_DB','ODOO_USERNAME','ODOO_PASSWORD'].filter(v => !process.env[v]);
    if (missing.length) {
      return res.status(500).json({
        success: false,
        error: `Missing env vars: ${missing.join(', ')}`
      });
    }

    console.log('=== ODOO AUTH ===');
    // 1) Autenticación RPC
    const common = xmlrpc.createSecureClient({ url: `${ODOO_URL}/xmlrpc/2/common` });
    const uid = await new Promise((resolve, reject) => {
      common.methodCall('authenticate', [
        ODOO_DB,
        ODOO_USERNAME,
        ODOO_PASSWORD,
        {}
      ], (err, userId) => err ? reject(err) : resolve(userId));
    });
    console.log('✅ Authenticated UID:', uid);

    // 2) Cliente para llamadas de objeto
    const models = xmlrpc.createSecureClient({ url: `${ODOO_URL}/xmlrpc/2/object` });

    // 3) Procesar cada order
    console.log(`=== PROCESSING ${orders.length} ORDERS ===`);
    const results = [];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`-- Order ${i+1}`, order);
      try {
        const orderId = await new Promise((resolve, reject) => {
          models.methodCall('execute_kw', [
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            'sale.order',
            'create',
            [order]
          ], (err, id) => err ? reject(err) : resolve(id));
        });
        console.log(`✅ Created sale.order ID=${orderId}`);
        results.push({ index: i, success: true, orderId });
      } catch (err) {
        console.error(`❌ Order ${i+1} error:`, err.message);
        results.push({ index: i, success: false, error: err.message });
      }
    }

    // 4) Respuesta final
    const successful = results.filter(r => r.success).length;
    return res.status(200).json({
      success: true,
      processed: orders.length,
      successful,
      results,
      message: `Processed ${successful} of ${orders.length} orders`
    });

  } catch (error) {
    console.error('=== HANDLER ERROR ===', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check server logs'
    });
  }
}
