import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ==================== CHAT ROOM ====================

  // Get or create chat room between user and doctor
  async getOrCreateRoom(userId: string, doctorId: string, bookingId?: string) {
    // Check if room exists
    let room = await this.prisma.chatRoom.findUnique({
      where: {
        user_id_doctor_id: {
          user_id: userId,
          doctor_id: doctorId,
        },
      },
      include: {
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!room) {
      // Get doctor's user_id for validation
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: { user: true },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }

      // Create new room
      room = await this.prisma.chatRoom.create({
        data: {
          user_id: userId,
          doctor_id: doctorId,
          booking_id: bookingId,
        },
        include: {
          messages: true,
        },
      });
    }

    return room;
  }

  // Get room by ID with validation
  async getRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    // Check if user is participant
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: room.doctor_id },
    });

    if (room.user_id !== userId && doctor?.user_id !== userId) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    return room;
  }

  // Get all rooms for a user
  async getUserRooms(userId: string) {
    // Check if user is a doctor
    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });

    const rooms = await this.prisma.chatRoom.findMany({
      where: doctor
        ? { doctor_id: doctor.id }
        : { user_id: userId },
      include: {
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { last_message_at: 'desc' },
    });

    // Get participant details
    const roomsWithDetails = await Promise.all(
      rooms.map(async (room) => {
        const [user, doctorInfo] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: room.user_id },
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
            },
          }),
          this.prisma.doctor.findUnique({
            where: { id: room.doctor_id },
            include: {
              user: {
                select: {
                  id: true,
                  full_name: true,
                  profile_picture_url: true,
                },
              },
            },
          }),
        ]);

        // Count unread messages
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            room_id: room.id,
            is_read: false,
            sender_id: { not: userId },
          },
        });

        return {
          id: room.id,
          is_active: room.is_active,
          last_message: room.last_message,
          last_message_at: room.last_message_at,
          unread_count: unreadCount,
          user: user,
          doctor: {
            id: doctorInfo?.id,
            user_id: doctorInfo?.user_id,
            full_name: doctorInfo?.user.full_name,
            profile_picture_url: doctorInfo?.user.profile_picture_url,
            specialization: doctorInfo?.specialization,
          },
          created_at: room.created_at,
        };
      }),
    );

    return roomsWithDetails;
  }

  // ==================== MESSAGES ====================

  // Send a message
  async sendMessage(
    roomId: string,
    senderId: string,
    senderType: 'USER' | 'DOCTOR',
    message: string,
    messageType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT',
    attachmentUrl?: string,
  ) {
    const newMessage = await this.prisma.chatMessage.create({
      data: {
        room_id: roomId,
        sender_id: senderId,
        sender_type: senderType,
        message,
        message_type: messageType,
        attachment_url: attachmentUrl,
      },
    });

    // Update room's last message
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        last_message: message,
        last_message_at: new Date(),
      },
    });

    return newMessage;
  }

  // Get messages in a room
  async getMessages(
    roomId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    // Validate user is participant
    await this.getRoom(roomId, userId);

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { room_id: roomId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatMessage.count({
        where: { room_id: roomId },
      }),
    ]);

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Mark messages as read
  async markAsRead(roomId: string, userId: string) {
    // Validate user is participant
    await this.getRoom(roomId, userId);

    // Mark all messages from other sender as read
    await this.prisma.chatMessage.updateMany({
      where: {
        room_id: roomId,
        sender_id: { not: userId },
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return { success: true };
  }

  // Get room by booking ID
  async getRoomByBooking(bookingId: string) {
    return this.prisma.chatRoom.findUnique({
      where: { booking_id: bookingId },
    });
  }

  // Check if user is a doctor and get their doctor ID
  async getDoctorByUserId(userId: string) {
    return this.prisma.doctor.findUnique({
      where: { user_id: userId },
    });
  }
}
