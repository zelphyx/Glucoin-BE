// Test Resend API
require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log('🔑 API Key:', process.env.RESEND_API_KEY ? 'Set ✓' : 'Missing ✗');
  console.log('📤 From Email:', process.env.RESEND_FROM_EMAIL);
  console.log('\n🔄 Testing Resend API...\n');

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Glucoin <onboarding@resend.dev>',
      to: 'delivered@resend.dev', // Resend test email
      subject: 'Test Email - Glucoin OTP',
      html: '<h1>Test Email</h1><p>If you receive this, Resend is working!</p>',
    });

    if (error) {
      console.error('❌ Resend API Error:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Email sent successfully!');
    console.log('📬 Email ID:', data.id);
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error('Full error:', error);
  }
}

testResend();

