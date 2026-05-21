import { IsString, IsDateString, IsArray, ValidateNested, IsNumber, IsOptional, IsUUID, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class JournalLineDto {
  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiProperty({ example: '1000.0000', description: 'Debit amount (0 if credit line)' })
  @IsString()
  debitAmount: string;

  @ApiProperty({ example: '0.0000', description: 'Credit amount (0 if debit line)' })
  @IsString()
  creditAmount: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangeRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  lineNo?: number;
}

export class CreateJournalEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiProperty({ example: 'JE-2026-001' })
  @IsString()
  reference: string;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Purchase of office supplies' })
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiProperty({ type: [JournalLineDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
