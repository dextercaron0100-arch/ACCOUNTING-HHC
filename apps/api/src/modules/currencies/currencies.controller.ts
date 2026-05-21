import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('currencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get() findAll() { return this.currenciesService.findAll(); }
  @Get('rate') getRate(@Query('from') from: string, @Query('to') to: string, @Query('date') date?: string) {
    return this.currenciesService.getRate(from, to, date ? new Date(date) : undefined);
  }
  @Post('rate') setRate(@Body() dto: Record<string, unknown>) { return this.currenciesService.setRate(dto as never); }
  @Get('rate-history') rateHistory(@Query('from') from: string, @Query('to') to: string) { return this.currenciesService.getRateHistory(from, to); }
}
