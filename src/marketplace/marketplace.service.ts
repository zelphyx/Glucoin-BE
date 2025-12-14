import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';
import { CreateOrderDto, UpdateShippingDto, ReviewProductDto } from './dto/order.dto';
import { MidtransService } from '../payment/midtrans.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private midtransService: MidtransService,
  ) {}

  // ============= PRODUCT METHODS =============

  async createProduct(createProductDto: CreateProductDto) {
    const { price, discount_percent = 0, ...rest } = createProductDto;
    const final_price = price - (price * discount_percent) / 100;

    const product = await this.prisma.product.create({
      data: {
        ...rest,
        price,
        discount_percent,
        final_price,
      },
    });

    return {
      message: 'Product created successfully',
      data: this.formatProduct(product),
    };
  }

  async findAllProducts(filters?: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { is_active: true };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.final_price = {};
      if (filters.minPrice !== undefined) {
        where.final_price.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.final_price.lte = filters.maxPrice;
      }
    }

    if (filters?.inStock) {
      where.quantity = { gt: 0 };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.formatProduct(p)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOneProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        reviews: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return { data: this.formatProduct(product) };
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const price = updateProductDto.price ?? Number(product.price);
    const discount_percent = updateProductDto.discount_percent ?? product.discount_percent;
    const final_price = price - (price * discount_percent) / 100;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...updateProductDto,
        final_price,
      },
    });

    return {
      message: 'Product updated successfully',
      data: this.formatProduct(updated),
    };
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({ where: { id } });

    return { message: 'Product deleted successfully' };
  }

  // ============= CART METHODS =============

  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          include: { product: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { user_id: userId },
        include: {
          items: {
            include: { product: true },
          },
        },
      });
    }

    const items = cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      product: this.formatProduct(item.product),
      subtotal: Number(item.product.final_price) * item.quantity,
    }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      data: {
        id: cart.id,
        items,
        total_items: items.length,
        total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        total,
      },
    };
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { product_id, quantity } = addToCartDto;

    // Check product exists and has stock
    const product = await this.prisma.product.findUnique({
      where: { id: product_id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.is_active) {
      throw new BadRequestException('Product is not available');
    }

    if (product.quantity < quantity) {
      throw new BadRequestException(`Only ${product.quantity} items available in stock`);
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { user_id: userId },
      });
    }

    // Check if product already in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cart_id_product_id: {
          cart_id: cart.id,
          product_id,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.quantity < newQuantity) {
        throw new BadRequestException(`Only ${product.quantity} items available in stock`);
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateCartItem(userId: string, itemId: string, updateDto: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart_id: cart.id },
      include: { product: true },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.product.quantity < updateDto.quantity) {
      throw new BadRequestException(`Only ${cartItem.product.quantity} items available in stock`);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: updateDto.quantity },
    });

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart_id: cart.id },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
    });

    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cart_id: cart.id },
      });
    }

    return { message: 'Cart cleared successfully' };
  }

  // ============= SHIPPING ADDRESS METHODS =============

  async getShippingAddresses(userId: string) {
    const addresses = await this.prisma.shippingAddress.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return { data: addresses };
  }

  async createShippingAddress(userId: string, dto: CreateShippingAddressDto) {
    // If this is set as default, unset other defaults
    if (dto.is_default) {
      await this.prisma.shippingAddress.updateMany({
        where: { user_id: userId },
        data: { is_default: false },
      });
    }

    const address = await this.prisma.shippingAddress.create({
      data: {
        user_id: userId,
        ...dto,
      },
    });

    return {
      message: 'Shipping address created successfully',
      data: address,
    };
  }

  async updateShippingAddress(userId: string, addressId: string, dto: UpdateShippingAddressDto) {
    const address = await this.prisma.shippingAddress.findFirst({
      where: { id: addressId, user_id: userId },
    });

    if (!address) {
      throw new NotFoundException('Shipping address not found');
    }

    if (dto.is_default) {
      await this.prisma.shippingAddress.updateMany({
        where: { user_id: userId },
        data: { is_default: false },
      });
    }

    const updated = await this.prisma.shippingAddress.update({
      where: { id: addressId },
      data: dto,
    });

    return {
      message: 'Shipping address updated successfully',
      data: updated,
    };
  }

  async deleteShippingAddress(userId: string, addressId: string) {
    const address = await this.prisma.shippingAddress.findFirst({
      where: { id: addressId, user_id: userId },
    });

    if (!address) {
      throw new NotFoundException('Shipping address not found');
    }

    await this.prisma.shippingAddress.delete({ where: { id: addressId } });

    return { message: 'Shipping address deleted successfully' };
  }

  // ============= ORDER METHODS =============

  // Admin fee constant - Rp 2,500
  private readonly ADMIN_FEE = 2500;

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const { shipping_address_id, shipping_cost, courier, notes } = createOrderDto;

    // Verify shipping address
    const shippingAddress = await this.prisma.shippingAddress.findFirst({
      where: { id: shipping_address_id, user_id: userId },
    });

    if (!shippingAddress) {
      throw new NotFoundException('Shipping address not found');
    }

    // Get cart items
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate stock and calculate totals
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of cart.items) {
      if (!item.product.is_active) {
        throw new BadRequestException(`Product "${item.product.name}" is no longer available`);
      }

      if (item.product.quantity < item.quantity) {
        throw new BadRequestException(
          `Only ${item.product.quantity} of "${item.product.name}" available in stock`,
        );
      }

      const itemSubtotal = Number(item.product.final_price) * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product_id: item.product.id,
        product_name: item.product.name,
        product_price: item.product.final_price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });
    }

    // Calculate 5% admin fee
    const admin_fee = Math.round(subtotal * 0.05);
    const total_amount = subtotal + shipping_cost + admin_fee;

    // Generate order number
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    const order_number = `ORD-${dateStr}-${random}`;

    // Create order with transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          user_id: userId,
          order_number,
          shipping_address_id,
          subtotal,
          shipping_cost,
          discount_amount: admin_fee, // Using discount_amount field for admin fee (negative = fee)
          total_amount,
          courier,
          notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
          shipping_address: true,
        },
      });

      // Reduce product stock
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.product.id },
          data: {
            quantity: { decrement: item.quantity },
          },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cart_id: cart.id },
      });

      return newOrder;
    });

    // Create Midtrans payment
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { full_name: true, email: true, phone_number: true },
    });

    const payment = await this.createOrderPayment(order, user!);

    return {
      message: 'Order created successfully. Please complete payment.',
      order: this.formatOrder(order),
      payment: {
        order_id: payment.order_payment_id,
        amount: payment.amount,
        expiry_time: payment.expiry_time,
        snap_token: payment.snap_token,
        snap_redirect_url: payment.snap_redirect_url,
      },
    };
  }

  private async createOrderPayment(order: any, user: any) {
    const orderId = `GLUCOIN-MKT-${order.id.substring(0, 8)}-${Date.now()}`;

    const itemDetails = order.items.map((item: any) => ({
      id: item.product_id.substring(0, 8),
      price: Math.round(Number(item.product_price)),
      quantity: item.quantity,
      name: item.product_name.substring(0, 50),
    }));

    // Add shipping cost as item
    if (Number(order.shipping_cost) > 0) {
      itemDetails.push({
        id: 'SHIPPING',
        price: Math.round(Number(order.shipping_cost)),
        quantity: 1,
        name: `Ongkos Kirim ${order.courier || ''}`.trim(),
      });
    }

    // Add admin fee as item (5% of subtotal)
    if (Number(order.discount_amount) > 0) {
      itemDetails.push({
        id: 'ADMIN_FEE',
        price: Math.round(Number(order.discount_amount)),
        quantity: 1,
        name: 'Biaya Admin (5%)',
      });
    }

    const snapResponse = await this.midtransService.createTransaction({
      orderId,
      grossAmount: Math.round(Number(order.total_amount)),
      customerDetails: {
        firstName: user.full_name,
        email: user.email,
        phone: user.phone_number || '',
      },
      itemDetails,
    });

    const payment = await this.prisma.orderPayment.create({
      data: {
        order_id: order.id,
        order_payment_id: orderId,
        amount: order.total_amount,
        snap_token: snapResponse.token,
        snap_redirect_url: snapResponse.redirect_url,
        expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return payment;
  }

  async getOrders(userId: string, filters?: { status?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          shipping_address: true,
          payment: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => this.formatOrder(o)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
      include: {
        items: true,
        shipping_address: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { data: this.formatOrder(order) };
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!['PENDING_PAYMENT', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    // Restore product stock
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: {
            quantity: { increment: item.quantity },
          },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          payment_status: 'FAILED',
        },
      });

      await tx.orderPayment.updateMany({
        where: { order_id: orderId },
        data: { status: 'FAILED' },
      });
    });

    return { message: 'Order cancelled successfully' };
  }

  // Admin: Update shipping status
  async updateShipping(orderId: string, updateDto: UpdateShippingDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updateData: any = {};

    if (updateDto.tracking_number) {
      updateData.tracking_number = updateDto.tracking_number;
    }

    if (updateDto.courier) {
      updateData.courier = updateDto.courier;
    }

    if (updateDto.shipping_status) {
      updateData.shipping_status = updateDto.shipping_status;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (updateDto.shipping_status === 'SHIPPED') {
        updateData.shipped_at = new Date();
        updateData.status = 'SHIPPED';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      } else if (updateDto.shipping_status === 'DELIVERED') {
        updateData.delivered_at = new Date();
        updateData.status = 'DELIVERED';
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        shipping_address: true,
      },
    });

    return {
      message: 'Shipping updated successfully',
      data: this.formatOrder(updated),
    };
  }

  // Confirm order received (user)
  async confirmDelivery(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Order has not been delivered yet');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    return { message: 'Order completed successfully' };
  }

  // ============= REVIEW METHODS =============

  async reviewProduct(userId: string, productId: string, reviewDto: ReviewProductDto) {
    // Check if user has purchased this product
    const hasPurchased = await this.prisma.orderItem.findFirst({
      where: {
        product_id: productId,
        order: {
          user_id: userId,
          status: 'COMPLETED',
        },
      },
    });

    if (!hasPurchased) {
      throw new BadRequestException('You can only review products you have purchased');
    }

    // Check existing review
    const existingReview = await this.prisma.productReview.findUnique({
      where: {
        product_id_user_id: {
          product_id: productId,
          user_id: userId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    // Create review and update product rating
    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.create({
        data: {
          product_id: productId,
          user_id: userId,
          rating: reviewDto.rating,
          comment: reviewDto.comment,
        },
      });

      // Recalculate product rating
      const reviews = await tx.productReview.findMany({
        where: { product_id: productId },
      });

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await tx.product.update({
        where: { id: productId },
        data: {
          rating: avgRating,
          rating_count: reviews.length,
        },
      });
    });

    return { message: 'Review submitted successfully' };
  }

  // ============= PAYMENT NOTIFICATION =============

  async handlePaymentNotification(notification: any) {
    const { order_id, transaction_status, fraud_status, payment_type } = notification;

    console.log('📥 Marketplace Payment Notification:', {
      order_id,
      transaction_status,
      fraud_status,
      payment_type,
    });

    // Find payment by order_id
    const payment = await this.prisma.orderPayment.findUnique({
      where: { order_payment_id: order_id },
      include: { order: true },
    });

    if (!payment) {
      console.log('❌ Order payment not found for:', order_id);
      return { 
        status: 'error', 
        message: 'Payment not found',
        order_id 
      };
    }

    let paymentStatus: string = 'PENDING';
    let orderStatus: string = payment.order.status;

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (fraud_status === 'accept' || !fraud_status) {
        paymentStatus = 'PAID';
        orderStatus = 'PROCESSING';
      }
    } else if (transaction_status === 'deny' || transaction_status === 'cancel') {
      paymentStatus = 'FAILED';
      orderStatus = 'CANCELLED';
    } else if (transaction_status === 'expire') {
      paymentStatus = 'EXPIRED';
      orderStatus = 'CANCELLED';
    } else if (transaction_status === 'pending') {
      paymentStatus = 'PENDING';
      orderStatus = 'PENDING_PAYMENT';
    }

    console.log('📝 Updating payment:', { paymentStatus, orderStatus });

    await this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus as any,
          payment_type,
          transaction_id: notification.transaction_id,
          transaction_status,
          transaction_time: notification.transaction_time
            ? new Date(notification.transaction_time)
            : null,
          raw_response: JSON.stringify(notification),
        },
      });

      await tx.order.update({
        where: { id: payment.order_id },
        data: {
          status: orderStatus as any,
          payment_status: paymentStatus as any,
          paid_at: paymentStatus === 'PAID' ? new Date() : null,
        },
      });

      // If cancelled/expired, restore stock
      if (['CANCELLED'].includes(orderStatus)) {
        const orderItems = await tx.orderItem.findMany({
          where: { order_id: payment.order_id },
        });

        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.product_id },
            data: {
              quantity: { increment: item.quantity },
            },
          });
        }
      }
    });

    console.log('✅ Payment updated successfully');

    return {
      status: 'ok',
      order_id: order_id,
      order_number: payment.order.order_number,
      payment_status: paymentStatus,
      order_status: orderStatus,
      transaction_status,
    };
  }

  // Get payment status by Midtrans order_id (for frontend after redirect)
  async getPaymentStatusByOrderId(orderId: string) {
    const payment = await this.prisma.orderPayment.findUnique({
      where: { order_payment_id: orderId },
      include: { 
        order: {
          include: {
            items: true,
            shipping_address: true,
          }
        } 
      },
    });

    if (!payment) {
      return {
        status: 'not_found',
        message: 'Payment not found',
        order_id: orderId,
      };
    }

    return {
      status: 'ok',
      order_id: orderId,
      order_number: payment.order.order_number,
      payment_status: payment.status,
      order_status: payment.order.status,
      transaction_status: payment.transaction_status,
      payment_type: payment.payment_type,
      amount: Number(payment.amount),
      paid_at: payment.order.paid_at,
      order: this.formatOrder(payment.order),
    };
  }

  // ============= HELPER METHODS =============

  private formatProduct(product: any) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      discount_percent: product.discount_percent,
      final_price: Number(product.final_price),
      rating: Number(product.rating),
      rating_count: product.rating_count,
      quantity: product.quantity,
      in_stock: product.quantity > 0,
      image_url: product.image_url,
      category: product.category,
      is_active: product.is_active,
      reviews: product.reviews,
      created_at: product.created_at,
    };
  }

  private formatOrder(order: any) {
    return {
      id: order.id,
      order_number: order.order_number,
      subtotal: Number(order.subtotal),
      shipping_cost: Number(order.shipping_cost),
      admin_fee: this.ADMIN_FEE,
      total: Number(order.total_amount),
      status: order.status,
      payment_status: order.payment_status,
      shipping_status: order.shipping_status,
      tracking_number: order.tracking_number,
      courier: order.courier,
      notes: order.notes,
      items: order.items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        price: Number(item.product_price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
      })),
      shipping_address: order.shipping_address,
      payment: order.payment
        ? {
            order_id: order.payment.order_payment_id,
            status: order.payment.status,
            method: order.payment.payment_type,
            snap_token: order.payment.snap_token,
            snap_redirect_url: order.payment.snap_redirect_url,
            expiry_time: order.payment.expiry_time,
          }
        : null,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      created_at: order.created_at,
    };
  }
}
