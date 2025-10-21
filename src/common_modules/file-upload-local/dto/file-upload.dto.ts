import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UploadFileDto {
  @Field({ nullable: true })
  customPath?: string;

  @Field({ nullable: true })
  customFileName?: string;

  @Field({ nullable: true })
  preserveOriginalName?: boolean;

  @Field({ nullable: true })
  uploadedBy?: string;
}

// 简化的响应DTO，只返回id
@ObjectType()
export class FileUploadSimpleResponseDto {
  @Field()
  id: string;
}

@ObjectType()
export class FileUploadResponseDto {
  @Field()
  id: string;

  @Field()
  filePath: string;

  @Field()
  fileName: string;

  @Field(() => Int)
  size: number;

  @Field()
  md5Hash: string;

  @Field()
  isExisting: boolean;

  @Field()
  uploadedAt: Date;
}

@ObjectType()
export class FileMetadataDto {
  @Field()
  id: string;

  @Field()
  originalName: string;

  @Field()
  fileName: string;

  @Field()
  filePath: string;

  @Field()
  mimeType: string;

  @Field(() => Int)
  size: number;

  @Field()
  md5Hash: string;

  @Field()
  uploadedAt: Date;

  @Field({ nullable: true })
  uploadedBy?: string;
}

// 接口定义 (之前在interfaces文件中)
export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  md5Hash: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface FileUploadResult {
  id: string;
  filePath: string;
  fileName: string;
  size: number;
  md5Hash: string;
  isExisting: boolean;
  metadata: FileMetadata;
}

// 简化的接口，只包含id
export interface FileUploadSimpleResult {
  id: string;
}
