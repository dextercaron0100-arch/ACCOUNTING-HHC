import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items') getItems(@CompanyId() c: string) { return this.inventoryService.findItems(c); }
  @Post('items') createItem(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.inventoryService.createItem(c, dto); }
  @Get('items/:id/balance') getBalance(@Param('id') id: string) { return this.inventoryService.getStockBalance(id); }
  @Post('movements') recordMovement(@CompanyId() c: string, @Body() dto: Record<string, unknown>) { return this.inventoryService.recordMovement(c, dto as never); }
}
