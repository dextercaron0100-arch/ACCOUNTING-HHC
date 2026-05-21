import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('codes') findAll(@CompanyId() c: string) { return this.taxService.findAll(c); }
  @Post('codes') create(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.taxService.create(c, dto as never); }
  @Get('codes/:id') findOne(@Param('id') id: string, @CompanyId() c: string) { return this.taxService.findOne(id, c); }
  @Post('compute') compute(@CompanyId() c: string, @Body('amount') amount: string, @Body('taxCodeId') taxCodeId: string) { return this.taxService.computeTax(amount, taxCodeId, c); }
  @Get('bir-summary') birSummary(@CompanyId() c: string, @Query('year') year: number) { return this.taxService.getBirSummary(c, year ?? new Date().getFullYear()); }
}
