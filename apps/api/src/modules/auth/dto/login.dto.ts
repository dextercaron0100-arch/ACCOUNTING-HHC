import { IsEmail, IsString, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@demoenterprise.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@1234!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'demo-company-id' })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
