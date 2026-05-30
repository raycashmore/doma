export interface TelegramMessageRequest {
  chatId: string;
  text: string;
}

export type SendTelegramMessageResult =
  | { ok: true }
  | { ok: false; errorCode: string };

export type TelegramMessageSender = (
  request: TelegramMessageRequest
) => Promise<SendTelegramMessageResult>;

export interface SendTelegramMessageRequest extends TelegramMessageRequest {
  botToken: string;
}

interface TelegramSendMessageResponse {
  ok?: boolean;
  error_code?: number;
}

async function parseTelegramResponse(response: Response) {
  try {
    return (await response.json()) as TelegramSendMessageResponse;
  } catch {
    return null;
  }
}

export async function sendTelegramMessage({
  botToken,
  chatId,
  text
}: SendTelegramMessageRequest): Promise<SendTelegramMessageResult> {
  let response: Response;

  try {
    response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      }
    );
  } catch {
    return { ok: false, errorCode: 'network_error' };
  }

  if (!response.ok) {
    return { ok: false, errorCode: String(response.status) };
  }

  const telegramResponse = await parseTelegramResponse(response);

  if (telegramResponse?.ok === false) {
    return {
      ok: false,
      errorCode: telegramResponse.error_code
        ? String(telegramResponse.error_code)
        : 'telegram_error'
    };
  }

  return { ok: true };
}
