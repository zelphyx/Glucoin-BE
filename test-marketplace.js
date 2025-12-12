const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMarketplace() {
  try {
    // 1. Login
    console.log('🔐 Step 1: Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'john.doe@gmail.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login success!\n');

    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Get Products
    console.log('🛍️  Step 2: Get all products...');
    const productsResponse = await axios.get(`${BASE_URL}/marketplace/products`);
    console.log(`✅ Found ${productsResponse.data.data.length} products`);
    console.log('First product:', productsResponse.data.data[0].name, '- Rp', productsResponse.data.data[0].final_price);
    
    const firstProduct = productsResponse.data.data[0];

    // 3. Add to Cart
    console.log('\n🛒 Step 3: Add to cart...');
    const cartResponse = await axios.post(
      `${BASE_URL}/marketplace/cart`,
      {
        product_id: firstProduct.id,
        quantity: 2
      },
      { headers }
    );
    console.log('✅ Added to cart!');
    console.log('Cart total:', 'Rp', cartResponse.data.data.total);
    console.log('Items in cart:', cartResponse.data.data.total_quantity);

    // 4. Create Shipping Address
    console.log('\n📍 Step 4: Create shipping address...');
    const addressResponse = await axios.post(
      `${BASE_URL}/marketplace/addresses`,
      {
        recipient_name: 'John Doe',
        phone_number: '+628111222333',
        address: 'Jl. Sudirman No. 123, RT 01/RW 02',
        city: 'Jakarta Selatan',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: true
      },
      { headers }
    );
    console.log('✅ Shipping address created!');
    console.log('Address ID:', addressResponse.data.data.id);

    const addressId = addressResponse.data.data.id;

    // 5. Create Order
    console.log('\n📦 Step 5: Create order...');
    const orderResponse = await axios.post(
      `${BASE_URL}/marketplace/orders`,
      {
        shipping_address_id: addressId,
        shipping_cost: 15000,
        courier: 'JNE',
        notes: 'Tolong dibungkus rapi'
      },
      { headers }
    );
    
    console.log('✅ Order created successfully!');
    console.log('\n📋 Order Details:');
    console.log('   - Order Number:', orderResponse.data.order.order_number);
    console.log('   - Subtotal:', 'Rp', orderResponse.data.order.subtotal);
    console.log('   - Shipping:', 'Rp', orderResponse.data.order.shipping_cost);
    console.log('   - Total:', 'Rp', orderResponse.data.order.total_amount);
    console.log('   - Status:', orderResponse.data.order.status);
    
    console.log('\n💳 Payment Info:');
    console.log('   - Order ID:', orderResponse.data.payment.order_id);
    console.log('   - Snap Token:', orderResponse.data.payment.snap_token);
    console.log('   - Payment URL:', orderResponse.data.payment.snap_redirect_url);

    // 6. Get Orders
    console.log('\n📜 Step 6: Get my orders...');
    const ordersResponse = await axios.get(
      `${BASE_URL}/marketplace/orders`,
      { headers }
    );
    console.log('✅ Found', ordersResponse.data.data.length, 'orders');

    console.log('\n✅ All marketplace tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testMarketplace();
