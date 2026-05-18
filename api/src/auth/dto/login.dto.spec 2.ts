import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth DTOs', () => {
  it('LoginDto can be instantiated with properties', () => {
    const dto = new LoginDto();
    dto.email = 'test@test.com';
    dto.password = 'secret';
    expect(dto.email).toBe('test@test.com');
    expect(dto.password).toBe('secret');
  });

  it('RegisterDto can be instantiated with all properties', () => {
    const dto = new RegisterDto();
    dto.email = 'test@test.com';
    dto.password = 'secret';
    dto.name = 'Test';
    dto.role = 'transportista';
    dto.phone = '1234';
    dto.dni = '12345678';
    dto.dni_photo_url = 'http://example.com/photo.jpg';
    dto.invitation_token = 'token-abc';
    dto.tipo_dador = 'empresa';
    dto.razon_social = 'Empresa SA';
    dto.cuit = '30-1234-5';
    dto.address = 'Av. Test 123';
    expect(dto.email).toBe('test@test.com');
    expect(dto.role).toBe('transportista');
  });
});
