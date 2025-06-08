// api/upload-orders.js
export default async function handler(req, res) {
  // Enhanced CORS configuration
  const allowedOrigins = [
    'https://salpasistemas.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500' // For local development
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== REQUEST START ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    // Validate request body
    if (!req.body) {
      console.log('ERROR: No request body');
      return res.status(400).json({ 
        success: false, 
        error: 'No request body provided' 
      });
    }

    const { orders } = req.body;
    
    if (!orders) {
      console.log('ERROR: No orders field in request');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing orders field in request body' 
      });
    }
    
    if (!Array.isArray(orders)) {
      console.log('ERROR: Orders is not an array:', typeof orders);
      return res.status(400).json({ 
        success: false, 
        error: 'Orders must be an array' 
      });
    }

    if (orders.length === 0) {
      console.log('ERROR: Empty orders array');
      return res.status(400).json({ 
        success: false, 
        error: 'Orders array is empty' 
      });
    }

    // Check environment variables
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_USERNAME = process.env.ODOO_USERNAME;
    const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

    console.log('=== ENVIRONMENT CHECK ===');
    console.log('ODOO_URL:', ODOO_URL ? `SET (${ODOO_URL})` : 'MISSING');
    console.log('ODOO_DB:', ODOO_DB ? `SET (${ODOO_DB})` : 'MISSING');
    console.log('ODOO_USERNAME:', ODOO_USERNAME ? `SET (${ODOO_USERNAME})` : 'MISSING');
    console.log('ODOO_PASSWORD:', ODOO_PASSWORD ? 'SET' : 'MISSING');

    const missingVars = [];
    if (!ODOO_URL) missingVars.push('ODOO_URL');
    if (!ODOO_DB) missingVars.push('ODOO_DB');
    if (!ODOO_USERNAME) missingVars.push('ODOO_USERNAME');
    if (!ODOO_PASSWORD) missingVars.push('ODOO_PASSWORD');

    if (missingVars.length > 0) {
      console.log('ERROR: Missing environment variables:', missingVars);
      return res.status(500).json({ 
        success: false,
        error: `Missing environment variables: ${missingVars.join(', ')}. Please check your Vercel environment settings.`
      });
    }

    console.log('=== ODOO AUTHENTICATION ===');
    console.log('Attempting to authenticate with Odoo...');
    
    // Authenticate with Odoo
    const authUrl = `${ODOO_URL}/web/session/authenticate`;
    console.log('Auth URL:', authUrl);
    
    const authPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      }
    };
    
    console.log('Auth payload:', JSON.stringify(authPayload, null, 2));

    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload)
    });

    console.log('Auth response status:', authResponse.status);
    console.log('Auth response headers:', JSON.stringify([...authResponse.headers.entries()], null, 2));

    if (!authResponse.ok) {
      console.log('ERROR: Auth response not ok');
      const errorText = await authResponse.text();
      console.log('Auth error text:', errorText);
      throw new Error(`Odoo server responded with status: ${authResponse.status}. Response: ${errorText}`);
    }

    const authData = await authResponse.json();
    console.log('Auth response data:', JSON.stringify(authData, null, 2));
    
    if (authData.error) {
      console.log('ERROR: Odoo authentication error:', authData.error);
      throw new Error(`Odoo authentication error: ${JSON.stringify(authData.error)}`);
    }

    if (!authData.result) {
      console.log('ERROR: No result in auth response');
      throw new Error('No result in authentication response');
    }

    if (!authData.result.uid) {
      console.log('ERROR: Authentication failed - no UID');
      throw new Error('Authentication failed - invalid credentials or database name');
    }

    const sessionId = authData.result.session_id;
    const uid = authData.result.uid;
    console.log('Authentication successful!');
    console.log('UID:', uid);
    console.log('Session ID:', sessionId ? 'SET' : 'MISSING');
    
    console.log('=== PROCESSING ORDERS ===');
    console.log(`Processing ${orders.length} orders...`);
    
    const results = [];

    // Process each order
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`--- Processing order ${i + 1}/${orders.length} ---`);
      console.log('Order data:', JSON.stringify(order, null, 2));
      
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

        console.log('Order payload:', JSON.stringify(orderPayload, null, 2));

        const orderResponse = await fetch(orderUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify(orderPayload)
        });

        console.log(`Order ${i + 1} response status:`, orderResponse.status);

        if (!orderResponse.ok) {
          const errorText = await orderResponse.text();
          console.log(`Order ${i + 1} error text:`, errorText);
          throw new Error(`HTTP ${orderResponse.status}: ${errorText}`);
        }

        const orderData = await orderResponse.json();
        console.log(`Order ${i + 1} response data:`, JSON.stringify(orderData, null, 2));
        
        if (orderData.error) {
          console.log(`Order ${i + 1} Odoo error:`, orderData.error);
          results.push({ 
            index: i, 
            success: false, 
            error: orderData.error.message || JSON.stringify(orderData.error)
          });
        } else {
          console.log(`Order ${i + 1} created successfully with ID:`, orderData.result);
          results.push({ 
            index: i, 
            success: true, 
            orderId: orderData.result 
          });
        }
      } catch (error) {
        console.log(`ERROR processing order ${i + 1}:`, error.message);
        results.push({ 
          index: i, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successfulOrders = results.filter(r => r.success).length;
    const response = { 
      success: true, 
      results: results,
      processed: orders.length,
      successful: successfulOrders,
      message: `Successfully processed ${successfulOrders} of ${orders.length} orders`
    };
    
    console.log('=== FINAL RESPONSE ===');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('=== REQUEST END ===');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('=== HANDLER ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Check Vercel function logs for more information'
    });
  }
}
