import { Repeat } from 'lucide-react';

import { DAY_LABELS, MEMBERS, SWIMLANE_START_MINUTES, SWIMLANE_TOTAL_MINUTES } from './scheduleData';
import { getEventPosition, getOverlapJoiners, type ScheduleEvent } from './scheduleLayout';

type ScheduleSwimlanesProps = {
  events: ScheduleEvent[];
  nextUp: ScheduleEvent | null;
  selectedEventId?: string;
  todayDay?: string;
  nowMinutes: number | null;
  onSelect: (event: ScheduleEvent) => void;
};

function formatHour(hour: number): string {
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function memberIndex(memberId: string): number {
  return Math.max(
    0,
    MEMBERS.findIndex((member) => member.id === memberId)
  );
}

function nowLeftPercent(nowMinutes: number): number {
  return ((nowMinutes - SWIMLANE_START_MINUTES) / SWIMLANE_TOTAL_MINUTES) * 100;
}

export function ScheduleSwimlanes({
  events,
  nextUp,
  selectedEventId,
  todayDay,
  nowMinutes,
  onSelect
}: ScheduleSwimlanesProps) {
  const joiners = getOverlapJoiners(events);

  return (
    <div className="schedule-desktop">
      <div className="schedule-top">
        <div>
          <h2>This week</h2>
        </div>
        <div className="schedule-next">
          <span className="schedule-next__dot" />
          <span>Next up</span>
          <strong>{nextUp?.title ?? 'Nothing else today'}</strong>
        </div>
        <div className="schedule-legend">
          {MEMBERS.map((member) => (
            <span key={member.id} className="schedule-legend__item">
              <span className={`schedule-avatar schedule-avatar--${member.colorClass}`}>{member.initials}</span>
              {member.label}
            </span>
          ))}
        </div>
      </div>
      <div className="swim-ruler">
        {Array.from({ length: 17 }, (_, index) => (
          <span key={index} style={{ left: `${(index / 16) * 100}%` }}>
            {formatHour(6 + index)}
          </span>
        ))}
      </div>
      <div className="swim-days">
        {DAY_LABELS.map((day) => {
          const dayEvents = events.filter((event) => event.day === day);
          const dayJoiners = joiners.filter((joiner) => joiner.day === day);
          const showNowLine =
            todayDay === day && nowMinutes !== null && nowMinutes >= SWIMLANE_START_MINUTES && nowMinutes <= 22 * 60;
          return (
            <div className={`swim-day${todayDay === day ? ' swim-day--today' : ''}`} key={day}>
              <div className="swim-day__label">
                <strong>{day}</strong>
                {todayDay === day ? <span>today</span> : null}
              </div>
              <div className="swim-day__track">
                {Array.from({ length: 17 }, (_, index) => (
                  <span className="swim-day__gridline" key={index} style={{ left: `${(index / 16) * 100}%` }} />
                ))}
                {showNowLine ? (
                  <span className="swim-day__now" style={{ left: `${nowLeftPercent(nowMinutes)}%` }}>
                    now
                  </span>
                ) : null}
                {MEMBERS.map((member, index) => (
                  <div className="swim-lane" key={member.id} style={{ top: index * 24 + 8 }}>
                    <span className={`schedule-avatar schedule-avatar--small schedule-avatar--${member.colorClass}`}>
                      {member.initials}
                    </span>
                  </div>
                ))}
                {dayEvents.flatMap((event) =>
                  event.who.map((memberId) => {
                    const position = getEventPosition(event);
                    if (position.widthPercent <= 0) return null;
                    const member = MEMBERS.find((candidate) => candidate.id === memberId);
                    return (
                      <button
                        className={`swim-event swim-event--${member?.colorClass ?? 'member-a'}${
                          selectedEventId === event.id ? ' swim-event--selected' : ''
                        }`}
                        key={`${event.id}-${memberId}`}
                        type="button"
                        style={{
                          left: `${position.leftPercent}%`,
                          width: `${position.widthPercent}%`,
                          top: memberIndex(memberId) * 24 + 6
                        }}
                        title={event.title}
                        onClick={() => onSelect(event)}
                      >
                        <span>{event.title}</span>
                        {event.recurring ? <Repeat aria-hidden size={10} /> : null}
                      </button>
                    );
                  })
                )}
                {dayJoiners.map((joiner) => {
                  const left = ((joiner.startMinutes - SWIMLANE_START_MINUTES) / SWIMLANE_TOTAL_MINUTES) * 100;
                  const width = ((joiner.endMinutes - joiner.startMinutes) / SWIMLANE_TOTAL_MINUTES) * 100;
                  return (
                    <span
                      className="swim-joiner"
                      key={joiner.id}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: joiner.fromMemberIndex * 24 + 19,
                        height: (joiner.toMemberIndex - joiner.fromMemberIndex) * 24
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
