import { cronJobs, type FunctionReference } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

type BriefingDeliveryScheduleStoreRefs = {
  reconcileMorningBriefingDeliverySchedule: FunctionReference<'mutation', 'internal', Record<string, never>, unknown>;
};

type EmailDeliveryRunnerRefs = {
  runDueEmailReminderDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type EmailTriageRefs = {
  runDueForwardedEmailTriage: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type SpendingInsightGenerationRefs = {
  runDueSpendingInsightSweep: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type SpendingInsightDeliveryRunnerRefs = {
  runDueSpendingInsightDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type MealAgentCleanupRefs = {
  deleteExpiredRuns: FunctionReference<'mutation', 'internal', Record<string, never>, unknown>;
};

type EmailAgentCleanupRefs = {
  deleteExpiredRuns: FunctionReference<'mutation', 'internal', Record<string, never>, unknown>;
};

const briefingDeliveryScheduleStore: BriefingDeliveryScheduleStoreRefs = (
  internal as unknown as { briefing: { deliveryScheduleStore: BriefingDeliveryScheduleStoreRefs } }
).briefing.deliveryScheduleStore;

const emailDeliveryRunner: EmailDeliveryRunnerRefs = (
  internal as unknown as {
    email: {
      deliveryRunner: EmailDeliveryRunnerRefs;
    };
  }
).email.deliveryRunner;

const emailTriage: EmailTriageRefs = (
  internal as unknown as {
    email: {
      triage: EmailTriageRefs;
    };
  }
).email.triage;

const insightGeneration: SpendingInsightGenerationRefs = (
  internal as unknown as {
    insights: {
      generation: SpendingInsightGenerationRefs;
    };
  }
).insights.generation;

const insightDeliveryRunner: SpendingInsightDeliveryRunnerRefs = (
  internal as unknown as {
    insights: {
      deliveryRunner: SpendingInsightDeliveryRunnerRefs;
    };
  }
).insights.deliveryRunner;

const mealAgentCleanup: MealAgentCleanupRefs = (
  internal as unknown as { meals: { agentCleanup: MealAgentCleanupRefs } }
).meals.agentCleanup;

const emailAgentCleanup: EmailAgentCleanupRefs = (
  internal as unknown as { email: { agentCleanup: EmailAgentCleanupRefs } }
).email.agentCleanup;

crons.interval(
  'morning briefing delivery schedule reconciliation',
  { hours: 24 },
  briefingDeliveryScheduleStore.reconcileMorningBriefingDeliverySchedule
);
crons.interval('forwarded email triage', { minutes: 15 }, emailTriage.runDueForwardedEmailTriage);
crons.interval('monthly spending insight sweep', { hours: 12 }, insightGeneration.runDueSpendingInsightSweep);
crons.interval('monthly spending insight delivery', { hours: 1 }, insightDeliveryRunner.runDueSpendingInsightDelivery);
crons.daily('weekly meal agent trace cleanup', { hourUTC: 15, minuteUTC: 0 }, mealAgentCleanup.deleteExpiredRuns);
crons.interval('email triage agent trace cleanup', { hours: 1 }, emailAgentCleanup.deleteExpiredRuns);
crons.interval('forwarded email reminder delivery', { minutes: 15 }, emailDeliveryRunner.runDueEmailReminderDelivery);

export default crons;
