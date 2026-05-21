import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalBalance } from '@prisma/client';

export class CreateAccountDto {
  @ApiPropertyOptional({ description: 'Parent account ID for sub-account' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'Account type ID' })
  @IsUUID()
  accountTypeId: string;

  @ApiPropertyOptional({ description: 'Currency ID (for foreign currency accounts)' })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiProperty({ example: '1001', description: 'Account code (must be unique per company)' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Cash in Bank' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: NormalBalance })
  @IsEnum(NormalBalance)
  normalBalance: NormalBalance;
}
