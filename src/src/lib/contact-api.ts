import { apiUrl } from './profile-api';

export type ContactSubmissionPayload = {
  captchaToken?: string;
  consentAccepted: boolean;
  email: string;
  locale: 'en' | 'es';
  message: string;
  name: string;
  pageUrl?: string;
  phoneCountryCode: string;
  phoneNumber: string;
  referrer?: string;
  source: string;
};

export async function submitContactSubmission(payload: ContactSubmissionPayload): Promise<void> {
  const response = await fetch(apiUrl('/api/contact-submissions'), {
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone_country_code: payload.phoneCountryCode,
      phone_number: payload.phoneNumber,
      message: payload.message,
      locale: payload.locale,
      source: payload.source,
      consent_accepted: payload.consentAccepted,
      captcha_token: payload.captchaToken,
      page_url: payload.pageUrl,
      referrer: payload.referrer,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await getContactResponseErrorMessage(response));
  }
}

async function getContactResponseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };

    if (typeof payload.message === 'string' && payload.message.trim() !== '') {
      return payload.message;
    }
  } catch {
    // Ignore invalid JSON and return a user-facing fallback.
  }

  return 'No fue posible enviar la solicitud.';
}
