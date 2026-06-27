export type WeatherReadinessBlock = {
  temperatureC: { min: number; max: number };
  apparentTemperatureC: { min: number; max: number };
  rainChancePercent: number;
  maxWindGustKph: number;
  maxUvIndex: number;
  readiness: string[];
};

export type MorningBriefingWeatherContext = {
  summary: string;
  morning: WeatherReadinessBlock;
  afternoon: WeatherReadinessBlock;
};

type LoadMorningBriefingWeatherContextArgs = {
  localDate: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  fetchImpl?: typeof fetch;
};

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: WeatherValue[];
  apparent_temperature: WeatherValue[];
  precipitation_probability: WeatherValue[];
  wind_gusts_10m: WeatherValue[];
  uv_index: WeatherValue[];
};

type WeatherValue = number | null;

const hourlyFields = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'wind_gusts_10m',
  'uv_index'
];

export async function loadMorningBriefingWeatherContext({
  localDate,
  timeZone,
  latitude,
  longitude,
  fetchImpl = fetch
}: LoadMorningBriefingWeatherContextArgs): Promise<MorningBriefingWeatherContext | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  let response: Response;
  try {
    response = await fetchImpl(openMeteoForecastUrl({ localDate, timeZone, latitude, longitude }));
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    return null;
  }
  const hourly = parseHourly(body);
  if (!hourly) return null;

  const morning = summarizeBlock(hourly, localDate, 6, 12);
  const afternoon = summarizeBlock(hourly, localDate, 12, 18);
  if (!morning || !afternoon) return null;

  return {
    summary: summarizeDay(morning, afternoon),
    morning,
    afternoon
  };
}

function openMeteoForecastUrl({
  localDate,
  timeZone,
  latitude,
  longitude
}: {
  localDate: string;
  timeZone: string;
  latitude: number;
  longitude: number;
}) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', localDate);
  url.searchParams.set('end_date', localDate);
  url.searchParams.set('timezone', timeZone);
  url.searchParams.set('hourly', hourlyFields.join(','));
  return url.toString();
}

function parseHourly(body: unknown): OpenMeteoHourly | null {
  if (!isRecord(body) || !isRecord(body.hourly)) return null;

  const hourly = body.hourly;
  const time = stringArray(hourly.time);
  const temperature = weatherValueArray(hourly.temperature_2m);
  const apparentTemperature = weatherValueArray(hourly.apparent_temperature);
  const precipitationProbability = weatherValueArray(hourly.precipitation_probability);
  const windGusts = weatherValueArray(hourly.wind_gusts_10m);
  const uvIndex = weatherValueArray(hourly.uv_index);
  if (!time || !temperature || !apparentTemperature || !precipitationProbability || !windGusts || !uvIndex) {
    return null;
  }

  const length = time.length;
  if (
    [temperature, apparentTemperature, precipitationProbability, windGusts, uvIndex].some(
      (values) => values.length !== length
    )
  ) {
    return null;
  }

  return {
    time,
    temperature_2m: temperature,
    apparent_temperature: apparentTemperature,
    precipitation_probability: precipitationProbability,
    wind_gusts_10m: windGusts,
    uv_index: uvIndex
  };
}

function summarizeBlock(
  hourly: OpenMeteoHourly,
  localDate: string,
  startHourInclusive: number,
  endHourExclusive: number
): WeatherReadinessBlock | null {
  const indices = hourly.time
    .map((time, index) => ({ index, localHour: localHourFor(time, localDate) }))
    .filter(({ localHour }) => localHour !== null && localHour >= startHourInclusive && localHour < endHourExclusive)
    .map(({ index }) => index);

  if (indices.length === 0) return null;

  const temperature = valuesAt(hourly.temperature_2m, indices);
  const apparentTemperature = valuesAt(hourly.apparent_temperature, indices);
  if (temperature.length === 0 || apparentTemperature.length === 0) return null;

  const rainChance = maxOrZero(valuesAt(hourly.precipitation_probability, indices));
  const windGust = maxOrZero(valuesAt(hourly.wind_gusts_10m, indices));
  const uvIndex = maxOrZero(valuesAt(hourly.uv_index, indices));
  const block = {
    temperatureC: range(temperature),
    apparentTemperatureC: range(apparentTemperature),
    rainChancePercent: rainChance,
    maxWindGustKph: windGust,
    maxUvIndex: uvIndex,
    readiness: readinessHints({
      apparentTemperatureMin: min(apparentTemperature),
      temperatureMax: max(temperature),
      rainChance,
      windGust,
      uvIndex
    })
  };

  return block;
}

function localHourFor(time: string, localDate: string) {
  if (!time.startsWith(`${localDate}T`)) return null;
  const hour = Number(time.slice(11, 13));
  return Number.isInteger(hour) ? hour : null;
}

function readinessHints({
  apparentTemperatureMin,
  temperatureMax,
  rainChance,
  windGust,
  uvIndex
}: {
  apparentTemperatureMin: number;
  temperatureMax: number;
  rainChance: number;
  windGust: number;
  uvIndex: number;
}) {
  const hints: string[] = [];
  if (apparentTemperatureMin <= 9) hints.push('warm layer');
  if (rainChance >= 60) hints.push('rain layer');
  if (temperatureMax >= 30) hints.push('heat plan');
  if (windGust >= 40) hints.push('wind-aware pickup');
  if (uvIndex >= 6) hints.push('sun protection');
  return hints;
}

function summarizeDay(morning: WeatherReadinessBlock, afternoon: WeatherReadinessBlock) {
  const parts: string[] = [];
  if (morning.readiness.includes('warm layer')) parts.push('Cold morning');
  if (morning.readiness.includes('rain layer')) parts.push('wet morning');
  if (morning.readiness.includes('wind-aware pickup')) parts.push('windy morning');
  if (morning.readiness.includes('heat plan')) parts.push('Hot morning');
  if (morning.readiness.includes('sun protection')) parts.push('high UV morning');
  summarizeAfternoon(afternoon, parts);
  if (parts.length === 0) return 'Weather looks ordinary for readiness.';
  return `${parts.join(', ')}.`;
}

function summarizeAfternoon(afternoon: WeatherReadinessBlock, parts: string[]) {
  if (afternoon.readiness.includes('rain layer') && afternoon.readiness.includes('wind-aware pickup')) {
    parts.push('wet and windy afternoon');
  } else if (afternoon.readiness.includes('rain layer')) {
    parts.push('wet afternoon');
  } else if (afternoon.readiness.includes('wind-aware pickup')) {
    parts.push('windy afternoon');
  }
  if (afternoon.readiness.includes('heat plan')) parts.push('Hot afternoon');
  if (afternoon.readiness.includes('sun protection')) parts.push('high UV afternoon');
}

function valuesAt(values: WeatherValue[], indices: number[]) {
  return indices.flatMap((index) => {
    const value = values[index];
    return typeof value === 'number' ? [value] : [];
  });
}

function range(values: number[]) {
  return { min: min(values), max: max(values) };
}

function min(values: number[]) {
  return Math.min(...values);
}

function max(values: number[]) {
  return Math.max(...values);
}

function maxOrZero(values: number[]) {
  return values.length > 0 ? max(values) : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function weatherValueArray(value: unknown) {
  return Array.isArray(value) &&
    value.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item)))
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
