export class RegisterDto {
  email: string;
  password: string;
  name: string;
  role: 'transportista' | 'flota' | 'empleado' | 'dador';
  phone?: string;
  dni?: string;
  dni_photo_url?: string;
  invitation_token?: string;
  // Shipper-specific
  tipo_dador?: 'empresa' | 'personal';
  razon_social?: string;
  cuit?: string;
  address?: string;
}
