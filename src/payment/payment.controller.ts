import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Create payment for a booking
  @Post('create/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  createPayment(@Param('bookingId') bookingId: string) {
    return this.paymentService.createPayment(bookingId);
  }

  // Midtrans webhook notification (no auth, Midtrans will call this)
  @Post('notification')
  handleNotification(@Body() notification: any) {
    return this.paymentService.handleNotification(notification);
  }

  // Get payment status by order ID
  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId);
  }

  // Get payment by booking ID
  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  getPaymentByBookingId(@Param('bookingId') bookingId: string) {
    return this.paymentService.getPaymentByBookingId(bookingId);
  }

  // Get all booking payment history for current user
  @Get('history/booking')
  @UseGuards(JwtAuthGuard)
  getBookingPaymentHistory(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.paymentService.getBookingPaymentHistory(user.id, status);
  }

  // Get all marketplace payment history for current user
  @Get('history/marketplace')
  @UseGuards(JwtAuthGuard)
  getMarketplacePaymentHistory(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.paymentService.getMarketplacePaymentHistory(user.id, status);
  }

  // Get all payment history (booking + marketplace)
  @Get('history')
  @UseGuards(JwtAuthGuard)
  getAllPaymentHistory(
    @CurrentUser() user: any,
    @Query('type') type?: 'booking' | 'marketplace' | 'all',
    @Query('status') status?: string,
  ) {
    return this.paymentService.getAllPaymentHistory(user.id, type, status);
  }

  // Cancel payment
  @Post('cancel/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  cancelPayment(@Param('orderId') orderId: string) {
    return this.paymentService.cancelPayment(orderId);
  }

  // Payment finish page (redirect from Midtrans)
  @Get('finish')
  paymentFinish(@Req() req: any) {
    const orderId = req.query.order_id;
    const transactionStatus = req.query.transaction_status;
    
    return {
      success: true,
      message: 'Pembayaran berhasil!',
      order_id: orderId,
      status: transactionStatus,
    };
  }

  // Payment pending page (redirect from Midtrans when payment not completed)
  @Get('pending')
  paymentPending(@Req() req: any) {
    const orderId = req.query.order_id;
    const transactionStatus = req.query.transaction_status;
    
    return {
      success: true,
      message: 'Menunggu pembayaran. Silakan selesaikan pembayaran Anda.',
      order_id: orderId,
      status: transactionStatus || 'pending',
    };
  }

  // Payment error page (redirect from Midtrans when payment failed)
  @Get('error')
  paymentError(@Req() req: any) {
    const orderId = req.query.order_id;
    const transactionStatus = req.query.transaction_status;
    const statusMessage = req.query.status_message;
    
    return {
      success: false,
      message: 'Pembayaran gagal. Silakan coba lagi.',
      order_id: orderId,
      status: transactionStatus || 'error',
      error: statusMessage,
    };
  }
}
