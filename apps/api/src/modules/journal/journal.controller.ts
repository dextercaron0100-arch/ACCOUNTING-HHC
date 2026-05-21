import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: 'List journal entries (paginated)' })
  findAll(
    @CompanyId() companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.journalService.findAll(companyId, { page, limit, status, dateFrom, dateTo });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.journalService.findOne(id, companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new journal entry (DRAFT)' })
  create(
    @Body() dto: CreateJournalEntryDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journalService.create(companyId, user.sub, dto, user.permissions);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a DRAFT journal entry' })
  post(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.journalService.post(id, companyId, user.sub, user.permissions);
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse a POSTED journal entry' })
  reverse(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
    @Body('description') description?: string,
  ) {
    return this.journalService.reverse(id, companyId, user.sub, description);
  }
}
