// Contrato que cumple cualquier cliente Veriff (real o mock).
// El service no sabe ni le importa cuál se usa — eso lo decide el módulo
// según el env var VERIFF_PROVIDER.

export type CreateSessionInput = {
  userId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  callbackUrl: string;
};

export type CreateSessionResult = {
  sessionId: string;  // ID interno de Veriff
  url: string;        // URL que el frontend abre para hacer selfie + DNI
};

export type WebhookPayload = {
  sessionId: string;
  status: 'approved' | 'declined' | 'resubmission';
  vendorData: string; // nuestro user_id (lo mandamos al crear sesión)
  raw: Record<string, unknown>; // todo el JSON del webhook (para log)
};

export const VERIFF_CLIENT = Symbol('VERIFF_CLIENT');

export interface VeriffClient {
  /** Crea una sesión de verificación. Devuelve la URL que el user va a abrir. */
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;

  /**
   * Valida la firma HMAC del webhook entrante.
   * El cliente real verifica con SHA256 + API_SECRET.
   * El cliente mock devuelve true siempre.
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;

  /** Parsea el body del webhook a nuestro formato canónico. */
  parseWebhook(body: Record<string, unknown>): WebhookPayload;
}
