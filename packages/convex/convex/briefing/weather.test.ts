import { describe, expect, it, vi } from 'vitest';

import { loadMorningBriefingWeatherContext } from './weather';

const localDate = '2026-06-12';
const timeZone = 'Australia/Sydney';

describe('loadMorningBriefingWeatherContext', () => {
  it('summarizes local morning and afternoon readiness from Open-Meteo hourly data', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hourly: {
              time: ['2026-06-12T07:00', '2026-06-12T09:00', '2026-06-12T13:00', '2026-06-12T15:00'],
              temperature_2m: [9, 11, 15, 14],
              apparent_temperature: [6, 8, 13, 12],
              relative_humidity_2m: [65, 67, 60, 62],
              precipitation_probability: [10, 20, 75, 80],
              wind_gusts_10m: [12, 18, 34, 42],
              uv_index: [0, 2, 5, 3]
            }
          })
        )
    );

    const context = await loadMorningBriefingWeatherContext({
      localDate,
      timeZone,
      latitude: -33.86,
      longitude: 151.2,
      fetchImpl
    });

    expect(context).toEqual({
      summary: 'Cold morning, wet and windy afternoon.',
      morning: {
        temperatureC: { min: 9, max: 11 },
        apparentTemperatureC: { min: 6, max: 8 },
        relativeHumidityPercent: { min: 65, max: 67 },
        rainChancePercent: 20,
        maxWindGustKph: 18,
        maxUvIndex: 2,
        readiness: ['warm layer']
      },
      afternoon: {
        temperatureC: { min: 14, max: 15 },
        apparentTemperatureC: { min: 12, max: 13 },
        relativeHumidityPercent: { min: 60, max: 62 },
        rainChancePercent: 80,
        maxWindGustKph: 42,
        maxUvIndex: 5,
        readiness: ['rain layer', 'wind-aware pickup']
      }
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const calls = fetchImpl.mock.calls as unknown as [[string]];
    const url = new URL(calls[0][0]);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('-33.86');
    expect(url.searchParams.get('longitude')).toBe('151.2');
    expect(url.searchParams.get('start_date')).toBe(localDate);
    expect(url.searchParams.get('end_date')).toBe(localDate);
    expect(url.searchParams.get('timezone')).toBe(timeZone);
    expect(url.searchParams.get('hourly')).toBe(
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,wind_gusts_10m,uv_index'
    );
  });

  it('returns null when Open-Meteo returns an unusable response', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ hourly: { time: [] } })));

    await expect(
      loadMorningBriefingWeatherContext({
        localDate,
        timeZone,
        latitude: -33.86,
        longitude: 151.2,
        fetchImpl
      })
    ).resolves.toBeNull();
  });

  it('summarizes hot and high-UV readiness without calling it ordinary', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hourly: {
              time: ['2026-06-12T07:00', '2026-06-12T09:00', '2026-06-12T13:00', '2026-06-12T15:00'],
              temperature_2m: [24, 28, 32, 33],
              apparent_temperature: [24, 28, 34, 35],
              precipitation_probability: [0, 0, 5, 5],
              wind_gusts_10m: [10, 12, 15, 18],
              uv_index: [2, 5, 8, 7]
            }
          })
        )
    );

    const context = await loadMorningBriefingWeatherContext({
      localDate,
      timeZone,
      latitude: -33.86,
      longitude: 151.2,
      fetchImpl
    });

    expect(context?.summary).toBe('Hot afternoon, high UV afternoon.');
    expect(context?.afternoon.readiness).toEqual(['heat plan', 'sun protection']);
  });

  it('mentions allergy-relevant humidity only when relative humidity is high', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hourly: {
              time: ['2026-06-12T07:00', '2026-06-12T09:00', '2026-06-12T13:00', '2026-06-12T15:00'],
              temperature_2m: [18, 20, 23, 24],
              apparent_temperature: [18, 20, 23, 24],
              relative_humidity_2m: [82, 84, 62, 60],
              precipitation_probability: [0, 0, 0, 0],
              wind_gusts_10m: [10, 12, 15, 18],
              uv_index: [1, 3, 5, 4]
            }
          })
        )
    );

    const context = await loadMorningBriefingWeatherContext({
      localDate,
      timeZone,
      latitude: -33.86,
      longitude: 151.2,
      fetchImpl
    });

    expect(context?.summary).toBe('High morning humidity for allergy control.');
    expect(context?.morning.relativeHumidityPercent).toEqual({ min: 82, max: 84 });
    expect(context?.morning.readiness).toEqual(['allergy humidity']);
    expect(context?.afternoon.relativeHumidityPercent).toEqual({ min: 60, max: 62 });
    expect(context?.afternoon.readiness).toEqual([]);
  });

  it('skips isolated null hourly values instead of dropping the whole forecast', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hourly: {
              time: ['2026-06-12T07:00', '2026-06-12T09:00', '2026-06-12T13:00', '2026-06-12T15:00'],
              temperature_2m: [9, 11, 15, 14],
              apparent_temperature: [6, 8, 13, 12],
              precipitation_probability: [null, 20, 75, null],
              wind_gusts_10m: [12, null, 34, 42],
              uv_index: [null, 2, null, 3]
            }
          })
        )
    );

    const context = await loadMorningBriefingWeatherContext({
      localDate,
      timeZone,
      latitude: -33.86,
      longitude: 151.2,
      fetchImpl
    });

    expect(context).toMatchObject({
      summary: 'Cold morning, wet and windy afternoon.',
      morning: {
        rainChancePercent: 20,
        maxWindGustKph: 12,
        maxUvIndex: 2,
        readiness: ['warm layer']
      },
      afternoon: {
        rainChancePercent: 75,
        maxWindGustKph: 42,
        maxUvIndex: 3,
        readiness: ['rain layer', 'wind-aware pickup']
      }
    });
  });

  it('returns null when the forecast request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network unavailable');
    });

    await expect(
      loadMorningBriefingWeatherContext({
        localDate,
        timeZone,
        latitude: -33.86,
        longitude: 151.2,
        fetchImpl
      })
    ).resolves.toBeNull();
  });
});
