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

crons.interval('morning briefing delivery', { minutes: 10 }, briefingDeliveryRunner.runDueMorningBriefingDelivery);
crons.interval('forwarded email triage', { minutes: 10 }, emailTriage.runDueForwardedEmailTriage);
crons.interval('forwarded email notice delivery', { minutes: 10 }, emailDeliveryRunner.runDueEmailNoticeDelivery);

export default crons;
