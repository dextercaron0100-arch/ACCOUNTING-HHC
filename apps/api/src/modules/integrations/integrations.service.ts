import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listWebhooks(companyId: string) {
    // Webhook endpoints stored as JSON config in company settings (future implementation)
    return { webhooks: [], note: 'Webhook management coming soon' };
  }

  async registerWebhook(companyId: string, dto: { url: string; events: string[]; secret: string }) {
    return { id: 'wh_placeholder', ...dto, companyId, createdAt: new Date() };
  }

  async getPaymentGateways() {
    return [
      { id: 'stripe', name: 'Stripe', status: 'stub', description: 'Credit/debit card payments' },
      { id: 'gcash', name: 'GCash', status: 'stub', description: 'Philippine mobile wallet' },
      { id: 'maya', name: 'Maya (PayMaya)', status: 'stub', description: 'Philippine digital payment' },
    ];
  }

  async getEcommerceConnectors() {
    return [
      { id: 'shopify', name: 'Shopify', status: 'stub', description: 'Sync orders from Shopify store' },
      { id: 'lazada', name: 'Lazada', status: 'stub', description: 'Sync orders from Lazada marketplace' },
    ];
  }
}
