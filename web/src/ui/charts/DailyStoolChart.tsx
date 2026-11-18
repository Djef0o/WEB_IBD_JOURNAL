import './charts.css';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { dateParts, type LocalDate } from '../../domain/time';
import { lang, t, tp } from '../../i18n';
import { formatLocalDate } from '../format';
import {
  STOOL_CATEGORIES, labelStep, maxTotal, type DayBar,
} from './dailyStool';

/*
 * Stools per day: stacked bars by Bristol category (bottom to top: hard, normal, loose), dot
 * above the bar if blood was reported. Inline SVG, no library; the colours come from CSS classes
 * (charts.css). Two layouts:
 *  - `scroll` (Trends): fixed-size days in a keyboard-scrollable region that opens on today, one
 *    scale for the whole history; clicking a bar shows the day's detail.
 *  - `fit` (report): every bar squeezed into the available width, one SVG.
 * The data table below the chart is the accessible alternative to the drawing.
 */

const SLOT = 26;
const BAR = 20;
const AXIS_W = 28;
const TOP = 14;
const PLOT_H = 132;
const BASELINE = TOP + PLOT_H;
const DOT_Y = 5;
const DOT_R = 3.5;
const FIT_W = 720;
const MIN_LABEL_SPACING = 14;

/** Calendar date as a local-midnight `Date`, only for `Intl` formatting. */
function jsDate(date: LocalDate): Date {
  const { year, month, day } = dateParts(date);
  return new Date(year, month - 1, day);
}

interface Props {
  bars: readonly DayBar[];
  layout: 'scroll' | 'fit';
  /** Heading above the chart (level set by the caller through `headingLevel`). */
  title: string;
  subtitle?: string;
  headingLevel?: 2 | 3;
  /** Data table alternative (hidden on paper: the report prints the drawing only). */
  table?: boolean;
}

