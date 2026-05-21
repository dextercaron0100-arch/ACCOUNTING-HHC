export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  requiresTwoFa: boolean;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  companies: CompanySummary[];
}

export interface CompanySummary {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
  role: string;
}
