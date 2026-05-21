import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ArService } from './ar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('ar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ar')
export class ArController {
  constructor(private readonly arService: ArService) {}

  @Get('customers') getCustomers(@CompanyId() c: string, @Query('page') page?: number, @Query('limit') limit?: number, @Query('search') search?: string) {
    return this.arService.findCustomers(c, { page, limit, search });
  }

  @Post('customers') createCustomer(@CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.arService.createCustomer(c, dto);
  }

  @Get('invoices') getInvoices(@CompanyId() c: string, @Query('page') page?: number, @Query('limit') limit?: number, @Query('status') status?: string, @Query('customerId') customerId?: string) {
    return this.arService.findInvoices(c, { page, limit, status, customerId });
  }

  @Post('invoices') createInvoice(@CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.arService.createInvoice(c, dto);
  }

  @Get('aging') @ApiOperation({ summary: 'AR aging report' })
  getAging(@CompanyId() c: string) {
    return this.arService.getArAging(c);
  }

  @Post('receipts') recordReceipt(@CompanyId() c: string, @Body() dto: { customerId: string; invoiceId: string; amount: string; date: string; bankAccountId?: string; reference?: string }) {
    return this.arService.recordReceipt(c, dto);
  }
}
