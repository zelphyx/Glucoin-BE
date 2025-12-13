// src/reminder/fonnte.service.ts
import { Injectable, Logger } from '@nestjs/common';

interface FonnteMessage {
  target: string; // Nomor WhatsApp (08xxx atau 628xxx)
  message: string;
  delay?: number;
  countryCode?: string;
}

interface FonnteResponse {
  status: boolean;
  detail?: string;
  id?: string;
}

@Injectable()
export class FonnteService {
  private readonly logger = new Logger(FonnteService.name);
  private readonly FONNTE_URL = 'https://api.fonnte.com/send';
  private readonly FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'FtSBnZPUSxTQNtWhHKKZ';

  /**
   * Send WhatsApp message via Fonnte
   */
  async sendMessage(target: string, message: string): Promise<FonnteResponse> {
    try {
      // Format nomor (remove +, spaces, etc)
      const formattedTarget = this.formatPhoneNumber(target);

      const response = await fetch(this.FONNTE_URL, {
        method: 'POST',
        headers: {
          'Authorization': this.FONNTE_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: formattedTarget,
          message: message,
          countryCode: '62', // Indonesia
        }),
      });

      const result = await response.json();

      if (result.status) {
        this.logger.log(`✅ Message sent to ${formattedTarget}`);
      } else {
        this.logger.error(`❌ Failed to send message: ${result.detail}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`❌ Fonnte API error: ${error.message}`);
      return { status: false, detail: error.message };
    }
  }

  /**
   * Send bulk messages
   */
  async sendBulkMessages(messages: FonnteMessage[]): Promise<FonnteResponse[]> {
    const results: FonnteResponse[] = [];

    for (const msg of messages) {
      const result = await this.sendMessage(msg.target, msg.message);
      results.push(result);

      // Delay between messages to avoid rate limiting
      if (msg.delay) {
        await new Promise((resolve) => setTimeout(resolve, msg.delay));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Default 1 second
      }
    }

    return results;
  }

  /**
   * Send glucose reminder
   */
  async sendGlucoseReminder(target: string, userName: string): Promise<FonnteResponse> {
    const message = `🩸 *Reminder Cek Gula Darah*

Halo ${userName}! 👋

Sudah waktunya cek gula darah kamu. Jangan lupa catat hasilnya di aplikasi Glucoin ya!

💡 Tips: Konsistensi dalam monitoring adalah kunci kontrol diabetes yang baik.

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send medication reminder
   */
  async sendMedicationReminder(
    target: string,
    userName: string,
    medicationName: string,
    dosage: string,
  ): Promise<FonnteResponse> {
    const message = `💊 *Reminder Minum Obat*

Halo ${userName}! 👋

Sudah waktunya minum obat:
📌 *${medicationName}*
💉 Dosis: ${dosage}

Jangan lupa minum obatnya tepat waktu ya! 🕐

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send insulin reminder
   */
  async sendInsulinReminder(
    target: string,
    userName: string,
    insulinType?: string,
    dosage?: string,
  ): Promise<FonnteResponse> {
    const message = `💉 *Reminder Insulin*

Halo ${userName}! 👋

Sudah waktunya suntik insulin${insulinType ? ` (${insulinType})` : ''}${dosage ? ` - ${dosage}` : ''}.

⚠️ Pastikan:
• Cek gula darah sebelum suntik
• Gunakan jarum baru
• Rotasi area suntik

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send exercise reminder
   */
  async sendExerciseReminder(target: string, userName: string): Promise<FonnteResponse> {
    const message = `🏃 *Reminder Olahraga*

Halo ${userName}! 👋

Yuk luangkan waktu untuk olahraga hari ini! 💪

Rekomendasi untuk penderita diabetes:
• Jalan kaki 30 menit
• Bersepeda santai
• Senam ringan
• Berenang

⚠️ Jangan lupa cek gula darah sebelum & sesudah olahraga!

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    target: string,
    userName: string,
    doctorName: string,
    appointmentDate: string,
    appointmentTime: string,
  ): Promise<FonnteResponse> {
    const message = `📅 *Reminder Jadwal Konsultasi*

Halo ${userName}! 👋

Jangan lupa jadwal konsultasi kamu:
👨‍⚕️ Dokter: *${doctorName}*
📆 Tanggal: ${appointmentDate}
🕐 Jam: ${appointmentTime}

Persiapkan:
• Hasil cek gula darah terakhir
• Catatan keluhan
• Obat yang sedang dikonsumsi

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send custom reminder
   */
  async sendCustomReminder(
    target: string,
    userName: string,
    title: string,
    customMessage: string,
  ): Promise<FonnteResponse> {
    const message = `🔔 *${title}*

Halo ${userName}! 👋

${customMessage}

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send high glucose alert
   */
  async sendHighGlucoseAlert(
    target: string,
    userName: string,
    glucoseLevel: number,
  ): Promise<FonnteResponse> {
    const message = `⚠️ *PERINGATAN: Gula Darah Tinggi*

Halo ${userName},

Hasil pengukuran gula darah kamu:
🩸 *${glucoseLevel} mg/dL*

Ini di atas batas normal! Segera:
1. Minum air putih yang cukup
2. Jangan makan makanan manis
3. Istirahat
4. Jika > 300 mg/dL, segera ke dokter!

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Send low glucose alert (Hypoglycemia)
   */
  async sendLowGlucoseAlert(
    target: string,
    userName: string,
    glucoseLevel: number,
  ): Promise<FonnteResponse> {
    const message = `🚨 *PERINGATAN: Gula Darah Rendah (Hipoglikemia)*

Halo ${userName},

Hasil pengukuran gula darah kamu:
🩸 *${glucoseLevel} mg/dL*

SEGERA lakukan:
1. Makan/minum yang manis (permen, jus)
2. Tunggu 15 menit, cek lagi
3. Jika masih rendah, ulangi
4. Jika < 54 mg/dL, segera ke UGD!

⚠️ Jangan menyetir atau beraktivitas berat!

_Pesan otomatis dari Glucoin_`;

    return this.sendMessage(target, message);
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 62
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }

    // If doesn't start with 62, add it
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }

    return cleaned;
  }
}
