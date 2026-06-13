import { cronJobs, type FunctionReference } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

type BriefingDeliveryRunnerRefs = {
  runDueMorningBriefingDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

const briefingDeliveryRunner: BriefingDeliveryRunnerRefs = (
  internal as unknown as {
    briefing: {
      deliveryRunner: BriefingDeliveryRunnerRefs;
    };
  }
).briefing.deliveryRunner;

crons.interval('morning briefing delivery', { minutes: 10 }, briefingDeliveryRunner.runDueMorningBriefingDelivery);

export default crons;
