'use node';

import { v } from 'convex/values';
import { JWT } from 'google-auth-library';

import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { internalAction } from '../_generated/server';

type FirebaseServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type FirebaseErrorResponse = {
  error?: {
    details?: Array<{ '@type'?: string; errorCode?: string }>;
  };
};

type WidgetDevice = {
  id: Id<'androidWidgetDevices'>;
  fcmToken: string;
};

type WidgetDevicePage = {
  page: WidgetDevice[];
  continueCursor: string;
  isDone: boolean;
};

type FcmDeliveryResult = {
  ok: boolean;
  status: number;
  payload: FirebaseErrorResponse;
};

const messagingScope = 'https://www.googleapis.com/auth/firebase.messaging';

export function isRetiredFcmResponse(status: number, response: FirebaseErrorResponse) {
  if (status === 404) return true;
  return response.error?.details?.some((detail) => detail.errorCode === 'UNREGISTERED') ?? false;
}

export function buildInvalidationMessage(fcmToken: string) {
  return {
    message: {
      token: fcmToken,
      data: { type: 'widget_invalidated' }
    }
  };
}

export async function deliverInvalidations({
  initialPage,
  nextPage,
  send,
  retireInvalidToken
}: {
  initialPage: WidgetDevicePage;
  nextPage: (cursor: string) => Promise<WidgetDevicePage>;
  send: (device: WidgetDevice) => Promise<FcmDeliveryResult>;
  retireInvalidToken: (device: WidgetDevice) => Promise<void>;
}) {
  let devices = initialPage;
  while (true) {
    await Promise.all(
      devices.page.map(async (device) => {
        const result = await send(device);
        if (isRetiredFcmResponse(result.status, result.payload)) await retireInvalidToken(device);
      })
    );

    if (devices.isDone) return;
    devices = await nextPage(devices.continueCursor);
  }
}

function readServiceAccount() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error('Firebase messaging is not configured');

  const serviceAccount = JSON.parse(rawServiceAccount) as FirebaseServiceAccount;
  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('Firebase messaging service account is invalid');
  }
  return serviceAccount;
}

async function accessToken(serviceAccount: FirebaseServiceAccount) {
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: [messagingScope]
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Unable to authorize Firebase messaging');
  return token.token;
}

export const sendInvalidations = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const devices = await ctx.runQuery(internal.lists.widgetDevices.listRegisteredDevices, {
      paginationOpts: { cursor: null, numItems: 100 }
    });
    if (devices.page.length === 0) return null;

    const serviceAccount = readServiceAccount();
    const token = await accessToken(serviceAccount);

    await deliverInvalidations({
      initialPage: devices,
      nextPage: async (cursor) =>
        ctx.runQuery(internal.lists.widgetDevices.listRegisteredDevices, {
          paginationOpts: { cursor, numItems: 100 }
        }),
      send: async (device) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(buildInvalidationMessage(device.fcmToken))
          }
        );

        return {
          ok: response.ok,
          status: response.status,
          payload: response.ok ? {} : ((await response.json().catch(() => ({}))) as FirebaseErrorResponse)
        };
      },
      retireInvalidToken: async (device) => {
        await ctx.runMutation(internal.lists.widgetDevices.retireInvalidToken, {
          deviceId: device.id,
          fcmToken: device.fcmToken
        });
      }
    });

    return null;
  }
});
