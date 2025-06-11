// api/upload-orders.js
export default async function handler(req, res) {
  // Bloque de carga segura de xmlrpc
  let xmlrpc;
  try {
    xmlrpc = require('xmlrpc');
  } catch (err) {
    console.error('Error cargando xmlrpc:', err);
    return res.status(500).json({
      success: false,
      error: 'No se pudo cargar módulo xmlrpc',
      details: err.message
    });
  }

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

    console.log('=== ODOO CONNECTION INFO ===');
    console.log('URL:', ODOO_URL);
    console.log('DB:', ODOO_DB);
    console.log('Username:', ODOO_USERNAME);

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
    
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed - invalid credentials'
      });
    }
    
    console.log('✅ Authenticated UID:', uid);

    // 2) Cliente para llamadas de objeto
    const models = xmlrpc.createSecureClient({ url: `${ODOO_URL}/xmlrpc/2/object` });

    // 2.5) Verificar permisos del usuario
    console.log('=== CHECKING USER PERMISSIONS ===');
    try {
      const canCreate = await new Promise((resolve, reject) => {
        models.methodCall('execute_kw', [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          'sale.order',
          'check_access_rights',
          ['create']
        ], (err, result) => err ? reject(err) : resolve(result));
      });
      console.log('Create permission check result:', canCreate);
      
      if (!canCreate) {
        return res.status(403).json({
          success: false,
          error: 'User does not have permission to create sale orders'
        });
      }
    } catch (permError) {
      console.error('Permission check error:', permError);
      return res.status(403).json({
        success: false,
        error: 'Permission check failed: ' + permError.message
      });
    }

    // 3) Procesar cada order (aunque típicamente será solo una)
    console.log(`=== PROCESSING ${orders.length} ORDERS ===`);
    const results = [];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`-- Processing Order ${i+1}:`, JSON.stringify(order, null, 2));
      
      try {
        // Validar que la orden tenga líneas
        if (!order.order_line || order.order_line.length === 0) {
          throw new Error('Order must have at least one order line');
        }

        // Prepare order data with required fields
        const orderData = {
          partner_id: order.partner_id || 1, // Default partner if not specified
          user_id: false,
          order_line: order.order_line.map(line => [0, 0, {
            product_id: line.product_id || 1,
            product_uom_qty: line.product_uom_qty || 1,
            price_unit: line.price_unit || 0,
            name: line.name || 'Imported Product' // Product name is often required
          }]),
          note: order.note || 'Imported from Excel - AUX_IMPORT sheet',
          state: 'draft' // Ensure it starts as draft
        };
        
        console.log(`-- Prepared Order Data ${i+1}:`, JSON.stringify(orderData, null, 2));
        console.log(`-- Order has ${orderData.order_line.length} lines`);
        
        const orderId = await new Promise((resolve, reject) => {
          models.methodCall('execute_kw', [
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            'sale.order',
            'create',
            [orderData]
          ], (err, id) => {
            if (err) {
              console.error(`Order ${i+1} creation error:`, err);
              reject(err);
            } else {
              resolve(id);
            }
          });
        });
        
        console.log(`✅ Created sale.order ID=${orderId} with ${orderData.order_line.length} lines`);
        results.push({ 
          index: i, 
          success: true, 
          orderId,
          orderLines: orderData.order_line.length
        });
        
      } catch (err) {
        console.error(`❌ Order ${i+1} error:`, err.message);
        console.error('Full error details:', err);
        results.push({ 
          index: i, 
          success: false, 
          error: err.message,
          details: err.faultString || err.toString()
        });
      }
    }

    // 4) Respuesta final
    const successful = results.filter(r => r.success).length;
    const totalLines = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.orderLines || 0), 0);
    
    return res.status(200).json({
      success: successful > 0,
      processed: orders.length,
      successful,
      results,
      totalOrderLines: totalLines,
      message: successful > 0 
        ? `Successfully created ${successful} order(s) with ${totalLines} total lines`
        : 'No orders were created successfully',
      uid: uid // Include UID for debugging
    });

  } catch (error) {
    console.error('=== HANDLER ERROR ===', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack || 'Check server logs'
    });
  }
}
