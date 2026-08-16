import { describe, expect, it, vi } from 'vitest';

import { registerWidgetDeviceHandler, unregisterWidgetDeviceHandler } from './widgetDevices';

type DeviceRow = {
  _id: string;
  userId: string;
  installationId: string;
  fcmToken: string;
  updatedAt: number;
};

function createMutationCtx(identity: { subject: string } | null, devices: DeviceRow[] = []) {
  const state = { devices: [...devices] };
  const inserted: Array<Omit<DeviceRow, '_id'>> = [];
  const patched: Array<{ id: string; patch: Partial<DeviceRow> }> = [];
  const deleted: string[] = [];

  return {
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        query: (table: string) => {
          expect(table).toBe('androidWidgetDevices');
          return {
            withIndex: (
              index: string,
              apply: (query: {
                eq: (field: string, value: string) => { eq: (field: string, value: string) => unknown };
              }) => unknown
            ) => {
              expect(index).toBe('by_user_id_and_installation_id');
              const filters: Array<{ field: string; value: string }> = [];
              apply({
                eq: (field, value) => {
                  filters.push({ field, value });
                  return {
                    eq: (nextField, nextValue) => {
                      filters.push({ field: nextField, value: nextValue });
                      return nextValue;
                    }
                  };
                }
              });
              return {
                unique: async () =>
                  state.devices.find(
                    (device) => device.userId === filters[0]?.value && device.installationId === filters[1]?.value
                  ) ?? null
              };
            }
          };
        },
        insert: async (_table: string, row: Omit<DeviceRow, '_id'>) => {
          inserted.push(row);
          return 'new_device';
        },
        patch: async (id: string, patch: Partial<DeviceRow>) => {
          patched.push({ id, patch });
        },
        delete: async (id: string) => {
          deleted.push(id);
        }
      }
    },
    inserted,
    patched,
    deleted
  };
}

describe('widget device registration', () => {
  it('upserts the caller scoped device without accepting an unauthenticated registration', async () => {
    const { ctx, inserted } = createMutationCtx({ subject: 'user_a' });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await registerWidgetDeviceHandler(ctx as never, {
      installationId: 'installation_a',
      fcmToken: 'token_a'
    });

    expect(inserted).toEqual([
      {
        userId: 'user_a',
        installationId: 'installation_a',
        fcmToken: 'token_a',
        updatedAt: 1_700_000_000_000
      }
    ]);
  });

  it('updates an existing caller device and does not create a duplicate', async () => {
    const { ctx, inserted, patched } = createMutationCtx({ subject: 'user_a' }, [
      {
        _id: 'device_a',
        userId: 'user_a',
        installationId: 'installation_a',
        fcmToken: 'old_token',
        updatedAt: 1
      }
    ]);

    await registerWidgetDeviceHandler(ctx as never, {
      installationId: 'installation_a',
      fcmToken: 'new_token'
    });

    expect(inserted).toEqual([]);
    expect(patched).toEqual([{ id: 'device_a', patch: { fcmToken: 'new_token', updatedAt: expect.any(Number) } }]);
  });

  it('removes only the matching caller registration', async () => {
    const { ctx, deleted } = createMutationCtx({ subject: 'user_a' }, [
      {
        _id: 'device_a',
        userId: 'user_a',
        installationId: 'installation_a',
        fcmToken: 'token_a',
        updatedAt: 1
      },
      {
        _id: 'device_b',
        userId: 'user_b',
        installationId: 'installation_a',
        fcmToken: 'token_b',
        updatedAt: 1
      }
    ]);

    await unregisterWidgetDeviceHandler(ctx as never, { installationId: 'installation_a' });

    expect(deleted).toEqual(['device_a']);
  });
});
