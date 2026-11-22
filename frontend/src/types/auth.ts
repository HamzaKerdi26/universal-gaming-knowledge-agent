export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthCredentials {
  username: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}