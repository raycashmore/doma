import { cronJobs, type FunctionReference } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

type BriefingDeliveryRunnerRefs = {
  runDueMorningBriefingDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type EmailDeliveryRunnerRefs = {
  runDueEmailNoticeDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
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

const briefingDeliveryRunner: BriefingDeliveryRunnerRefs = (
  internal as unknown as {
    briefing: {
      deliveryRunner: BriefingDeliveryRunnerRefs;
    };
  }
).briefing.deliveryRunner;

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

crons.interval('morning briefing delivery', { minutes: 10 }, briefingDeliveryRunner.runDueMorningBriefingDelivery);
crons.interval('forwarded email triage', { hours: 12 }, emailTriage.runDueForwardedEmailTriage);
crons.interval('monthly spending insight sweep', { hours: 12 }, insightGeneration.runDueSpendingInsightSweep);
crons.interval('monthly spending insight delivery', { hours: 1 }, insightDeliveryRunner.runDueSpendingInsightDelivery);
crons.daily('weekly meal agent trace cleanup', { hourUTC: 15, minuteUTC: 0 }, mealAgentCleanup.deleteExpiredRuns);
crons.daily(
  'forwarded email notice delivery morning',
  { hourUTC: 21, minuteUTC: 0 },
  emailDeliveryRunner.runDueEmailNoticeDelivery
);
crons.daily(
  'forwarded email notice delivery midday',
  { hourUTC: 1, minuteUTC: 0 },
  emailDeliveryRunner.runDueEmailNoticeDelivery
);
crons.daily(
  'forwarded email notice delivery afternoon',
  { hourUTC: 5, minuteUTC: 0 },
  emailDeliveryRunner.runDueEmailNoticeDelivery
);
crons.daily(
  'forwarded email notice delivery evening',
  { hourUTC: 9, minuteUTC: 0 },
  emailDeliveryRunner.runDueEmailNoticeDelivery
);

export default crons;
