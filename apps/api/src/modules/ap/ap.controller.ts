import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApService } from './ap.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('ap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ap')
export class ApController {
  constructor(private readonly apService: ApService) {}

  @Get('vendors') getVendors(@CompanyId() c: string, @Query('page') page?: number, @Query('search') search?: string) {
    return this.apService.findVendors(c, { page, search });
  }

  @Post('vendors') createVendor(@CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.apService.createVendor(c, dto);
  }

  @Get('bills') getBills(@CompanyId() c: string, @Query('page') page?: number, @Query('status') status?: string, @Query('vendorId') vendorId?: string) {
    return this.apService.findBills(c, { page, status, vendorId });
  }

  @Get('aging') getAging(@CompanyId() c: string) {
    return this.apService.getApAging(c);
  }
}
