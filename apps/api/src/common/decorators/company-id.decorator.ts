import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CompanyId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: { companyId?: string } }>();
  return (
    request.headers['x-company-id'] ??
    request.user?.companyId ??
    ''
  );
});
