import { MapPin } from 'lucide-react';
import { useState } from 'react';

import { DAY_LABELS, type DayLabel, type ScheduleMember } from './scheduleData';
import type { ScheduleEvent } from './scheduleLayout';

type MobileScheduleProps = {
  events: ScheduleEvent[];
  members: ScheduleMember[];
  nextUp: ScheduleEvent | null;
  selectedEventId?: string;
  todayDay?: DayLabel;
  onSelect: (event: ScheduleEvent) => void;
};

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')}${suffix}`;
}

export function MobileSchedule({
  events,
  members,
  nextUp,
  selectedEventId,
  todayDay = 'Mon',
  onSelect
}: MobileScheduleProps) {
  const [day, setDay] = useState<DayLabel>(todayDay);
  const dayEvents = events.filter((event) => event.day === day).sort((a, b) => a.startMinutes - b.startMinutes);

  return (
    <div className="schedule-mobile">
      <div className="schedule-mobile__head">
        <h2>This week</h2>
        <span>{nextUp ? `Next up: ${nextUp.title}` : 'No upcoming events'}</span>
      </div>
      <div className="schedule-mobile__days" role="tablist" aria-label="Schedule days">
        {DAY_LABELS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={candidate === day}
            className={`schedule-mobile__day${candidate === day ? ' schedule-mobile__day--selected' : ''}${
              candidate === todayDay ? ' schedule-mobile__day--today' : ''
            }`}
            onClick={() => setDay(candidate)}
          >
            <span className="schedule-mobile__day-short" aria-hidden>
              {candidate.charAt(0)}
            </span>
            <span className="schedule-mobile__day-full">{candidate}</span>
          </button>
        ))}
      </div>
      <div className="schedule-mobile__agenda">
        {dayEvents.length > 0 ? (
          dayEvents.map((event) => {
            const eventMembers = event.who
              .map((id) => members.find((candidate) => candidate.id === id))
              .filter((member): member is ScheduleMember => member !== undefined);
            const primary = eventMembers[0];
            return (
              <button
                className={`mobile-event mobile-event--${primary?.colorClass ?? 'member-a'}${
                  event.kind === 'dailyRequirements' ? ' mobile-event--daily-requirements' : ''
                }${selectedEventId === event.id ? ' mobile-event--selected' : ''}`}
                key={`${event.id}-${event.day}`}
                type="button"
                onClick={() => onSelect(event)}
              >
                <span className="mobile-event__time">
                  {event.allDay ? (
                    <strong>All day</strong>
                  ) : (
                    <>
                      <strong>{formatTime(event.startMinutes)}</strong>
                      <small>{formatTime(event.endMinutes)}</small>
                    </>
                  )}
                </span>
                <span className="mobile-event__body">
                  <strong className="mobile-event__title">{event.title}</strong>
                  {event.location ? (
                    <span className="mobile-event__meta">
                      <span className="mobile-event__tag">
                        <MapPin aria-hidden size={12} />
                        {event.location}
                      </span>
                    </span>
                  ) : null}
                </span>
                {eventMembers.length > 0 ? (
                  <span className="mobile-event__who" aria-hidden>
                    {eventMembers.slice(0, 3).map((member) => (
                      <span
                        key={member.id}
                        className={`schedule-avatar schedule-avatar--small schedule-avatar--${member.colorClass}`}
                      >
                        {member.initials}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <p className="schedule-mobile__empty">No events for {day}.</p>
        )}
      </div>
    </div>
  );
}
