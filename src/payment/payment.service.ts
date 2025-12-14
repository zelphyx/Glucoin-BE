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
      throw new BadRequestException('Invalid signature');
    }

    // Find payment by order_id
    const payment = await this.prisma.payment.findUnique({
      where: { order_id: orderId },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with order_id ${orderId} not found`);
    }

    // Determine payment status
    let paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' = 'PENDING';
    let bookingStatus: 'PENDING_PAYMENT' | 'PENDING' | 'CANCELLED' | 'EXPIRED' = 'PENDING_PAYMENT';

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        paymentStatus = 'PAID';
        bookingStatus = 'PENDING';
      } else if (fraudStatus === 'challenge') {
        paymentStatus = 'PENDING';
        bookingStatus = 'PENDING_PAYMENT';
      }
    } else if (transactionStatus === 'settlement') {
      paymentStatus = 'PAID';
      bookingStatus = 'PENDING';
    } else if (transactionStatus === 'pending') {
      paymentStatus = 'PENDING';
      bookingStatus = 'PENDING_PAYMENT';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      paymentStatus = 'FAILED';
      bookingStatus = 'CANCELLED';
    } else if (transactionStatus === 'expire') {
      paymentStatus = 'EXPIRED';
      bookingStatus = 'EXPIRED';
    } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
      paymentStatus = 'REFUNDED';
    }

    // Update payment record
    const updatedPayment = await this.prisma.payment.update({
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

    return {
      message: 'Notification handled successfully',
      order_id: orderId,
      payment_status: paymentStatus,
      booking_status: bookingStatus,
    };
  }

  // Get payment status
  async getPaymentStatus(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { order_id: orderId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            booking_date: true,
            start_time: true,
            end_time: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with order_id ${orderId} not found`);
    }

    // Get latest status from Midtrans
    try {
      const midtransStatus = await this.midtransService.getTransactionStatus(orderId);
      return {
        payment: {
          id: payment.id,
          order_id: payment.order_id,
          amount: payment.amount,
          status: payment.status,
          payment_type: payment.payment_type,
          transaction_status: midtransStatus.transaction_status,
          va_number: payment.va_number,
          bank: payment.bank,
          expiry_time: payment.expiry_time,
        },
        booking: payment.booking,
        midtrans_status: midtransStatus,
      };
    } catch (error) {
      // Return local status if Midtrans call fails
      return {
        payment: {
          id: payment.id,
          order_id: payment.order_id,
          amount: payment.amount,
          status: payment.status,
          payment_type: payment.payment_type,
          va_number: payment.va_number,
          bank: payment.bank,
          expiry_time: payment.expiry_time,
        },
        booking: payment.booking,
      };
    }
  }

  // Get payment by booking ID
  async getPaymentByBookingId(bookingId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { booking_id: bookingId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment for booking ${bookingId} not found`);
    }

    return payment;
  }

  // Get all booking payment history for a user
  async getBookingPaymentHistory(userId: string, filters?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      booking: {
        user_id: userId,
      },
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
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
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map(payment => ({
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
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get all marketplace payment history for a user
  async getMarketplacePaymentHistory(userId: string, filters?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      order: {
        user_id: userId,
      },
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.orderPayment.findMany({
        where,
        skip,
        take: limit,
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
      }),
      this.prisma.orderPayment.count({ where }),
    ]);

    return {
      data: payments.map(payment => ({
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
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get combined payment history (both booking and marketplace)
  async getAllPaymentHistory(userId: string, filters?: {
    type?: 'booking' | 'marketplace' | 'all';
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const type = filters?.type || 'all';

    if (type === 'booking') {
      const result = await this.getBookingPaymentHistory(userId, filters);
      return {
        ...result,
        data: result.data.map(p => ({ ...p, payment_for: 'BOOKING' })),
      };
    }

    if (type === 'marketplace') {
      const result = await this.getMarketplacePaymentHistory(userId, filters);
      return {
        ...result,
        data: result.data.map(p => ({ ...p, payment_for: 'MARKETPLACE' })),
      };
    }

    // Get both
    const [bookingPayments, marketplacePayments] = await Promise.all([
      this.getBookingPaymentHistory(userId, { status: filters?.status }),
      this.getMarketplacePaymentHistory(userId, { status: filters?.status }),
    ]);

    // Combine and sort by created_at
    const allPayments = [
      ...bookingPayments.data.map(p => ({ ...p, payment_for: 'BOOKING' as const })),
      ...marketplacePayments.data.map(p => ({ ...p, payment_for: 'MARKETPLACE' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const start = (page - 1) * limit;
    const paginatedPayments = allPayments.slice(start, start + limit);

    return {
      data: paginatedPayments,
      pagination: {
        page,
        limit,
        total: allPayments.length,
        total_pages: Math.ceil(allPayments.length / limit),
      },
      summary: {
        booking_count: bookingPayments.pagination.total,
        marketplace_count: marketplacePayments.pagination.total,
      },
    };
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
