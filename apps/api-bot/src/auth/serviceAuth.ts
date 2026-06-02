import { createHash, timingSafeEqual } from 'node:crypto';

const bearerTokenPattern = /^Bearer ([^\s]+)$/u;

function constantTimeTokenEquals(value: string, expected: string) {
  const valueDigest = createHash('sha256').update(value).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();

  return timingSafeEqual(valueDigest, expectedDigest);
}

export function isAuthorizedServiceRequest(request: Request, serviceToken: string) {
  if (serviceToken.length === 0) {
    return false;
  }

  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return false;
  }

  const match = bearerTokenPattern.exec(authorization);

  if (!match) {
    return false;
  }

  const token = match[1];

  if (!token) {
    return false;
  }

  return constantTimeTokenEquals(token, serviceToken);
}
