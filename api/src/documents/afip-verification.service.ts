import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AfipVerificationService {
  constructor(private readonly httpService: HttpService) {}

  calcularDigitoVerificador(prefijo: string, dni: string): number {
    const completo = prefijo + dni;
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      suma += parseInt(completo[i]) * pesos[i];
    }
    const resto = suma % 11;
    if (resto === 0) return 0;
    if (resto === 1) return prefijo === '23' ? 9 : 4;
    return 11 - resto;
  }

  generarCuilsPosibles(dni: string): string[] {
    const dniPadded = dni.padStart(8, '0');
    const prefijos = ['20', '27', '23'];
    return prefijos.map((p) => {
      const digito = this.calcularDigitoVerificador(p, dniPadded);
      return `${p}${dniPadded}${digito}`;
    });
  }

  async consultarAfip(
    cuil: string,
  ): Promise<{ nombre: string; apellido: string } | null> {
    const url = `https://soa.afip.gob.ar/sr-padron/v2/persona/${cuil}`;
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url, { timeout: 8000 }),
      );
      if (response.data?.data) {
        return {
          nombre: response.data.data.nombre || '',
          apellido: response.data.data.apellido || '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  compararNombres(
    nombreRegistrado: string,
    nombreAfip: string,
    apellidoAfip: string,
  ): boolean {
    const normalizar = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .split(/\s+/);

    const tokensRegistrado = normalizar(nombreRegistrado);
    const tokensAfip = [...normalizar(apellidoAfip), ...normalizar(nombreAfip)];

    const minCoincidencias = Math.min(2, tokensRegistrado.length);
    let coincidencias = 0;
    for (const token of tokensRegistrado) {
      if (tokensAfip.includes(token)) coincidencias++;
    }
    return coincidencias >= minCoincidencias;
  }

  async verificarIdentidad(
    dni: string,
    nombreRegistrado: string,
  ): Promise<{
    verified: boolean;
    cuil_encontrado?: string;
    message: string;
  }> {
    const cuils = this.generarCuilsPosibles(dni);

    for (const cuil of cuils) {
      const persona = await this.consultarAfip(cuil);
      if (persona) {
        const coincide = this.compararNombres(
          nombreRegistrado,
          persona.nombre,
          persona.apellido,
        );
        if (coincide) {
          return {
            verified: true,
            cuil_encontrado: cuil,
            message: `Identidad verificada contra AFIP (CUIL: ${cuil})`,
          };
        }
      }
    }

    return {
      verified: false,
      message:
        'No se pudo verificar la identidad contra AFIP. El nombre no coincide o el DNI no está registrado.',
    };
  }
}
