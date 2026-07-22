import { timingSafeEqual } from 'node:crypto';

function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authenticateServiceRequest(request: Request, expectedToken: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  return equalSecret(authorization.slice('Bearer '.length), expectedToken);
}
