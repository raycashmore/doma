import { Repeat } from 'lucide-react';

import { DAY_LABELS, type ScheduleMember, SWIMLANE_START_MINUTES, SWIMLANE_TOTAL_MINUTES } from './scheduleData';
import { getEventPosition, type ScheduleEvent } from './scheduleLayout';

const LANE_COUNT = 4;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

type ScheduleSwimlanesProps = {
  events: ScheduleEvent[];
  members: ScheduleMember[];
  nextUp: ScheduleEvent | null;
  selectedEventId?: string;
  todayDay?: string;
  nowMinutes: number | null;
  weekStartMs: number;
  onSelect: (event: ScheduleEvent) => void;
};

function formatHour(hour: number): string {
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function formatDayDate(weekStartMs: number, dayIndex: number): string {
  const date = new Date(weekStartMs);
  date.setDate(date.getDate() + dayIndex);
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

function memberIndex(members: ScheduleMember[], memberId: string): number {
  return Math.max(
    0,
    members.findIndex((member) => member.id === memberId)
  );
}

function laneCenterTopPercent(index: number): number {
  return ((index + 0.5) / LANE_COUNT) * 100;
}

function nowLeftPercent(nowMinutes: number): number {
  return ((nowMinutes - SWIMLANE_START_MINUTES) / SWIMLANE_TOTAL_MINUTES) * 100;
}

export function ScheduleSwimlanes({
  events,
  members,
  nextUp,
  selectedEventId,
  todayDay,
  nowMinutes,
  weekStartMs,
  onSelect
}: ScheduleSwimlanesProps) {
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
          {members.map((member) => (
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
        {DAY_LABELS.map((day, dayIndex) => {
          const dayEvents = events.filter((event) => event.day === day);
          const showNowLine =
            todayDay === day && nowMinutes !== null && nowMinutes >= SWIMLANE_START_MINUTES && nowMinutes <= 22 * 60;
          return (
            <div className={`swim-day${todayDay === day ? ' swim-day--today' : ''}`} key={day}>
              <div className="swim-day__label">
                <strong>{day}</strong>
                <span>{formatDayDate(weekStartMs, dayIndex)}</span>
                {todayDay === day ? <small>today</small> : null}
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
                {members.map((member, index) => (
                  <div className="swim-lane" key={member.id} style={{ top: `${(index / LANE_COUNT) * 100}%` }}>
                    <span className={`schedule-avatar schedule-avatar--small schedule-avatar--${member.colorClass}`}>
                      {member.initials}
                    </span>
                  </div>
                ))}
                {dayEvents.flatMap((event) =>
                  event.who.map((memberId) => {
                    const position = getEventPosition(event);
                    if (position.widthPercent <= 0) return null;
                    const member = members.find((candidate) => candidate.id === memberId);
                    const laneIndex = memberIndex(members, memberId);
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
                          top: `${laneCenterTopPercent(laneIndex)}%`
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
