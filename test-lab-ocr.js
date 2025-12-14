// test-lab-ocr.js
// Usage: node test-lab-ocr.js <image_path>
// Example: node test-lab-ocr.js ./sample-lab.jpg

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Ganti dengan JWT token kamu (login dulu untuk dapat token)
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

async function testLabOCR(imagePath) {
  if (!imagePath) {
    console.log('Usage: node test-lab-ocr.js <image_path>');
    console.log('Example: node test-lab-ocr.js ./sample-lab.jpg');
    process.exit(1);
  }

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log(`📤 Uploading: ${imagePath}`);
  console.log(`🌐 API URL: ${API_URL}/lab-results/scan`);

  try {
    // Read file
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    const mimeType = getMimeType(imagePath);

    // Create FormData
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('image', fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    });

    // Send request
    const response = await fetch(`${API_URL}/lab-results/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ OCR Success!\n');
      console.log('='.repeat(50));
      
      const data = result.data;
      
      // Print Gula Darah
      if (data.gula_darah) {
        console.log('\n🩸 GULA DARAH:');
        printValue('GDP (Puasa)', data.gula_darah.gdp);
        printValue('GD2PP (2 Jam PP)', data.gula_darah.gd2pp);
        printValue('GDS (Sewaktu)', data.gula_darah.gds);
        printValue('HbA1c', data.gula_darah.hba1c);
      }

      // Print Profil Lipid
      if (data.profil_lipid) {
        console.log('\n💉 PROFIL LIPID:');
        printValue('Kolesterol Total', data.profil_lipid.cholesterol_total);
        printValue('LDL', data.profil_lipid.ldl);
        printValue('HDL', data.profil_lipid.hdl);
        printValue('Trigliserida', data.profil_lipid.triglycerides);
      }

      // Print Fungsi Ginjal
      if (data.fungsi_ginjal) {
        console.log('\n🫘 FUNGSI GINJAL:');
        printValue('Kreatinin', data.fungsi_ginjal.creatinine);
        printValue('Ureum', data.fungsi_ginjal.urea);
        printValue('Asam Urat', data.fungsi_ginjal.uric_acid);
      }

      // Print Fungsi Hati
      if (data.fungsi_hati) {
        console.log('\n🫀 FUNGSI HATI:');
        printValue('SGOT', data.fungsi_hati.sgot);
        printValue('SGPT', data.fungsi_hati.sgpt);
      }

      // Print Darah Lengkap
      if (data.darah_lengkap) {
        console.log('\n🔬 DARAH LENGKAP:');
        printValue('Hemoglobin', data.darah_lengkap.hemoglobin);
        printValue('Hematokrit', data.darah_lengkap.hematocrit);
        printValue('Leukosit', data.darah_lengkap.leukocytes);
        printValue('Trombosit', data.darah_lengkap.platelets);
        printValue('Eritrosit', data.darah_lengkap.erythrocytes);
      }

      // Print Tekanan Darah
      if (data.tekanan_darah) {
        console.log('\n❤️ TEKANAN DARAH:');
        console.log(`   ${data.tekanan_darah.display}`);
      }

      console.log('\n' + '='.repeat(50));
      console.log(`📊 Confidence Score: ${(data.confidence_score * 100).toFixed(1)}%`);
      console.log(`🏥 Lab: ${data.lab_name || 'N/A'}`);
      console.log(`📅 Tanggal: ${data.test_date || 'N/A'}`);

    } else {
      console.error('\n❌ Error:', result.message || 'Unknown error');
      console.error('Details:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

function printValue(label, data) {
  if (!data) return;
  
  const status = data.status || '';
  const statusEmoji = {
    'NORMAL': '✅',
    'TINGGI': '⚠️',
    'RENDAH': '⚠️',
    'KRITIS': '🚨',
  }[status] || '';
  
  console.log(`   ${label}: ${data.value} ${data.unit} ${statusEmoji} ${status}`);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

// Run
const imagePath = process.argv[2];
testLabOCR(imagePath);
