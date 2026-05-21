import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('types')
  @ApiOperation({ summary: 'Get all account types' })
  getAccountTypes() {
    return this.accountsService.getAccountTypes();
  }

  @Get()
  @ApiOperation({ summary: 'Get chart of accounts (tree)' })
  findAll(@CompanyId() companyId: string) {
    return this.accountsService.findAll(companyId);
  }

  @Get('flat')
  @ApiOperation({ summary: 'Get flat list of accounts (for dropdowns)' })
  findFlat(@CompanyId() companyId: string, @Query('type') type?: string) {
    return this.accountsService.findFlat(companyId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.accountsService.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  create(@Body() dto: CreateAccountDto, @CompanyId() companyId: string) {
    return this.accountsService.create(companyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CompanyId() companyId: string,
  ) {
    return this.accountsService.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an account' })
  remove(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.accountsService.remove(id, companyId);
  }
}
