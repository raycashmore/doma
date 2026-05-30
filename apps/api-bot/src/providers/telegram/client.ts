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

export async function sendTelegramMessage({
  botToken,
  chatId,
  text
}: SendTelegramMessageRequest): Promise<SendTelegramMessageResult> {
  const response = await fetch(
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

  if (!response.ok) {
    return { ok: false, errorCode: String(response.status) };
  }

  return { ok: true };
}
