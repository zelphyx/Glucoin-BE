import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Controller for handling Midtrans payment redirects
 * Route: /payment (without 's') to match Midtrans callback URLs
 */
@Controller('payment')
export class PaymentRedirectController {
  constructor(private configService: ConfigService) {}

  // Get frontend URL from config or use default
  private getFrontendUrl(): string {
    return this.configService.get('FRONTEND_URL', 'https://glucoin.mentorit.my.id');
  }

  /**
   * Payment finish page - redirect from Midtrans after successful payment
   * Redirects user to frontend order status page
   */
  @Get('finish')
  paymentFinish(@Query() query: any, @Res() res: Response) {
    const orderId = query.order_id || '';
    // transactionStatus and statusCode available in query if needed for logging

    // Extract the order UUID from the Midtrans order_id
    // Format: GLUCOIN-MKT-{uuid first 8 chars}-{timestamp} or GLUCOIN-{bookingId first 8 chars}-{timestamp}
    let redirectPath = '/belanja';
    
    if (orderId.includes('-MKT-')) {
      // Marketplace order - redirect to order status page
      // We need to get the actual order ID from database, for now redirect to orders list
      redirectPath = '/belanja?payment=success&order_id=' + encodeURIComponent(orderId);
    } else if (orderId.startsWith('GLUCOIN-')) {
      // Booking payment - redirect to booking page
      redirectPath = '/booking-dokter?payment=success&order_id=' + encodeURIComponent(orderId);
    }

    const frontendUrl = this.getFrontendUrl();
    return res.redirect(`${frontendUrl}${redirectPath}`);
  }

  /**
   * Payment pending page - redirect from Midtrans when payment not completed
   */
  @Get('pending')
  paymentPending(@Query() query: any, @Res() res: Response) {
    const orderId = query.order_id || '';

    let redirectPath = '/belanja';
    
    if (orderId.includes('-MKT-')) {
      redirectPath = '/belanja?payment=pending&order_id=' + encodeURIComponent(orderId);
    } else if (orderId.startsWith('GLUCOIN-')) {
      redirectPath = '/booking-dokter?payment=pending&order_id=' + encodeURIComponent(orderId);
    }

    const frontendUrl = this.getFrontendUrl();
    return res.redirect(`${frontendUrl}${redirectPath}`);
  }

  /**
   * Payment error page - redirect from Midtrans when payment failed
   */
  @Get('error')
  paymentError(@Query() query: any, @Res() res: Response) {
    const orderId = query.order_id || '';

    let redirectPath = '/belanja';
    
    if (orderId.includes('-MKT-')) {
      redirectPath = '/belanja?payment=error&order_id=' + encodeURIComponent(orderId);
    } else if (orderId.startsWith('GLUCOIN-')) {
      redirectPath = '/booking-dokter?payment=error&order_id=' + encodeURIComponent(orderId);
    }

    const frontendUrl = this.getFrontendUrl();
    return res.redirect(`${frontendUrl}${redirectPath}`);
  }
}
