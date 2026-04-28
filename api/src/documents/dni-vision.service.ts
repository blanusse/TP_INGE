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
      const err = await response.text();
      throw new ServiceUnavailableException(`Google Vision error: ${err}`);
    }

    const data = await response.json() as any;
    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) return '';
    return annotations[0].description ?? '';
  }

  dniFoundInText(text: string, dni: string): boolean {
    // Remove formatting characters to compare raw digit sequences
    const normalize = (s: string) => s.replace(/[\s.\-_]/g, '');
    const normalizedText = normalize(text);
    const normalizedDni = normalize(dni);
    return normalizedText.includes(normalizedDni);
  }
}
