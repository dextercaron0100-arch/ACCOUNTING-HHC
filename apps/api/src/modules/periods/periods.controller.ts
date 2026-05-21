import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get() findAll(@CompanyId() c: string) { return this.periodsService.findAll(c); }
  @Post() create(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.periodsService.create(c, dto as never); }
  @Get(':id') findOne(@Param('id') id: string, @CompanyId() c: string) { return this.periodsService.findOne(id, c); }

  @Post(':id/soft-close') @HttpCode(HttpStatus.OK)
  softClose(@Param('id') id: string, @CompanyId() c: string) { return this.periodsService.softClose(id, c); }

  @Post(':id/hard-close') @HttpCode(HttpStatus.OK)
  hardClose(@Param('id') id: string, @CompanyId() c: string) { return this.periodsService.hardClose(id, c); }

  @Post(':id/reopen') @HttpCode(HttpStatus.OK)
  reopen(@Param('id') id: string, @CompanyId() c: string) { return this.periodsService.reopen(id, c); }
}
