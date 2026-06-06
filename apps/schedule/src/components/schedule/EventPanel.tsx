import { CalendarDays, ExternalLink, Lock, MapPin, Repeat, Users, X } from 'lucide-react';

import type { ScheduleMember } from './scheduleData';
import type { ScheduleEvent } from './scheduleLayout';

type EventPanelProps = {
  event: ScheduleEvent | null;
  members: ScheduleMember[];
  open: boolean;
  onClose: () => void;
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

function formatMembers(event: ScheduleEvent, members: ScheduleMember[]): string {
  return event.who.map((id) => members.find((member) => member.id === id)?.label ?? id).join(', ');
}

export function EventPanel({ event, members, open, onClose }: EventPanelProps) {
  return (
    <div className={`event-panel-host${open ? ' event-panel-host--open' : ''}`}>
      <button className="event-panel-scrim" type="button" aria-label="Close event detail" onClick={onClose} />
      <aside className="event-panel" role="dialog" aria-modal="true" aria-label={event?.title ?? 'Event'}>
        <div className="event-panel__grip" />
        <header className="event-panel__bar">
          <span>Event</span>
          <button className="event-panel__close" type="button" onClick={onClose} aria-label="Close">
            <X aria-hidden size={18} />
          </button>
        </header>
        {event ? (
          <>
            <div className="event-panel__body">
              <div className="event-panel__hero">
                <span className="event-panel__chip">{formatEventTime(event)}</span>
                <h2>{event.title}</h2>
                <p>{event.day}</p>
              </div>
              <a className="event-panel__sync" href={event.htmlLink} target="_blank" rel="noreferrer">
                <CalendarDays aria-hidden size={24} />
                <span>
                  <strong>Google Calendar</strong>
                  <small>
                    <Lock aria-hidden size={11} /> Read-only sync
                  </small>
                </span>
                <ExternalLink aria-hidden size={16} />
              </a>
              <div className="event-panel__rows">
                <div className="event-panel__row">
                  <Users aria-hidden size={16} />
                  <span>
                    <strong>Who is going</strong>
                    {formatMembers(event, members)}
                  </span>
                </div>
                {event.location ? (
                  <div className="event-panel__row">
                    <MapPin aria-hidden size={16} />
                    <span>
                      <strong>Where</strong>
                      {event.location}
                    </span>
                  </div>
                ) : null}
                {event.recurring ? (
                  <div className="event-panel__row">
                    <Repeat aria-hidden size={16} />
                    <span>
                      <strong>Repeats</strong>
                      Synced recurring event
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
