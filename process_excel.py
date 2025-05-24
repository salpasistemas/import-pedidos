import os
import pandas as pd
import xmlrpc.client

ODOO_URL = os.environ['ODOO_URL']
ODOO_DB = os.environ['ODOO_DB']
ODOO_USER = os.environ['ODOO_USER']
ODOO_API_KEY = os.environ['ODOO_API_KEY']

# Conectar con Odoo
common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_API_KEY, {})
models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

# Buscar archivo Excel subido
archivos = [f for f in os.listdir('uploaded') if f.endswith('.xlsx')]
if not archivos:
    raise Exception("No se encontró ningún archivo Excel")

excel_file = os.path.join('uploaded', archivos[0])
df = pd.read_excel(excel_file)

# Suponemos columnas: Producto, Cantidad, Precio
lineas = []
for _, row in df.iterrows():
    nombre = row['Producto']
    cantidad = row['Cantidad']
    precio = row['Precio']

    productos = models.execute_kw(ODOO_DB, uid, ODOO_API_KEY,
        'product.product', 'search_read',
        [[['name', '=', nombre]]],
        {'fields': ['id'], 'limit': 1})

    if not productos:
        print(f"Producto no encontrado: {nombre}")
        continue

    lineas.append((0, 0, {
        'product_id': productos[0]['id'],
        'product_uom_qty': cantidad,
        'price_unit': precio
    }))

# Crear orden
orden_id = models.execute_kw(ODOO_DB, uid, ODOO_API_KEY,
    'sale.order', 'create', [{
        'partner_id': 1,  # Reemplazar por ID de cliente real
        'order_line': lineas
    }])

print(f"🧾 Orden creada en Odoo con ID: {orden_id}")
