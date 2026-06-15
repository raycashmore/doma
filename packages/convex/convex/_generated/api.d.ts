/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as briefing_ai from "../briefing/ai.js";
import type * as briefing_botBriefing from "../briefing/botBriefing.js";
import type * as briefing_delivery from "../briefing/delivery.js";
import type * as briefing_deliveryRunner from "../briefing/deliveryRunner.js";
import type * as briefing_deliveryStore from "../briefing/deliveryStore.js";
import type * as briefing_errors from "../briefing/errors.js";
import type * as briefing_generation from "../briefing/generation.js";
import type * as briefing_morning from "../briefing/morning.js";
import type * as budgetDisplayMonth from "../budgetDisplayMonth.js";
import type * as budgetSummary from "../budgetSummary.js";
import type * as crons from "../crons.js";
import type * as helpers from "../helpers.js";
import type * as lists_auth from "../lists/auth.js";
import type * as lists_model from "../lists/model.js";
import type * as lists_mutations from "../lists/mutations.js";
import type * as lists_queries from "../lists/queries.js";
import type * as monthDetail from "../monthDetail.js";
import type * as monthlyBreakdown from "../monthlyBreakdown.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as schedule_config from "../schedule/config.js";
import type * as schedule_credentials from "../schedule/credentials.js";
import type * as schedule_mapping from "../schedule/mapping.js";
import type * as schedule_queries from "../schedule/queries.js";
import type * as schedule_reminderRunner from "../schedule/reminderRunner.js";
import type * as schedule_reminderStore from "../schedule/reminderStore.js";
import type * as schedule_reminders from "../schedule/reminders.js";
import type * as schedule_sync from "../schedule/sync.js";
import type * as schedule_syncPolicy from "../schedule/syncPolicy.js";
import type * as schedule_week from "../schedule/week.js";
import type * as seed from "../seed.js";
import type * as spendingSummary from "../spendingSummary.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "briefing/ai": typeof briefing_ai;
  "briefing/botBriefing": typeof briefing_botBriefing;
  "briefing/delivery": typeof briefing_delivery;
  "briefing/deliveryRunner": typeof briefing_deliveryRunner;
  "briefing/deliveryStore": typeof briefing_deliveryStore;
  "briefing/errors": typeof briefing_errors;
  "briefing/generation": typeof briefing_generation;
  "briefing/morning": typeof briefing_morning;
  budgetDisplayMonth: typeof budgetDisplayMonth;
  budgetSummary: typeof budgetSummary;
  crons: typeof crons;
  helpers: typeof helpers;
  "lists/auth": typeof lists_auth;
  "lists/model": typeof lists_model;
  "lists/mutations": typeof lists_mutations;
  "lists/queries": typeof lists_queries;
  monthDetail: typeof monthDetail;
  monthlyBreakdown: typeof monthlyBreakdown;
  mutations: typeof mutations;
  queries: typeof queries;
  "schedule/config": typeof schedule_config;
  "schedule/credentials": typeof schedule_credentials;
  "schedule/mapping": typeof schedule_mapping;
  "schedule/queries": typeof schedule_queries;
  "schedule/reminderRunner": typeof schedule_reminderRunner;
  "schedule/reminderStore": typeof schedule_reminderStore;
  "schedule/reminders": typeof schedule_reminders;
  "schedule/sync": typeof schedule_sync;
  "schedule/syncPolicy": typeof schedule_syncPolicy;
  "schedule/week": typeof schedule_week;
  seed: typeof seed;
  spendingSummary: typeof spendingSummary;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
