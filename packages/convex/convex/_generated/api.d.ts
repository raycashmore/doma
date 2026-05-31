/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as budgetDisplayMonth from "../budgetDisplayMonth.js";
import type * as budgetSummary from "../budgetSummary.js";
import type * as helpers from "../helpers.js";
import type * as monthDetail from "../monthDetail.js";
import type * as monthlyBreakdown from "../monthlyBreakdown.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as schedule_mapping from "../schedule/mapping.js";
import type * as schedule_queries from "../schedule/queries.js";
import type * as schedule_sync from "../schedule/sync.js";
import type * as schedule_week from "../schedule/week.js";
import type * as seed from "../seed.js";
import type * as spendingSummary from "../spendingSummary.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  budgetDisplayMonth: typeof budgetDisplayMonth;
  budgetSummary: typeof budgetSummary;
  helpers: typeof helpers;
  monthDetail: typeof monthDetail;
  monthlyBreakdown: typeof monthlyBreakdown;
  mutations: typeof mutations;
  queries: typeof queries;
  "schedule/mapping": typeof schedule_mapping;
  "schedule/queries": typeof schedule_queries;
  "schedule/sync": typeof schedule_sync;
  "schedule/week": typeof schedule_week;
  seed: typeof seed;
  spendingSummary: typeof spendingSummary;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
