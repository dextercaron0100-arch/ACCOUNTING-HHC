import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('pos') getPOs(@CompanyId() c: string, @Query('page') page?: number, @Query('status') status?: string) {
    return this.procurementService.findPOs(c, { page, status });
  }

  @Post('pos') createPO(@CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.procurementService.createPO(c, dto);
  }

  @Post('pos/:id/approve') @HttpCode(HttpStatus.OK)
  approvePO(@Param('id') id: string, @CompanyId() c: string, @CurrentUser() user: JwtPayload) {
    return this.procurementService.approvePO(id, c, user.sub);
  }

  @Post('pos/:poId/grn') createGRN(@Param('poId') poId: string, @CompanyId() c: string, @Body() dto: Record<string, unknown>) {
    return this.procurementService.createGRN(c, poId, dto);
  }

  @Post('match/:poId/:invoiceId') @HttpCode(HttpStatus.OK)
  threeWayMatch(@Param('poId') poId: string, @Param('invoiceId') invoiceId: string, @CompanyId() c: string) {
    return this.procurementService.threeWayMatch(c, poId, invoiceId);
  }
}
