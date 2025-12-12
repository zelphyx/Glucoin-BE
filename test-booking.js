const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testBooking() {
  try {
    // 1. Login dulu
    console.log('🔐 Step 1: Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'john.doe@gmail.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login success!');
    console.log('Token:', token.substring(0, 30) + '...\n');
    console.log('Full login response:', JSON.stringify(loginResponse.data, null, 2).substring(0, 300));

    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Get doctors
    console.log('\n👨‍⚕️ Step 2: Get available doctors...');
    const doctorsResponse = await axios.get(`${BASE_URL}/doctors`, { headers });
    
    const doctors = doctorsResponse.data.data || doctorsResponse.data;
    console.log('Doctors response:', JSON.stringify(doctorsResponse.data, null, 2).substring(0, 500));
    
    const firstDoctor = doctors[0];
    console.log('\n✅ Found doctor:');
    console.log(`   - Name: ${firstDoctor.user?.full_name || firstDoctor.full_name}`);
    console.log(`   - ID: ${firstDoctor.id}\n`);

    // 3. Get available slots
    console.log('📅 Step 3: Check available slots...');
    const slotsResponse = await axios.get(
      `${BASE_URL}/bookings/available-slots/${firstDoctor.id}?date=2025-12-16`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Available slots:', JSON.stringify(slotsResponse.data, null, 2).substring(0, 300) + '...\n');

    // 4. Create booking
    console.log('🎫 Step 4: Creating booking...');
    const slots = slotsResponse.data.slots || slotsResponse.data.data || slotsResponse.data;
    const firstSlot = slots[0];
    console.log('Using slot:', firstSlot);
    
    // Calculate end_time (add duration_minutes to start_time)
    const [hours, mins] = firstSlot.time_slot.split(':').map(Number);
    const endHours = hours + Math.floor((mins + firstSlot.duration_minutes) / 60);
    const endMins = (mins + firstSlot.duration_minutes) % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    
    const bookingResponse = await axios.post(
      `${BASE_URL}/bookings`,
      {
        doctor_id: firstDoctor.id,
        schedule_id: firstSlot.id,
        booking_date: '2025-12-16',
        start_time: firstSlot.time_slot,
        end_time: endTime,
        duration_minutes: firstSlot.duration_minutes,
        consultation_type: 'ONLINE',
        consultation_fee: 200000,
        notes: 'Test booking - konsultasi diabetes'
      },
      { headers }
    );
    
    console.log('✅ Booking created successfully!');
    console.log(JSON.stringify(bookingResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

testBooking();
