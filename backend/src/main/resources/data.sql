INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Laptop Pro 15"', 'High-performance laptop with 16GB RAM', 'Electronics', 25, 1299.99, 'IN_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 'Electronics', 7, 29.99, 'LOW_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Wireless Mouse');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'USB-C Hub', '7-in-1 USB-C hub with HDMI and SD card reader', 'Electronics', 0, 49.99, 'OUT_OF_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'USB-C Hub');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Office Chair', 'Ergonomic mesh office chair with lumbar support', 'Furniture', 12, 349.00, 'IN_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Office Chair');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Standing Desk', 'Electric height-adjustable standing desk 160x80cm', 'Furniture', 5, 699.00, 'LOW_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Standing Desk');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Ballpoint Pens (Box)', 'Box of 50 black ballpoint pens', 'Stationery', 30, 8.99, 'IN_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ballpoint Pens (Box)');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'A4 Paper Ream', '500 sheets of 80gsm A4 white paper', 'Stationery', 3, 5.49, 'LOW_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'A4 Paper Ream');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Monitor 27"', '4K IPS monitor with USB-C connectivity', 'Electronics', 18, 499.00, 'IN_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Monitor 27"');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Mechanical Keyboard', 'TKL mechanical keyboard with Cherry MX switches', 'Electronics', 9, 89.99, 'LOW_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mechanical Keyboard');

INSERT INTO products (name, description, category, quantity, price, status)
SELECT 'Webcam HD', '1080p webcam with built-in microphone', 'Electronics', 0, 79.99, 'OUT_OF_STOCK'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Webcam HD');
