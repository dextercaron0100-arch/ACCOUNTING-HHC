import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get() getAssets(@CompanyId() c: string) { return this.assetsService.findAll(c); }
  @Post() createAsset(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.assetsService.create(c, dto); }

  @Post('depreciation/run')
  @HttpCode(HttpStatus.OK)
  runDepreciation(@CompanyId() c: string, @Body('periodId') periodId: string, @CurrentUser() user: JwtPayload) {
    return this.assetsService.postMonthlyDepreciation(c, periodId, user.sub);
  }

  @Post(':id/dispose')
  @HttpCode(HttpStatus.OK)
  dispose(@Param('id') id: string, @CompanyId() c: string, @Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.assetsService.dispose(id, c, { ...(dto as any), userId: user.sub } as any);
  }
}
