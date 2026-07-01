export type TelegramMessageRequest = {
  chatId: string;
  text: string;
};

export type SendTelegramMessageResult = { ok: true } | { ok: false; errorCode: string };

export type TelegramMessageSender = (request: TelegramMessageRequest) => Promise<SendTelegramMessageResult>;

export type SendTelegramMessageRequest = TelegramMessageRequest & {
  botToken: string;
};

type TelegramSendMessageResponse = {
  ok?: boolean;
  error_code?: number;
};

type TelegramMessageEntity = {
  type: 'bold';
  offset: number;
  length: number;
};

const boldKeywordPattern = /\b(swimming|dancing|library|homework|sport)\b/gi;

function boldKeywordEntities(text: string): TelegramMessageEntity[] {
  return [...text.matchAll(boldKeywordPattern)].map((match) => ({
    type: 'bold',
    offset: match.index ?? 0,
    length: match[0].length
  }));
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
  const entities = boldKeywordEntities(text);

  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(entities.length > 0 ? { entities } : {})
      })
    });
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
      errorCode: telegramResponse.error_code ? String(telegramResponse.error_code) : 'telegram_error'
    };
  }

  return { ok: true };
}
