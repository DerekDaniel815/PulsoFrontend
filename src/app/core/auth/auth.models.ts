export type SystemRole = 'USUARIO' | 'ADMIN';

export interface PulsoUser {
  idUsuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  rol: SystemRole;
  estado: boolean;
  fechaRegistro: string;
  fechaActualizacion: string;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  nombres: string;
  apellidos: string;
  telefono?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PulsoUser;
}
