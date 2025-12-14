import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Get or create a chat room with a doctor
  @Post('room')
  async getOrCreateRoom(
    @CurrentUser() user: any,
    @Body() body: { doctorId: string; bookingId?: string },
  ) {
    const room = await this.chatService.getOrCreateRoom(
      user.id,
      body.doctorId,
      body.bookingId,
    );
    return {
      message: 'Chat room ready',
      room,
    };
  }

  // Get all chat rooms for current user
  @Get('rooms')
  async getUserRooms(@CurrentUser() user: any) {
    return this.chatService.getUserRooms(user.id);
  }

  // Get a specific room
  @Get('room/:roomId')
  async getRoom(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.getRoom(roomId, user.id);
  }

  // Get messages in a room
  @Get('room/:roomId/messages')
  async getMessages(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      roomId,
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  // Mark messages as read
  @Post('room/:roomId/read')
  async markAsRead(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.markAsRead(roomId, user.id);
  }

  // Get room by booking ID
  @Get('booking/:bookingId')
  async getRoomByBooking(
    @CurrentUser() user: any,
    @Param('bookingId') bookingId: string,
  ) {
    const room = await this.chatService.getRoomByBooking(bookingId);
    if (!room) {
      return { message: 'No chat room for this booking', room: null };
    }
    return { room };
  }
}
