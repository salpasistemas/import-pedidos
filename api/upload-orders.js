// api/upload-orders.js - Put this in your GitHub repo
export default async function handler(req, res) {
  // Enable CORS for your GitHub Pages domain
  res.setHeader('Access-Control-Allow-Origin', 'https://salpasistemas.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Invalid orders data' });
    }

    // Your Odoo credentials stored as Vercel environment variables
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

    // Authenticate with Odoo
    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          db: ODOO_DB,
          login: ODOO_USERNAME,
          password: ODOO_PASSWORD
        }
      })
    });

    const authData = await authResponse.json();
    
    if (!authData.result || !authData.result.uid) {
      throw new Error('Odoo authentication failed');
    }

    const sessionId = authData.result.session_id;
    const results = [];

    // Process each order
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      
      try {
        const orderResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call", 
            params: {
              model: "sale.order",
              method: "create",
              args: [order],
              kwargs: {}
            }
          })
        });

        const orderData = await orderResponse.json();
        
        if (orderData.error) {
          results.push({ 
            index: i, 
            success: false, 
            error: orderData.error.message 
          });
        } else {
          results.push({ 
            index: i, 
            success: true, 
            orderId: orderData.result 
          });
        }
      } catch (error) {
        results.push({ 
          index: i, 
          success: false, 
          error: error.message 
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      results: results,
      processed: orders.length,
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    console.error('Error processing orders:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
