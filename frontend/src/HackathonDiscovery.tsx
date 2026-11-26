import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, CalendarDays, ExternalLink, MapPin, Plus, Sparkles } from 'lucide-react';

export type FeaturedHackathon = {
  id: string;
  name: string;
  organizer: string;
  platform: string;
  startDate: string;
  endDate: string;
  type: 'Online' | 'In-person' | 'Hybrid';
  formatLabel: string;
  location: string;
  prize: string;
  tags: string[];
  description: string;
  eligibility: string;
  registrationNote: string;
  url: string;
  sourceUrl: string;
};

const FEATURED_HACKATHONS: FeaturedHackathon[] = [
  {
    id: 'agntid-agent-security-challenge-2026',
    name: 'AgntID Agent Security Challenge',
    organizer: 'AgntID',
    platform: 'Luma',
    startDate: '2026-11-28',
    endDate: '2026-11-28',
    type: 'Online',
    formatLabel: '4-hour online challenge',
    location: 'Online',
    prize: '₹75,000 total',
    tags: ['AI Agents', 'Agent Security', 'LangChain'],
    description: 'Build or bring an AI agent, connect it to real tools, and test how intent-aware security controls handle its actions.',
    eligibility: 'Open to everyone; individual participation.',
    registrationNote: 'Free registration. Check the organiser page for current availability.',
    url: 'https://lu.ma/voramom4',
    sourceUrl: 'https://indiahackathons.com/events/agntid-agent-security-challenge',
  },
  {
    id: 'kaya-ai-grand-challenge-2026',
    name: 'The Dawn of Superintelligence',
    organizer: 'Kaya AI',
    platform: 'Devpost',
    startDate: '2026-11-30',
    endDate: '2026-12-06',
    type: 'Hybrid',
    formatLabel: 'Online build · Mumbai finale',
    location: 'Online + Mumbai finale',
    prize: '$3,000 total',
    tags: ['AI Agents', 'Construction Tech', 'Supply Chain'],
    description: 'Build an agent for real construction workflows across general intelligence, contextual intelligence, or specialist vertical agents.',
    eligibility: 'Students and professionals in India; teams of 2–4. No solo submissions.',
    registrationNote: 'Round 1 submissions run Nov 30–Dec 6. Review the full rules before joining.',
    url: 'https://kaya-ai-grand-challenge.devpost.com/',
    sourceUrl: 'https://indiahackathons.com/events/the-dawn-of-superintelligence-kaya-ai-grand-challenge',
  },
  {
    id: 'build-with-web-data-2026',
    name: 'Build With Web Data Hackathon',
    organizer: 'TechEve · Scrapingdog',
    platform: 'Luma',
    startDate: '2026-11-30',
    endDate: '2026-12-01',
    type: 'In-person',
    formatLabel: '24-hour offline hackathon',
    location: 'JECRC University, Jaipur',
    prize: '₹1,00,000 + internships',
    tags: ['Web Data', 'AI Agents', 'Search'],
    description: 'Build with live web data and Scrapingdog APIs across AI agents, e-commerce intelligence, search insights, and open innovation.',
    eligibility: 'Teams of 3; organiser selection applies. The listing names JECRC University students.',
    registrationNote: 'Free entry; limited team capacity. Confirm eligibility and seats with the organiser.',
    url: 'https://luma.com/krhgootf',
    sourceUrl: 'https://techsnap.in/hackathons/build-with-web-data-hackathon-6b1d2936',
  },
  {
    id: 'hack-days-pune-2-2026',
    name: 'Hack Days Pune — 2nd Edition',
    organizer: 'Pratik Mahalle · Himanshu Sangshetti',
    platform: 'Luma',
    startDate: '2026-12-13',
    endDate: '2026-12-13',
    type: 'In-person',
    formatLabel: 'Full-day builder event',
    location: 'Pune, Maharashtra',
    prize: 'Prize details TBA',
    tags: ['AI Agents', 'Cloud', 'DevOps', 'Platform Engineering'],
    description: 'A builder-focused day with technical talks, hands-on challenges, mentorship, live demos, and engineering community networking.',
    eligibility: 'Registration requires host approval.',
    registrationNote: 'Free registration; venue details are shared after approval.',
    url: 'https://luma.com/x2m5ed4z',
    sourceUrl: 'https://indiahackathons.com/events/hack-days-pune-2nd-edition',
  },
  {
    id: 'hackerrank-orchestrate-december-2026',
    name: 'HackerRank Orchestrate: December Edition',
    organizer: 'HackerRank',
    platform: 'Luma',
    startDate: '2026-12-12',
    endDate: '2026-12-13',
    type: 'Hybrid',
    formatLabel: 'Online challenge · optional office meetup',
    location: 'Bengaluru meetup; online challenge',
    prize: 'Not listed',
    tags: ['AI Agents', 'Engineering', 'Developer Tools'],
    description: 'Build AI agents for an open-ended engineering problem, with a limited in-person gathering at the HackerRank office in Bengaluru.',
    eligibility: 'Open to developers; in-person seats are limited to Bengaluru attendees.',
    registrationNote: 'Registration requires host approval. Check the event page for the latest instructions.',
    url: 'https://luma.com/et79hqx3',
    sourceUrl: 'https://indiahackathons.com/events/hackerrank-orchestrate-december-edition',
  },
];

function atLocalMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const startDay = start.toLocaleDateString('en-IN', { day: 'numeric' });
  const startMonth = start.toLocaleDateString('en-IN', { month: 'short' });
  const endDay = end.toLocaleDateString('en-IN', { day: 'numeric' });
  const endMonth = end.toLocaleDateString('en-IN', { month: 'short' });
  if (startDate === endDate) return startDay + ' ' + startMonth;
  if (startMonth === endMonth) return startDay + '–' + endDay + ' ' + endMonth;
  return startDay + ' ' + startMonth + ' – ' + endDay + ' ' + endMonth;
}

function startsInLabel(startDate: string) {
  const start = new Date(startDate + 'T00:00:00');
  const days = Math.ceil((atLocalMidnight(start) - atLocalMidnight(new Date())) / 86400000);
  if (days <= 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return 'Starts in ' + days + ' days';
}

export default function HackathonDiscovery({
  trackedEvents,
  onAdd,
}: {
  trackedEvents: { name: string; submissionUrl?: string }[];
  onAdd: (event: FeaturedHackathon) => void;
}) {
  const [filter, setFilter] = useState<'All' | 'Online' | 'In-person' | 'Hybrid'>('All');
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const upcoming = useMemo(() => {
    const now = new Date();
    return FEATURED_HACKATHONS
      .filter((event) => new Date(event.endDate + 'T23:59:59').getTime() >= now.getTime())
      .filter((event) => filter === 'All' || event.type === filter);
  }, [filter]);

  const isTracked = (event: FeaturedHackathon) => trackedEvents.some((tracked) =>
    tracked.name.trim().toLowerCase() === event.name.trim().toLowerCase()
    || tracked.submissionUrl === event.url,
  );

  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.featured-hackathon-card');
    const distance = card ? card.offsetWidth + 14 : 330;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  const updateActiveIndex = () => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>('.featured-hackathon-card');
    if (!track || !card) return;
    setActiveIndex(Math.round(track.scrollLeft / (card.offsetWidth + 14)));
  };

  return (
    <section className="featured-discovery" aria-labelledby="featured-discovery-title">
      <div className="featured-discovery-heading">
        <div>
          <div className="featured-eyebrow"><Sparkles size={13} /> DISCOVER WHAT'S NEXT</div>
          <h2 id="featured-discovery-title">Upcoming hackathons</h2>
          <p>Curated picks across India, ordered by start date.</p>
        </div>
        <div className="featured-carousel-controls">
          <span className="featured-count">{String(Math.min(activeIndex + 1, Math.max(upcoming.length, 1))).padStart(2, '0')} / {String(upcoming.length).padStart(2, '0')}</span>
          <button type="button" aria-label="Previous hackathons" onClick={() => scroll(-1)} disabled={activeIndex <= 0}><ArrowLeft size={16} /></button>
          <button type="button" aria-label="Next hackathons" onClick={() => scroll(1)} disabled={activeIndex >= upcoming.length - 1}><ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="featured-filters" role="group" aria-label="Filter upcoming hackathons">
        {(['All', 'Online', 'In-person', 'Hybrid'] as const).map((value) => (
          <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setActiveIndex(0); if (trackRef.current) trackRef.current.scrollTo({ left: 0 }); }}>
            {value}
          </button>
        ))}
      </div>

      {upcoming.length ? (
        <div className="featured-carousel-track" ref={trackRef} onScroll={updateActiveIndex}>
          {upcoming.map((event) => {
            const tracked = isTracked(event);
            return (
              <article className="featured-hackathon-card" key={event.id}>
                <div className="featured-card-topline">
                  <span className={'featured-format ' + event.type.toLowerCase().replace('-', '')}>{event.formatLabel}</span>
                  <span className="featured-countdown">{startsInLabel(event.startDate)}</span>
                </div>
                <div className="featured-date"><CalendarDays size={14} /> {formatDateRange(event.startDate, event.endDate)}</div>
                <h3>{event.name}</h3>
                <div className="featured-organizer">{event.organizer} <span>·</span> {event.platform}</div>
                <p className="featured-description">{event.description}</p>
                <div className="featured-details">
                  <span><MapPin size={13} /> {event.location}</span>
                  <span><Award size={13} /> {event.prize}</span>
                </div>
                <div className="featured-tags">{event.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <p className="featured-eligibility">{event.eligibility}</p>
                <div className="featured-card-actions">
                  <a href={event.url} target="_blank" rel="noreferrer">View / register <ExternalLink size={13} /></a>
                  <button type="button" onClick={() => onAdd(event)} disabled={tracked}>
                    {tracked ? 'In tracker' : <><Plus size={14} /> Add to tracker</>}
                  </button>
                </div>
                <p className="featured-registration-note">{event.registrationNote}</p>
                <a className="featured-source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">Source listing</a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="featured-empty">
          <CalendarDays size={22} />
          <strong>No upcoming picks in this filter</strong>
          <span>Check back for newly curated events.</span>
        </div>
      )}

      <div className="featured-discovery-footnote">
        Event details are curated snapshots, not a live availability feed. Confirm dates, eligibility, and registration status with the organiser before applying.
      </div>
    </section>
  );
}
