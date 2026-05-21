import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get() findAll(@CompanyId() c: string, @Query('referenceType') rt?: string, @Query('referenceId') rid?: string) {
    return this.documentsService.findDocuments(c, rt, rid);
  }

  @Post('upload-url') getUploadUrl(@CompanyId() c: string, @Body('filename') filename: string, @Body('contentType') contentType: string) {
    return this.documentsService.getPresignedUploadUrl(c, filename, contentType);
  }

  @Post() save(@CompanyId() c: string, @CurrentUser() user: JwtPayload, @Body() dto: Record<string, unknown>) {
    return this.documentsService.saveDocument(c, user.sub, dto as never);
  }

  @Get(':id/download-url') downloadUrl(@Param('id') id: string, @CompanyId() c: string) {
    return this.documentsService.getPresignedDownloadUrl(id, c);
  }

  @Delete(':id') remove(@Param('id') id: string, @CompanyId() c: string) {
    return this.documentsService.deleteDocument(id, c);
  }
}
