export class RegisterDto {
  email: string;
  password: string;
  name: string;
  role: 'transportista' | 'dador';
  phone?: string;
  dni?: string;
  // Shipper-specific
  tipo_dador?: 'empresa' | 'personal';
  razon_social?: string;
  cuit?: string;
  address?: string;
}
