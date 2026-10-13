import { useState, useMemo } from 'react';
import { CalendarDays, Info } from 'lucide-react';

const CELL_SIZE = 14;
const CELL_GAP = 3;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function getIntensity(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount <= 0) return 1;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_COLORS = [
  'bg-zinc-800/60',            // 0: no activity
  'bg-emerald-900/80',         // 1
  'bg-emerald-700/80',         // 2
  'bg-emerald-500/80',         // 3
  'bg-emerald-400',            // 4
];

const INTENSITY_BORDERS = [
  'border-zinc-700/30',
  'border-emerald-800/40',
  'border-emerald-600/40',
  'border-emerald-400/40',
  'border-emerald-300/40',
];

export default function ActivityHeatmap({ dailyActivity }) {
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { weeks, maxCount, totalSolved, activeDays, monthLabels } = useMemo(() => {
    if (!dailyActivity?.length) {
      return { weeks: [], maxCount: 0, totalSolved: 0, activeDays: 0, monthLabels: [] };
    }

    // Build a map for quick lookup
    const dateMap = {};
    let maxCount = 0;
    let totalSolved = 0;
    let activeDays = 0;

    for (const entry of dailyActivity) {
      dateMap[entry.date] = entry.count;
      if (entry.count > maxCount) maxCount = entry.count;
      totalSolved += entry.count;
      if (entry.count > 0) activeDays++;
    }

    // Organize into weeks (columns)
    // Start from the earliest date in the data
    const dates = dailyActivity.map(d => new Date(d.date + 'T00:00:00'));
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);

    // Adjust to start on Sunday
    const dayOfWeek = startDate.getDay();
    const adjustedStart = new Date(startDate);
    adjustedStart.setDate(adjustedStart.getDate() - dayOfWeek);

    const weeks = [];
    const monthLabelPositions = [];
    let currentDate = new Date(adjustedStart);
    let lastMonth = -1;

    while (currentDate <= endDate) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const count = dateMap[dateStr];
        const isInRange = count !== undefined;

        // Track month label positions
        if (currentDate.getMonth() !== lastMonth && currentDate.getDate() <= 7) {
          monthLabelPositions.push({
            weekIndex: weeks.length,
            month: currentDate.getMonth(),
          });
          lastMonth = currentDate.getMonth();
        }

        week.push({
          date: dateStr,
          count: isInRange ? count : -1, // -1 means out of range
          dayOfWeek: d,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return { weeks, maxCount, totalSolved, activeDays, monthLabels: monthLabelPositions };
  }, [dailyActivity]);

  const handleMouseEnter = (e, day) => {
    if (day.count < 0) return;
    const rect = e.target.getBoundingClientRect();
    const parentRect = e.target.closest('.heatmap-container').getBoundingClientRect();
    setTooltipData(day);
    setTooltipPos({
      x: rect.left - parentRect.left + CELL_SIZE / 2,
      y: rect.top - parentRect.top - 8,
    });
  };

  if (!dailyActivity?.length) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-lg font-bold mb-4 text-zinc-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-400" />
          Activity Calendar
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4">
            <CalendarDays className="w-8 h-8 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            No activity data available yet. Sync your profiles to start tracking your daily solving streak.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-400" />
            Activity Calendar
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {totalSolved} problems solved in {activeDays} active days (last {dailyActivity.length} days)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Less</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm ${color} border ${INTENSITY_BORDERS[i]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="heatmap-container relative overflow-x-auto pb-2">
        {/* Month labels */}
        <div className="flex mb-1" style={{ paddingLeft: '32px' }}>
          {monthLabels.map((ml, i) => (
            <span
              key={i}
              className="text-[10px] text-zinc-500 absolute"
              style={{ left: `${32 + ml.weekIndex * (CELL_SIZE + CELL_GAP)}px` }}
            >
              {MONTH_LABELS[ml.month]}
            </span>
          ))}
        </div>

        <div className="flex mt-4" style={{ gap: `${CELL_GAP}px` }}>
          {/* Day of week labels */}
          <div className="flex flex-col flex-shrink-0" style={{ gap: `${CELL_GAP}px`, width: '28px' }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-[10px] text-zinc-600 flex items-center justify-end pr-1"
                style={{ height: `${CELL_SIZE}px` }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cells */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: `${CELL_GAP}px` }}>
              {week.map((day, di) => {
                if (day.count < 0) {
                  return (
                    <div
                      key={di}
                      style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    />
                  );
                }

                const intensity = getIntensity(day.count, maxCount);
                return (
                  <div
                    key={di}
                    className={`
                      rounded-sm cursor-pointer transition-all duration-150
                      ${INTENSITY_COLORS[intensity]} border ${INTENSITY_BORDERS[intensity]}
                      hover:ring-1 hover:ring-emerald-400/30 hover:scale-125
                    `}
                    style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    onMouseEnter={(e) => handleMouseEnter(e, day)}
                    onMouseLeave={() => setTooltipData(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltipData && (
          <div
            className="absolute z-50 pointer-events-none bg-zinc-800/95 backdrop-blur-sm border border-zinc-600/50 rounded-lg px-3 py-2 shadow-xl -translate-x-1/2 -translate-y-full"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <p className="text-xs font-semibold text-zinc-100">
              {tooltipData.count === 0
                ? 'No problems solved'
                : `${tooltipData.count} problem${tooltipData.count !== 1 ? 's' : ''} solved`}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {new Date(tooltipData.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
