import { describe, expect, it, vi } from 'vitest';

import { buildInvalidationMessage, deliverInvalidations, isRetiredFcmResponse } from './widgetDelivery';

describe('isRetiredFcmResponse', () => {
  it('retires only a definitively unregistered Firebase token', () => {
    expect(isRetiredFcmResponse(404, {})).toBe(true);
    expect(
      isRetiredFcmResponse(400, {
        error: {
          details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }]
        }
      })
    ).toBe(true);
    expect(isRetiredFcmResponse(500, {})).toBe(false);
    expect(isRetiredFcmResponse(400, { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } })).toBe(false);
  });
});

describe('deliverInvalidations', () => {
  it('delivers opaque invalidations across pages and retires only invalid tokens', async () => {
    const send = vi.fn(async (device: { fcmToken: string }) =>
      device.fcmToken === 'expired_token'
        ? { ok: false, status: 404, payload: {} }
        : { ok: true, status: 200, payload: {} }
    );
    const retireInvalidToken = vi.fn(async () => undefined);
    const nextPage = vi.fn(async () => ({
      page: [{ id: 'device_two' as never, fcmToken: 'expired_token' }],
      continueCursor: '',
      isDone: true
    }));

    await deliverInvalidations({
      initialPage: {
        page: [{ id: 'device_one' as never, fcmToken: 'active_token' }],
        continueCursor: 'next_page',
        isDone: false
      },
      nextPage,
      send,
      retireInvalidToken
    });

    expect(nextPage).toHaveBeenCalledWith('next_page');
    expect(send).toHaveBeenCalledTimes(2);
    expect(retireInvalidToken).toHaveBeenCalledWith({ id: 'device_two', fcmToken: 'expired_token' });
  });
});

describe('buildInvalidationMessage', () => {
  it('contains only the opaque refresh signal and device token', () => {
    expect(buildInvalidationMessage('device_token')).toEqual({
      message: {
        token: 'device_token',
        data: { type: 'widget_invalidated' }
      }
    });
  });
});