export function DailyStoolChart({ bars, layout, title, subtitle, headingLevel = 2, table = true }: Props) {
  const ids = useId();
  const titleId = `${ids}-t`;
  const descId = `${ids}-d`;
  const fit = layout === 'fit';
  const max = maxTotal(bars);
  const slot = fit ? (FIT_W - AXIS_W) / bars.length : SLOT;
  const barWidth = fit ? Math.min(slot * 0.7, 14) : BAR;
  const [selected, setSelected] = useState<LocalDate | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState('');
  const language = lang.value;

  const labels = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(language, { weekday: 'narrow' });
    const month = new Intl.DateTimeFormat(language, { month: 'short' });
    return bars.map((bar) => {
      const js = jsDate(bar.date);
      return { weekday: weekday.format(js), month: month.format(js), day: js.getDate() };
    });
  }, [bars, language]);

  const step = fit ? labelStep(slot, MIN_LABEL_SPACING) : 1;
  const totalStools = bars.reduce((sum, b) => sum + b.total, 0);
  const bloodDays = bars.filter((b) => b.blood).length;
  const first = bars[0]!.date;
  const last = bars[bars.length - 1]!.date;
  const description = t('web_chart_desc', [formatLocalDate(first), formatLocalDate(last), totalStools, max, bloodDays]);

  // The chart opens on today (the right end) and the header shows the months of the visible bars.
  const updateVisible = () => {
    const el = scroller.current;
    if (!el) return;
    const from = Math.max(0, Math.floor(el.scrollLeft / SLOT));
    const to = Math.min(bars.length - 1, Math.ceil((el.scrollLeft + el.clientWidth - AXIS_W) / SLOT));
    const fmt = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' });
    const text = fmt.formatRange(jsDate(bars[from]!.date), jsDate(bars[Math.max(from, to)]!.date));
    setVisible((prev) => (prev === text ? prev : text));
  };
  useEffect(() => {
    if (fit) return;
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
    updateVisible();
  }, [fit, bars, language]);

  const onPick = (event: MouseEvent) => {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const index = Math.floor((event.clientX - rect.left) / SLOT);
    const bar = bars[index];
    if (!bar) return;
    setSelected((prev) => (prev === bar.date ? null : bar.date));
  };

  const H = `h${headingLevel}` as 'h2' | 'h3';
  const selectedBar = selected === null ? null : bars.find((b) => b.date === selected) ?? null;
  const plotWidth = fit ? FIT_W - AXIS_W : bars.length * SLOT;

  const axis = (
    <>
      <text class="dsc-axis" x={AXIS_W - 4} y={TOP + 4} text-anchor="end">{max}</text>
      <text class="dsc-axis" x={AXIS_W - 4} y={BASELINE + 4} text-anchor="end">0</text>
    </>
  );

  const plot = (offset: number) => (
    <>
      <line class="dsc-rule" x1={offset} x2={offset + plotWidth} y1={TOP} y2={TOP} />
      <line class="dsc-rule" x1={offset} x2={offset + plotWidth} y1={BASELINE} y2={BASELINE} />
      {bars.map((bar, index) => {
        const center = offset + slot * (index + 0.5);
        const label = labels[index]!;
        let bottom = BASELINE;
        const showDay = (bars.length - 1 - index) % step === 0;
        const segments = STOOL_CATEGORIES.map((category, c) => {
          const count = bar.counts[c]!;
          if (count === 0) return null;
          const height = (PLOT_H * count) / max;
          bottom -= height;
          return (
            <rect
              key={category.id}
              class={`dsc-bar dsc-${category.id.toLowerCase()}`}
              x={center - barWidth / 2}
              y={bottom}
              width={barWidth}
              height={height}
            />
          );
        });
        return (
          <g key={bar.date} class="dsc-day" data-dim={selected !== null && selected !== bar.date ? '' : undefined} data-selected={selected === bar.date ? '' : undefined}>
            <title>{dayTitle(bar, formatLocalDate(bar.date))}</title>
            {/* Hit area: the whole column, including empty days. */}
            <rect class="dsc-hit" x={center - slot / 2} y={0} width={slot} height={BASELINE + 40} />
            {segments}
            {bar.blood && <circle class="dsc-blood" cx={center} cy={DOT_Y} r={fit ? Math.min(slot * 0.35, 2.5) : DOT_R} />}
            {!fit && <text class="dsc-label" x={center} y={BASELINE + 14} text-anchor="middle">{label.weekday}</text>}
            {showDay && <text class="dsc-label" x={center} y={BASELINE + (fit ? 12 : 27)} text-anchor="middle">{label.day}</text>}
            {(index === 0 || label.day === 1) && (
              <text class="dsc-month" x={center} y={BASELINE + (fit ? 23 : 40)} text-anchor={index === 0 ? 'start' : 'middle'}>{label.month}</text>
            )}
          </g>
        );
      })}
    </>
  );

  const height = BASELINE + (fit ? 28 : 46);

  return (
    <figure class="dsc" data-layout={layout}>
      <figcaption class="dsc-caption">
        <H class="card-title">{title}</H>
        {subtitle && <p class="text-muted text-sm">{subtitle}</p>}
        {!fit && <p class="dsc-months" aria-hidden="true">{visible}</p>}
      </figcaption>
      {fit ? (
        <div class="dsc-fit" role="region" tabIndex={0} aria-label={title}>
          <svg class="dsc-svg" viewBox={`0 0 ${FIT_W} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descId}>
            <title id={titleId}>{title}</title>
            <desc id={descId}>{description}</desc>
            {axis}
            {plot(AXIS_W)}
          </svg>
        </div>
      ) : (
        <div
          class="dsc-scroller"
          ref={scroller}
          role="region"
          tabIndex={0}
          aria-label={title}
          onScroll={updateVisible}
        >
          <svg class="dsc-axis-svg" width={AXIS_W} height={height} aria-hidden="true">{axis}</svg>
          <svg
            class="dsc-svg"
            width={plotWidth}
            height={height}
            role="img"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onClick={onPick}
          >
            <title id={titleId}>{title}</title>
            <desc id={descId}>{description}</desc>
            {plot(0)}
          </svg>
        </div>
      )}
      {!fit && (
        <div class="dsc-detail" aria-live="polite">
          {selectedBar ? <DayDetail bar={selectedBar} /> : <p class="text-muted text-sm">{t('analysis_daily_hint')}</p>}
        </div>
      )}
      <ul class="dsc-legend" role="list">
        {STOOL_CATEGORIES.map((c) => (
          <li key={c.id}><span class={`dsc-swatch dsc-${c.id.toLowerCase()}`} aria-hidden="true" />{t(c.legendKey)}</li>
        ))}
        <li><span class="dsc-swatch dsc-dot dsc-blood" aria-hidden="true" />{t('analysis_legend_blood')}</li>
      </ul>
      {table && <DataTable bars={bars} caption={title} />}
    </figure>
  );
}

function summaryParts(bar: DayBar): string[] {
  const parts = [bar.types.length === 0 ? t('history_no_entry') : tp('stools_count', bar.types.length)];
  if (bar.types.length > 0) parts.push(t('analysis_detail_types', [bar.types.join(', ')]));
  if (bar.falseUrges > 0) parts.push(tp('false_urge_count', bar.falseUrges));
  if (bar.blood) parts.push(t('stool_flag_blood'));
  return parts;
}

const dayTitle = (bar: DayBar, date: string): string => `${date} · ${summaryParts(bar).join(' · ')}`;

function DayDetail({ bar }: { bar: DayBar }) {
  return (
    <>
      <p class="dsc-detail-date">{formatLocalDate(bar.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <p class="text-muted">{summaryParts(bar).join(' · ')}</p>
    </>
  );
}

/** Same data as the drawing, most recent day first; rows are only built while the table is open. */
function DataTable({ bars, caption }: { bars: readonly DayBar[]; caption: string }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => (open ? [...bars].reverse() : []), [open, bars]);
  const labelId = useId();
  return (
    <details class="dsc-table-details" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t('web_chart_show_table')}</summary>
      {open && (
        <div class="dsc-table-wrap" role="region" tabIndex={0} aria-labelledby={labelId}>
          <table class="dsc-table">
            <caption id={labelId}>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t('report_col_date')}</th>
                <th scope="col">{t('analysis_stools')}</th>
                <th scope="col">{t('web_chart_col_types')}</th>
                <th scope="col">{t('analysis_legend_blood')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bar) => (
                <tr key={bar.date}>
                  <th scope="row">{formatLocalDate(bar.date)}</th>
                  <td>{bar.total}</td>
                  <td>{bar.types.length === 0 ? '–' : bar.types.join(', ')}</td>
                  <td>{bar.blood ? t('stool_flag_blood') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
