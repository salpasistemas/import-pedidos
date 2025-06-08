// api/upload-orders.js
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
    console.log('Request received:', req.method);
    console.log('Request body:', req.body);
    
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders)) {
      console.log('Invalid orders data:', orders);
      return res.status(400).json({ error: 'Invalid orders data' });
    }

    // Check environment variables
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

    console.log('Environment check:', {
      ODOO_URL: ODOO_URL ? 'SET' : 'MISSING',
      ODOO_DB: ODOO_DB ? 'SET' : 'MISSING',
      ODOO_USERNAME: ODOO_USERNAME ? 'SET' : 'MISSING',
      ODOO_PASSWORD: ODOO_PASSWORD ? 'SET' : 'MISSING'
    });

    if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_PASSWORD) {
      return res.status(500).json({ 
        error: 'Missing Odoo configuration. Check environment variables.' 
      });
    }

    console.log('Attempting Odoo authentication...');
    
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

    if (!authResponse.ok) {
      console.log('Auth response not ok:', authResponse.status);
      throw new Error(`Odoo server responded with status: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('Auth response:', authData);
    
    if (!authData.result || !authData.result.uid) {
      console.log('Authentication failed:', authData);
      throw new Error('Odoo authentication failed - invalid credentials or database');
    }

    const sessionId = authData.result.session_id;
    console.log('Authentication successful, processing orders...');
    
    const results = [];

    // Process each order
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`Processing order ${i + 1}:`, order);
      
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
        console.log(`Order ${i + 1} response:`, orderData);
        
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
        console.log(`Error processing order ${i + 1}:`, error);
        results.push({ 
          index: i, 
          success: false, 
          error: error.message 
        });
      }
    }

    const response = { 
      success: true, 
      results: results,
      processed: orders.length,
      successful: results.filter(r => r.success).length
    };
    
    console.log('Final response:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
