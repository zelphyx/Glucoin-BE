/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MidtransService } from './midtrans.service';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private midtransService: MidtransService,
    private configService: ConfigService,
  ) {}

  // Create payment untuk booking
  async createPayment(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not pending payment');
    }

    // Check if payment already exists
    const existingPayment = await this.prisma.payment.findUnique({
      where: { booking_id: bookingId },
    });

    if (existingPayment && existingPayment.status === 'PENDING') {
      // Return existing payment
      return {
        payment: existingPayment,
        snap_token: existingPayment.snap_token,
        snap_redirect_url: existingPayment.snap_redirect_url,
      };
    }

    // Generate unique order ID
    const orderId = `GLUCOIN-${bookingId.slice(0, 8)}-${Date.now()}`;
    const amount = Number(booking.consultation_fee);

    // Create Midtrans transaction
    const nameParts = booking.user.full_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const midtransResponse = await this.midtransService.createTransaction({
      orderId: orderId,
      grossAmount: amount,
      customerDetails: {
        firstName: firstName,
        lastName: lastName,
        email: booking.user.email,
        phone: booking.user.phone_number || undefined,
      },
      itemDetails: [
        {
          id: booking.id,
          price: amount,
          quantity: 1,
          name: `Konsultasi dengan Dr. ${booking.doctor.user.full_name}`,
        },
      ],
    });

    // Calculate expiry time (24 hours from now)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        booking_id: bookingId,
        order_id: orderId,
        amount: amount,
        snap_token: midtransResponse.token,
        snap_redirect_url: midtransResponse.redirect_url,
        expiry_time: expiryTime,
        status: 'PENDING',
      },
    });

    return {
      payment: {
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        expiry_time: payment.expiry_time,
        status: payment.status,
      },
      snap_token: midtransResponse.token,
      snap_redirect_url: midtransResponse.redirect_url,
    };
  }

  // Handle Midtrans webhook notification
  async handleNotification(notification: any) {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;
    const paymentType = notification.payment_type;
    const transactionId = notification.transaction_id;

    console.log('📥 Booking Payment Notification:', {
      order_id: orderId,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      payment_type: paymentType,
    });

    // Verify signature
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY') || '';
    const isValid = this.midtransService.verifySignature(
      orderId,
      notification.status_code,
      notification.gross_amount,
      serverKey,
      notification.signature_key,
    );

    if (!isValid) {
      console.log('❌ Invalid signature');
      return {
        status: 'error',
        message: 'Invalid signature',
        order_id: orderId,
      };
    }

    // Determine payment status based on transaction status
    let paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' = 'PENDING';

    if (transactionStatus === 'capture') {
      paymentStatus = fraudStatus === 'accept' ? 'PAID' : 'PENDING';
    } else if (transactionStatus === 'settlement') {
      paymentStatus = 'PAID';
    } else if (transactionStatus === 'pending') {
      paymentStatus = 'PENDING';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      paymentStatus = 'FAILED';
    } else if (transactionStatus === 'expire') {
      paymentStatus = 'EXPIRED';
    } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
      paymentStatus = 'REFUNDED';
    }

    // Check if this is a marketplace order payment (order_id contains '-MKT-')
    if (orderId.includes('-MKT-')) {
      return this.handleMarketplacePaymentNotification(orderId, paymentStatus, paymentType, transactionId, transactionStatus, notification);
    }

    // Otherwise handle as booking payment
    return this.handleBookingPaymentNotification(orderId, paymentStatus, paymentType, transactionId, transactionStatus, notification);
  }

  // Handle marketplace order payment notification
  private async handleMarketplacePaymentNotification(
    orderId: string,
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED',
    paymentType: string,
    transactionId: string,
    transactionStatus: string,
    notification: any,
  ) {
    // Find order payment by order_payment_id
    const orderPayment = await this.prisma.orderPayment.findUnique({
      where: { order_payment_id: orderId },
      include: { order: true },
    });

    if (!orderPayment) {
      throw new NotFoundException(`Order payment with order_id ${orderId} not found`);
    }

    // Determine order status based on payment status
    let orderStatus: 'PENDING_PAYMENT' | 'PROCESSING' | 'CANCELLED' = 'PENDING_PAYMENT';
    if (paymentStatus === 'PAID') {
      orderStatus = 'PROCESSING';
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'EXPIRED') {
      orderStatus = 'CANCELLED';
    }

    // Update order payment record
    await this.prisma.orderPayment.update({
      where: { id: orderPayment.id },
      data: {
        payment_type: paymentType,
        transaction_id: transactionId,
        transaction_status: transactionStatus,
        transaction_time: notification.transaction_time
          ? new Date(notification.transaction_time)
          : null,
        va_number: notification.va_numbers?.[0]?.va_number || null,
        bank: notification.va_numbers?.[0]?.bank || notification.bank || null,
        status: paymentStatus,
        raw_response: JSON.stringify(notification),
      },
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: orderPayment.order_id },
      data: {
        status: orderStatus,
        payment_status: paymentStatus,
      },
    });

    return {
      message: 'Marketplace payment notification handled successfully',
      order_id: orderId,
      payment_status: paymentStatus,
      order_status: orderStatus,
    };
  }

  // Handle booking payment notification
  private async handleBookingPaymentNotification(
    orderId: string,
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED',
    paymentType: string,
    transactionId: string,
    transactionStatus: string,
    notification: any,
  ) {
    // Find payment by order_id
    const payment = await this.prisma.payment.findUnique({
      where: { order_id: orderId },
      include: { booking: true },
    });

    if (!payment) {
      console.log('❌ Payment not found for:', orderId);
      return {
        status: 'error',
        message: 'Payment not found',
        order_id: orderId,
      };
    }

    // Determine booking status
    let bookingStatus: 'PENDING_PAYMENT' | 'PENDING' | 'CANCELLED' | 'EXPIRED' = 'PENDING_PAYMENT';
    if (paymentStatus === 'PAID') {
      bookingStatus = 'PENDING';
    } else if (paymentStatus === 'FAILED') {
      bookingStatus = 'CANCELLED';
    } else if (paymentStatus === 'EXPIRED') {
      bookingStatus = 'EXPIRED';
    }

    console.log('📝 Updating payment:', { paymentStatus, bookingStatus });

    // Update payment record
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        payment_type: paymentType,
        transaction_id: transactionId,
        transaction_status: transactionStatus,
        transaction_time: notification.transaction_time
          ? new Date(notification.transaction_time)
          : null,
        va_number: notification.va_numbers?.[0]?.va_number || null,
        bank: notification.va_numbers?.[0]?.bank || notification.bank || null,
        status: paymentStatus,
        raw_response: JSON.stringify(notification),
      },
    });

    // Update booking status
    await this.prisma.booking.update({
      where: { id: payment.booking_id },
      data: {
        status: bookingStatus,
        payment_status: paymentStatus,
      },
    });

    console.log('✅ Booking payment updated successfully');

    return {
      status: 'ok',
      order_id: orderId,
      booking_id: payment.booking_id,
      payment_status: paymentStatus,
      booking_status: bookingStatus,
      transaction_status: transactionStatus,
      payment_type: paymentType,
    };
  }

  // Get payment status
  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { order_id: orderId },
      include: {
        booking: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return {
        status: 'not_found',
        message: 'Payment not found',
        order_id: orderId,
      };
    }

    // Get latest status from Midtrans
    try {
      const midtransStatus = await this.midtransService.getTransactionStatus(orderId);
      return {
        status: 'ok',
        order_id: payment.order_id,
        booking_id: payment.booking_id,
        payment_status: payment.status,
        booking_status: payment.booking.status,
        transaction_status: midtransStatus.transaction_status,
        payment_type: payment.payment_type,
        amount: Number(payment.amount),
        va_number: payment.va_number,
        bank: payment.bank,
        expiry_time: payment.expiry_time,
        booking: {
          id: payment.booking.id,
          booking_date: payment.booking.booking_date,
          start_time: payment.booking.start_time,
          end_time: payment.booking.end_time,
          consultation_type: payment.booking.consultation_type,
          doctor_name: payment.booking.doctor.user.full_name,
          specialization: payment.booking.doctor.specialization,
        },
      };
    } catch (error) {
      // Return local status if Midtrans call fails
      return {
        status: 'ok',
        order_id: payment.order_id,
        booking_id: payment.booking_id,
        payment_status: payment.status,
        booking_status: payment.booking.status,
        transaction_status: payment.transaction_status,
        payment_type: payment.payment_type,
        amount: Number(payment.amount),
        va_number: payment.va_number,
        bank: payment.bank,
        expiry_time: payment.expiry_time,
        booking: {
          id: payment.booking.id,
          booking_date: payment.booking.booking_date,
          start_time: payment.booking.start_time,
          end_time: payment.booking.end_time,
          consultation_type: payment.booking.consultation_type,
          doctor_name: payment.booking.doctor.user.full_name,
          specialization: payment.booking.doctor.specialization,
        },
      };
    }
  }

  // Get payment by booking ID
  async getPaymentByBookingId(bookingId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { booking_id: bookingId },
      include: {
        booking: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return {
        status: 'not_found',
        message: 'Payment not found',
        booking_id: bookingId,
      };
    }

    return {
      status: 'ok',
      order_id: payment.order_id,
      booking_id: payment.booking_id,
      payment_status: payment.status,
      booking_status: payment.booking.status,
      transaction_status: payment.transaction_status,
      payment_type: payment.payment_type,
      amount: Number(payment.amount),
      va_number: payment.va_number,
      bank: payment.bank,
      expiry_time: payment.expiry_time,
      snap_token: payment.snap_token,
      snap_redirect_url: payment.snap_redirect_url,
      booking: {
        id: payment.booking.id,
        booking_date: payment.booking.booking_date,
        start_time: payment.booking.start_time,
        end_time: payment.booking.end_time,
        consultation_type: payment.booking.consultation_type,
        consultation_fee: Number(payment.booking.consultation_fee),
        doctor_name: payment.booking.doctor.user.full_name,
        specialization: payment.booking.doctor.specialization,
      },
    };
  }

  // Get all booking payment history for a user
  async getBookingPaymentHistory(userId: string, status?: string) {
    const where: any = {
      booking: {
        user_id: userId,
      },
    };

    if (status) {
      where.status = status;
    }

    const payments = await this.prisma.payment.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        booking: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return payments.map(payment => ({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      payment_type: payment.payment_type,
      status: payment.status,
      transaction_status: payment.transaction_status,
      expiry_time: payment.expiry_time,
      created_at: payment.created_at,
      booking: {
        id: payment.booking.id,
        booking_date: payment.booking.booking_date,
        start_time: payment.booking.start_time,
        consultation_type: payment.booking.consultation_type,
        doctor_name: payment.booking.doctor.user.full_name,
        specialization: payment.booking.doctor.specialization,
      },
    }));
  }

  // Get all marketplace payment history for a user
  async getMarketplacePaymentHistory(userId: string, status?: string) {
    const where: any = {
      order: {
        user_id: userId,
      },
    };

    if (status) {
      where.status = status;
    }

    const payments = await this.prisma.orderPayment.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        order: {
          include: {
            items: {
              select: {
                product_name: true,
                quantity: true,
                subtotal: true,
              },
            },
          },
        },
      },
    });

    return payments.map(payment => ({
      id: payment.id,
      order_payment_id: payment.order_payment_id,
      amount: payment.amount,
      payment_type: payment.payment_type,
      status: payment.status,
      transaction_status: payment.transaction_status,
      expiry_time: payment.expiry_time,
      created_at: payment.created_at,
      order: {
        id: payment.order.id,
        order_number: payment.order.order_number,
        total_amount: payment.order.total_amount,
        status: payment.order.status,
        items_count: payment.order.items.length,
        items: payment.order.items,
      },
    }));
  }

  // Get combined payment history (both booking and marketplace)
  async getAllPaymentHistory(userId: string, type?: 'booking' | 'marketplace' | 'all', status?: string) {
    const filterType = type || 'all';

    if (filterType === 'booking') {
      const data = await this.getBookingPaymentHistory(userId, status);
      return data.map(p => ({ ...p, payment_for: 'BOOKING' }));
    }

    if (filterType === 'marketplace') {
      const data = await this.getMarketplacePaymentHistory(userId, status);
      return data.map(p => ({ ...p, payment_for: 'MARKETPLACE' }));
    }

    // Get both
    const [bookingPayments, marketplacePayments] = await Promise.all([
      this.getBookingPaymentHistory(userId, status),
      this.getMarketplacePaymentHistory(userId, status),
    ]);

    // Combine and sort by created_at
    const allPayments = [
      ...bookingPayments.map(p => ({ ...p, payment_for: 'BOOKING' as const })),
      ...marketplacePayments.map(p => ({ ...p, payment_for: 'MARKETPLACE' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allPayments;
  }

  // Cancel payment
  async cancelPayment(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { order_id: orderId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with order_id ${orderId} not found`);
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Only pending payments can be cancelled');
    }

    try {
      await this.midtransService.cancelTransaction(orderId);
    } catch (error) {
      // Midtrans might throw error if transaction not found or already cancelled
    }

    // Update payment status
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    // Update booking status
    await this.prisma.booking.update({
      where: { id: payment.booking_id },
      data: {
        status: 'CANCELLED',
        payment_status: 'FAILED',
      },
    });

    return { message: 'Payment cancelled successfully' };
  }
}
