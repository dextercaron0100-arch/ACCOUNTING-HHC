import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as otplib from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (user.totpEnabled) {
      return { requiresTwoFa: true, userId: user.id };
    }

    return this.issueTokens(user.id, dto.companyId);
  }

  async verifyTwoFa(userId: string, token: string, companyId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('2FA not configured');

    const isValid = otplib.authenticator.verify({ token, secret: user.totpSecret });
    if (!isValid) throw new UnauthorizedException('Invalid 2FA code');

    return this.issueTokens(userId, companyId);
  }

  async enableTwoFa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = otplib.authenticator.generateSecret();
    const otpauth = otplib.authenticator.keyuri(user.email, 'AccountingSystem', secret);
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    return { secret, qrDataUrl };
  }

  async confirmTwoFa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('Call enable-2fa first');

    const isValid = otplib.authenticator.verify({ token, secret: user.totpSecret });
    if (!isValid) throw new UnauthorizedException('Invalid token');

    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return { enabled: true };
  }

  async disableTwoFa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('2FA not configured');

    const isValid = otplib.authenticator.verify({ token, secret: user.totpSecret });
    if (!isValid) throw new UnauthorizedException('Invalid token');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { disabled: true };
  }

  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.userId);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userCompanies: {
          include: {
            company: { include: { baseCurrency: true } },
            role: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const allPermissions = new Set<string>();
    user.userCompanies.forEach((uc) => {
      const perms = uc.role.permissions as string[];
      perms.forEach((p) => allPermissions.add(p));
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      totpEnabled: user.totpEnabled,
      roles: user.userCompanies.map((uc) => uc.role.name),
      permissions: Array.from(allPermissions),
      companies: user.userCompanies.map((uc) => ({
        id: uc.company.id,
        name: uc.company.name,
        baseCurrency: uc.company.baseCurrency.code,
        timezone: uc.company.timezone,
        role: uc.role.name,
      })),
    };
  }

  private async issueTokens(userId: string, companyId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userCompanies: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException();

    const allPermissions = new Set<string>();
    user.userCompanies.forEach((uc) => {
      (uc.role.permissions as string[]).forEach((p) => allPermissions.add(p));
    });

    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      companyId,
      roles: user.userCompanies.map((uc) => uc.role.name),
      permissions: Array.from(allPermissions),
    };

    const accessToken = this.jwt.sign(payload);

    const refreshExpiryDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiryDays);

    const { token: refreshToken } = await this.prisma.refreshToken.create({
      data: {
        userId,
        token: `${userId}.${Date.now()}.${Math.random().toString(36).slice(2)}`,
        expiresAt,
      },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

    return { accessToken, refreshToken, requiresTwoFa: false };
  }
}
