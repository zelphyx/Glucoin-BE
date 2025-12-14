import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Track online users: Map<userId, socketId>
  private onlineUsers: Map<string, string> = new Map();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  afterInit() {
    console.log('🔌 Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Get token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('❌ No token provided, disconnecting client');
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.userRole = payload.role;

      // Add to online users
      this.onlineUsers.set(client.userId!, client.id);

      console.log(`✅ Client connected: ${client.userId} (${client.userRole})`);

      // Join user's personal room for direct messages
      client.join(`user:${client.userId}`);

      // Notify others that user is online
      this.server.emit('user:online', { userId: client.userId });
    } catch (error) {
      console.log('❌ Invalid token, disconnecting client:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.onlineUsers.delete(client.userId);
      console.log(`👋 Client disconnected: ${client.userId}`);

      // Notify others that user is offline
      this.server.emit('user:offline', { userId: client.userId });
    }
  }

  // Join a specific chat room
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;

    try {
      // Validate user has access to room
      await this.chatService.getRoom(data.roomId, client.userId);

      client.join(`room:${data.roomId}`);
      console.log(`📥 ${client.userId} joined room: ${data.roomId}`);

      return { success: true, roomId: data.roomId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Leave a chat room
  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(`room:${data.roomId}`);
    console.log(`📤 ${client.userId} left room: ${data.roomId}`);
    return { success: true };
  }

  // Send a message
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      roomId: string;
      message: string;
      messageType?: 'TEXT' | 'IMAGE' | 'FILE';
      attachmentUrl?: string;
    },
  ) {
    if (!client.userId) return;

    try {
      // Determine sender type
      const doctor = await this.chatService.getDoctorByUserId(client.userId);
      const senderType = doctor ? 'DOCTOR' : 'USER';

      // Save message to database
      const newMessage = await this.chatService.sendMessage(
        data.roomId,
        client.userId,
        senderType,
        data.message,
        data.messageType || 'TEXT',
        data.attachmentUrl,
      );

      // Broadcast to room
      this.server.to(`room:${data.roomId}`).emit('message:new', {
        id: newMessage.id,
        room_id: newMessage.room_id,
        sender_id: newMessage.sender_id,
        sender_type: newMessage.sender_type,
        message: newMessage.message,
        message_type: newMessage.message_type,
        attachment_url: newMessage.attachment_url,
        is_read: newMessage.is_read,
        created_at: newMessage.created_at,
      });

      console.log(`💬 Message sent in room ${data.roomId} by ${client.userId}`);

      return { success: true, message: newMessage };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark messages as read
  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;

    try {
      await this.chatService.markAsRead(data.roomId, client.userId);

      // Notify other participants that messages were read
      this.server.to(`room:${data.roomId}`).emit('message:read', {
        roomId: data.roomId,
        readBy: client.userId,
        readAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Typing indicator
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;

    client.to(`room:${data.roomId}`).emit('typing:start', {
      roomId: data.roomId,
      userId: client.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.userId) return;

    client.to(`room:${data.roomId}`).emit('typing:stop', {
      roomId: data.roomId,
      userId: client.userId,
    });
  }

  // Check if user is online
  @SubscribeMessage('user:status')
  handleUserStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    const isOnline = this.onlineUsers.has(data.userId);
    return { userId: data.userId, isOnline };
  }

  // Get all online users
  @SubscribeMessage('users:online')
  handleOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }
}
