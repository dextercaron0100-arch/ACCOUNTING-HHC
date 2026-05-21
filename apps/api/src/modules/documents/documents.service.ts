import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as Minio from 'minio';

@Injectable()
export class DocumentsService {
  private readonly minioClient: Minio.Client;
  private readonly bucket = 'accounting-documents';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    const url = new URL(endpoint);
    this.minioClient = new Minio.Client({
      endPoint: url.hostname,
      port: parseInt(url.port || (url.protocol === 'https:' ? '443' : '9000')),
      useSSL: url.protocol === 'https:',
      accessKey: this.config.get<string>('S3_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('S3_SECRET_KEY', 'minioadmin'),
    });
  }

  async ensureBucket() {
    const exists = await this.minioClient.bucketExists(this.bucket);
    if (!exists) await this.minioClient.makeBucket(this.bucket, 'us-east-1');
  }

  async getPresignedUploadUrl(companyId: string, filename: string, contentType: string) {
    await this.ensureBucket();
    const key = `${companyId}/${Date.now()}-${filename}`;
    const url = await this.minioClient.presignedPutObject(this.bucket, key, 15 * 60);
    return { key, uploadUrl: url, expiresIn: 900 };
  }

  async getPresignedDownloadUrl(documentId: string, companyId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.ensureBucket();
    const url = await this.minioClient.presignedGetObject(this.bucket, doc.s3Key, 15 * 60);
    return { url, expiresIn: 900, filename: doc.filename };
  }

  async saveDocument(companyId: string, userId: string, dto: { filename: string; s3Key: string; contentType: string; sizeBytes: number; referenceType?: string; referenceId?: string }) {
    return this.prisma.document.create({
      data: { companyId, filename: dto.filename, s3Key: dto.s3Key, contentType: dto.contentType, sizeBytes: dto.sizeBytes, referenceType: dto.referenceType, referenceId: dto.referenceId, uploadedBy: userId },
    });
  }

  async findDocuments(companyId: string, referenceType?: string, referenceId?: string) {
    const where: Record<string, unknown> = { companyId };
    if (referenceType) where.referenceType = referenceType;
    if (referenceId) where.referenceId = referenceId;
    return this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async deleteDocument(documentId: string, companyId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.minioClient.removeObject(this.bucket, doc.s3Key);
    return this.prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
  }
}
