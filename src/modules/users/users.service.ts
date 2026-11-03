import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return user;
  }

  async listUsers() {
    return this.prisma.user.findMany();
  }

  async rechargeBalance(userId: string, amount: number) {
    await this.getUser(userId);

    return this.prisma.$transaction(async (transactionClient) => {
      const updatedUser = await transactionClient.user.update({
        where: { id: userId },
        data: { balance: { increment: new Prisma.Decimal(amount) } },
      });

      const transaction = await transactionClient.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: TransactionType.CREDIT,
          reference: `RECHARGE-${Date.now()}-${randomUUID().slice(0, 8)}`,
        },
      });

      return { user: updatedUser, transaction };
    });
  }
}
