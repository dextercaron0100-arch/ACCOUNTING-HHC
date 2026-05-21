import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get() findAll(@CurrentUser() user: JwtPayload) { return this.companiesService.findAll(user.sub); }
  @Get(':id') findOne(@Param('id') id: string) { return this.companiesService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Record<string, unknown>) { return this.companiesService.update(id, dto); }

  @Get(':id/branches') findBranches(@Param('id') id: string) { return this.companiesService.findBranches(id); }
  @Post(':id/branches') createBranch(@Param('id') id: string, @Body() dto: Record<string, unknown>) { return this.companiesService.createBranch(id, dto as never); }

  @Get(':id/users') getUserRoles(@Param('id') id: string) { return this.companiesService.getUserRoles(id); }
  @Post(':id/users') assignRole(@Param('id') id: string, @Body('userId') userId: string, @Body('roleId') roleId: string) {
    return this.companiesService.assignRole(id, userId, roleId);
  }
}
