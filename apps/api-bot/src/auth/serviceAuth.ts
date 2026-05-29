export function isAuthorizedServiceRequest(
  request: Request,
  serviceToken: string
) {
  return request.headers.get('authorization') === `Bearer ${serviceToken}`;
}
