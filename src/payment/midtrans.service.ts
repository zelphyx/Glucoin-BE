import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require('midtrans-client');

@Injectable()
export class MidtransService implements OnModuleInit {
  private snap: any;
  private core: any;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY');
    const clientKey = this.configService.get<string>('MIDTRANS_CLIENT_KEY');

    // Snap API untuk create transaction
    this.snap = new midtransClient.Snap({
      isProduction: false, // Sandbox mode
      serverKey: serverKey,
      clientKey: clientKey,
    });

    // Core API untuk check status, etc
    this.core = new midtransClient.CoreApi({
      isProduction: false,
      serverKey: serverKey,
      clientKey: clientKey,
    });
  }

  async createTransaction(params: {
    orderId: string;
    grossAmount: number;
    customerDetails: {
      firstName: string;
      lastName?: string;
      email: string;
      phone?: string;
    };
    itemDetails: {
      id: string;
      price: number;
      quantity: number;
      name: string;
    }[];
  }) {
    const parameter = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      customer_details: {
        first_name: params.customerDetails.firstName,
        last_name: params.customerDetails.lastName || '',
        email: params.customerDetails.email,
        phone: params.customerDetails.phone || '',
      },
      item_details: params.itemDetails,
      callbacks: {
        finish: `${this.configService.get('APP_URL', 'http://localhost:3000')}/payment/finish`,
      },
    };

    const transaction = await this.snap.createTransaction(parameter);
    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  }

  async getTransactionStatus(orderId: string) {
    return await this.core.transaction.status(orderId);
  }

  async cancelTransaction(orderId: string) {
    return await this.core.transaction.cancel(orderId);
  }

  async expireTransaction(orderId: string) {
    return await this.core.transaction.expire(orderId);
  }

  // Verify notification signature
  verifySignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    serverKey: string,
    signatureKey: string,
  ): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex');
    return hash === signatureKey;
  }
}
