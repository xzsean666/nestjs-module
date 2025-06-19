export interface CreateInviteCodeDto {
  username: string;
}

export interface VerifyInviteCodeDto {
  inviteCode: string;
}

export interface InviteCodeInfo {
  code: string;
  username: string;
  createdAt?: string;
}

export interface InviteCodeResponse {
  code: string;
  success: boolean;
  message?: string;
}
