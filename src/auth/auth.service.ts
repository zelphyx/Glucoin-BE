// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Setup nodemailer transporter untuk Gmail SMTP
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
        otp_code: otp,
        otp_expires_at: otpExpiresAt,
        is_verified: false,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
    });

    // Send OTP via email
    await this.sendOtpEmail(user.email, user.full_name, otp);

    return {
      message: 'Registration successful. Please check your email for OTP verification code.',
      email: user.email,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_verified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      access_token: token,
    };
  }

  async validateUser(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_verified: true,
      },
    });
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: verifyOtpDto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.is_verified) {
      throw new BadRequestException('Email already verified');
    }

    if (!user.otp_code || user.otp_code !== verifyOtpDto.otp) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    if (!user.otp_expires_at || new Date() > user.otp_expires_at) {
      throw new UnauthorizedException('OTP code has expired');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        email_verified_at: new Date(),
        otp_code: null,
        otp_expires_at: null,
      },
    });

    // Generate token after verification
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      access_token: token,
    };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: resendOtpDto.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.is_verified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otp_code: otp,
        otp_expires_at: otpExpiresAt,
      },
    });

    // Send new OTP via email
    await this.sendOtpEmail(user.email, user.full_name, otp);

    return {
      message: 'OTP has been resent to your email',
      email: user.email,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    // Always return success message to prevent email enumeration
    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent.',
      };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: hashedToken,
        password_reset_expires: resetExpires,
      },
    });

    // Send reset email
    await this.sendPasswordResetEmail(user.email, user.full_name, resetToken);

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    // Validate confirmReset checkbox
    if (!resetPasswordDto.confirmReset) {
      throw new BadRequestException('You must confirm that you want to reset your password');
    }

    // Validate passwords match
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(resetPasswordDto.token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        password_reset_token: hashedToken,
        password_reset_expires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });

    return {
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  }

  private async sendPasswordResetEmail(email: string, fullName: string, resetToken: string): Promise<void> {
    try {
      // Get backend URL from env, fallback to localhost for development
      const backendUrl = process.env.BACKEND_URL || 'https://glucoinapi.mentorit.my.id';
      const resetUrl = `${backendUrl}/auth/reset-password?token=${resetToken}`;

      console.log('🔄 Attempting to send password reset email...');
      console.log('📧 To:', email);
      console.log('🔗 Reset URL:', resetUrl);

      const info = await this.transporter.sendMail({
        from: `"Glucoin" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Reset Password - Glucoin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hello ${fullName},</p>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #f4f4f4; padding: 10px; word-break: break-all;">
              ${resetUrl}
            </p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
          </div>
        `,
      });

      console.log('✅ Password reset email sent successfully!');
      console.log('📬 Message ID:', info.messageId);
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      console.error('Error details:', error.message || error);
      // Don't throw error to prevent revealing if email exists
    }
  }

  private async sendOtpEmail(email: string, fullName: string, otp: string): Promise<void> {
    try {
      console.log('🔄 Attempting to send OTP email...');
      console.log('📧 To:', email);
      console.log('� From:', process.env.SMTP_EMAIL);

      const info = await this.transporter.sendMail({
        from: `"Glucoin" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Email Verification - Glucoin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Glucoin, ${fullName}!</h2>
            <p>Thank you for registering. Please use the following OTP code to verify your email:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated email, please do not reply.</p>
          </div>
        `,
      });

      console.log('✅ OTP email sent successfully!');
      console.log('📬 Message ID:', info.messageId);
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error);
      console.error('Error details:', error.message || error);
      // Don't throw error, just log it so registration can continue
    }
  }

  private generateToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
