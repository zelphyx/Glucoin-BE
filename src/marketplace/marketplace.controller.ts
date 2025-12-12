import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CreateShippingAddressDto, UpdateShippingAddressDto } from './dto/shipping-address.dto';
import { CreateOrderDto, UpdateShippingDto, ReviewProductDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ============= PRODUCT ENDPOINTS =============

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createProduct(@Body() createProductDto: CreateProductDto) {
    return this.marketplaceService.createProduct(createProductDto);
  }

  @Get('products')
  findAllProducts(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceService.findAllProducts({
      category,
      search,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      inStock: inStock === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('products/:id')
  findOneProduct(@Param('id') id: string) {
    return this.marketplaceService.findOneProduct(id);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateProduct(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.marketplaceService.updateProduct(id, updateProductDto);
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deleteProduct(@Param('id') id: string) {
    return this.marketplaceService.deleteProduct(id);
  }

  // ============= CART ENDPOINTS =============

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  getCart(@CurrentUser() user: any) {
    return this.marketplaceService.getCart(user.id);
  }

  @Post('cart')
  @UseGuards(JwtAuthGuard)
  addToCart(@CurrentUser() user: any, @Body() addToCartDto: AddToCartDto) {
    return this.marketplaceService.addToCart(user.id, addToCartDto);
  }

  @Patch('cart/:itemId')
  @UseGuards(JwtAuthGuard)
  updateCartItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateCartItemDto,
  ) {
    return this.marketplaceService.updateCartItem(user.id, itemId, updateDto);
  }

  @Delete('cart/:itemId')
  @UseGuards(JwtAuthGuard)
  removeFromCart(@CurrentUser() user: any, @Param('itemId') itemId: string) {
    return this.marketplaceService.removeFromCart(user.id, itemId);
  }

  @Delete('cart')
  @UseGuards(JwtAuthGuard)
  clearCart(@CurrentUser() user: any) {
    return this.marketplaceService.clearCart(user.id);
  }

  // ============= SHIPPING ADDRESS ENDPOINTS =============

  @Get('addresses')
  @UseGuards(JwtAuthGuard)
  getShippingAddresses(@CurrentUser() user: any) {
    return this.marketplaceService.getShippingAddresses(user.id);
  }

  @Post('addresses')
  @UseGuards(JwtAuthGuard)
  createShippingAddress(@CurrentUser() user: any, @Body() dto: CreateShippingAddressDto) {
    return this.marketplaceService.createShippingAddress(user.id, dto);
  }

  @Patch('addresses/:id')
  @UseGuards(JwtAuthGuard)
  updateShippingAddress(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateShippingAddressDto,
  ) {
    return this.marketplaceService.updateShippingAddress(user.id, id, dto);
  }

  @Delete('addresses/:id')
  @UseGuards(JwtAuthGuard)
  deleteShippingAddress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.marketplaceService.deleteShippingAddress(user.id, id);
  }

  // ============= ORDER ENDPOINTS =============

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(@CurrentUser() user: any, @Body() createOrderDto: CreateOrderDto) {
    return this.marketplaceService.createOrder(user.id, createOrderDto);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  getOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceService.getOrders(user.id, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOrderById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.marketplaceService.getOrderById(user.id, id);
  }

  @Patch('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.marketplaceService.cancelOrder(user.id, id);
  }

  @Patch('orders/:id/confirm-delivery')
  @UseGuards(JwtAuthGuard)
  confirmDelivery(@CurrentUser() user: any, @Param('id') id: string) {
    return this.marketplaceService.confirmDelivery(user.id, id);
  }

  // Admin: Update shipping
  @Patch('orders/:id/shipping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateShipping(@Param('id') id: string, @Body() updateDto: UpdateShippingDto) {
    return this.marketplaceService.updateShipping(id, updateDto);
  }

  // ============= REVIEW ENDPOINTS =============

  @Post('products/:id/review')
  @UseGuards(JwtAuthGuard)
  reviewProduct(
    @CurrentUser() user: any,
    @Param('id') productId: string,
    @Body() reviewDto: ReviewProductDto,
  ) {
    return this.marketplaceService.reviewProduct(user.id, productId, reviewDto);
  }

  // ============= PAYMENT NOTIFICATION =============

  @Post('payment/notification')
  handlePaymentNotification(@Body() notification: any) {
    return this.marketplaceService.handlePaymentNotification(notification);
  }
}
