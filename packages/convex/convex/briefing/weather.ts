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
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  wind_gusts_10m: number[];
  uv_index: number[];
};

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
  const temperature = numberArray(hourly.temperature_2m);
  const apparentTemperature = numberArray(hourly.apparent_temperature);
  const precipitationProbability = numberArray(hourly.precipitation_probability);
  const windGusts = numberArray(hourly.wind_gusts_10m);
  const uvIndex = numberArray(hourly.uv_index);
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
  const rainChance = max(valuesAt(hourly.precipitation_probability, indices));
  const windGust = max(valuesAt(hourly.wind_gusts_10m, indices));
  const uvIndex = max(valuesAt(hourly.uv_index, indices));
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
  if (afternoon.readiness.includes('rain layer') && afternoon.readiness.includes('wind-aware pickup')) {
    parts.push('wet and windy afternoon');
  } else if (afternoon.readiness.includes('rain layer')) {
    parts.push('wet afternoon');
  } else if (afternoon.readiness.includes('wind-aware pickup')) {
    parts.push('windy afternoon');
  }
  if (parts.length === 0) return 'Weather looks ordinary for readiness.';
  return `${parts.join(', ')}.`;
}

function valuesAt(values: number[], indices: number[]) {
  return indices.map((index) => values[index] ?? 0);
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

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function numberArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
