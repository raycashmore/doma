import { MapPin, Repeat } from 'lucide-react';
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

function formatEventTime(event: ScheduleEvent): string {
  if (event.allDay) return 'All day';
  return `${formatTime(event.startMinutes)} - ${formatTime(event.endMinutes)}`;
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
            className={
              candidate === day ? 'schedule-mobile__day schedule-mobile__day--selected' : 'schedule-mobile__day'
            }
            onClick={() => setDay(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>
      <div className="schedule-mobile__agenda">
        {dayEvents.length > 0 ? (
          dayEvents.map((event) => {
            const member = members.find((candidate) => candidate.id === event.who[0]);
            return (
              <button
                className={`mobile-event mobile-event--${member?.colorClass ?? 'member-a'}${
                  selectedEventId === event.id ? ' mobile-event--selected' : ''
                }`}
                key={`${event.id}-${event.day}`}
                type="button"
                onClick={() => onSelect(event)}
              >
                <span className="mobile-event__time">{formatEventTime(event)}</span>
                <span className="mobile-event__body">
                  <strong>{event.title}</strong>
                  <small>
                    {event.recurring ? <Repeat aria-hidden size={11} /> : null}
                    {event.location ? (
                      <>
                        <MapPin aria-hidden size={11} />
                        {event.location}
                      </>
                    ) : null}
                  </small>
                </span>
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
