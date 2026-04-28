import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'fs';

@Injectable()
export class DniVisionService {
  async extractTextFromFile(filePath: string): Promise<string> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('Google Vision no configurado');

    const imageBase64 = readFileSync(filePath).toString('base64');

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      },
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({})) as any;
      const reason = errData?.error?.status ?? 'ERROR';
      if (reason === 'PERMISSION_DENIED') {
        throw new ServiceUnavailableException('El servicio de verificación no está disponible en este momento. Contactá al soporte.');
      }
      throw new ServiceUnavailableException('Error al procesar la imagen. Intentá de nuevo.');
    }

    const data = await response.json() as any;
    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) return '';
    return annotations[0].description ?? '';
  }

  /** Checks if at least `min` keywords from the list appear in the (uppercased) text */
  private hasKeywords(text: string, keywords: string[], min: number): boolean {
    const upper = text.toUpperCase();
    const found = keywords.filter(k => upper.includes(k.toUpperCase()));
    return found.length >= min;
  }

  /** Returns true only if the image looks like an Argentine DNI */
  isDniDocument(text: string): boolean {
    const keywords = [
      'REPUBLICA ARGENTINA', 'REPÚBLICA ARGENTINA',
      'DOCUMENTO NACIONAL DE IDENTIDAD', 'DNI',
      'APELLIDO', 'APELL',
      'NOMBRES', 'NOMBRE',
      'SEXO', 'GENERO', 'GÉNERO',
      'NACIMIENTO', 'NACIDO',
      'IDENTIDAD',
    ];
    return this.hasKeywords(text, keywords, 3);
  }

  /** Returns true only if the image looks like an Argentine driver's license */
  isLicenseDocument(text: string): boolean {
    const keywords = [
      'LICENCIA', 'CONDUCIR', 'CONDUCTOR',
      'HABILITANTE', 'CLASE', 'CATEGORIA', 'CATEGORÍA',
      'PERMISO', 'MUNICIPAL',
    ];
    return this.hasKeywords(text, keywords, 2);
  }

  /** Returns true only if the image looks like a VTV certificate */
  isVtvDocument(text: string): boolean {
    const keywords = [
      'VTV', 'VERIFICACION', 'VERIFICACIÓN',
      'TECNICA', 'TÉCNICA', 'VEHICULAR',
      'DOMINIO', 'PATENTE',
      'VENCIMIENTO', 'VIGENCIA',
    ];
    return this.hasKeywords(text, keywords, 2);
  }

  /** Returns true only if the image looks like a vehicle insurance document */
  isSeguroDocument(text: string): boolean {
    const keywords = [
      'SEGURO', 'PÓLIZA', 'POLIZA',
      'ASEGURADO', 'ASEGURADA',
      'VIGENCIA', 'VENCIMIENTO',
      'COBERTURA', 'PRIMA', 'ASEGURADORA',
      'AUTOMOTOR', 'VEHICULO', 'VEHÍCULO',
    ];
    return this.hasKeywords(text, keywords, 2);
  }

  dniFoundInText(text: string, dni: string): boolean {
    const normalize = (s: string) => s.replace(/[\s.\-_]/g, '');
    return normalize(text).includes(normalize(dni));
  }

  plateFoundInText(text: string, patente: string): boolean {
    const normalize = (s: string) => s.replace(/[\s\-\.]/g, '').toUpperCase();
    return normalize(text).includes(normalize(patente));
  }

  extractExpiryDate(text: string): Date | null {
    const now = new Date();
    // Try DD/MM/YYYY
    const fullDates = [...text.matchAll(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/g)];
    if (fullDates.length > 0) {
      const future = fullDates
        .map(m => new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])))
        .filter(d => d > now && d.getFullYear() > 2020)
        .sort((a, b) => b.getTime() - a.getTime());
      if (future.length > 0) return future[0];
    }
    // Try MM/YYYY
    const monthDates = [...text.matchAll(/\b(\d{2})[\/\-](\d{4})\b/g)];
    if (monthDates.length > 0) {
      const future = monthDates
        .map(m => new Date(parseInt(m[2]), parseInt(m[1]) - 1, 1))
        .filter(d => d > now && d.getFullYear() > 2020)
        .sort((a, b) => b.getTime() - a.getTime());
      if (future.length > 0) return future[0];
    }
    return null;
  }
}
