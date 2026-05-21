import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('webhooks') listWebhooks(@CompanyId() c: string) { return this.integrationsService.listWebhooks(c); }
  @Post('webhooks') registerWebhook(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.integrationsService.registerWebhook(c, dto as never); }
  @Get('gateways') gateways() { return this.integrationsService.getPaymentGateways(); }
  @Get('ecommerce') ecommerce() { return this.integrationsService.getEcommerceConnectors(); }
}
