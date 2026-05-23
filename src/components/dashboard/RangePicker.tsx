import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, subDays, subHours, startOfToday, endOfToday } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown, Clock, Zap, X } from 'lucide-react';
import { cn } from '../../lib/utils';


interface RangePickerProps {
  range: { start: string; end: string };
  onChange: (range: { start: string; end: string }) => void;
}

export function RangePicker({ range, onChange }: RangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number, bottom: number, left: number, width: number, height: number, windowHeight: number, windowWidth: number } | null>(null);
  
  // Internal state for pending changes
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen && 
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync internal state when menu opens
  useLayoutEffect(() => {
    if (isOpen) {
      if (range.start && range.end) {
        setTempRange({ from: new Date(range.start), to: new Date(range.end) });
        setStartTime(format(new Date(range.start), 'HH:mm'));
        setEndTime(format(new Date(range.end), 'HH:mm'));
      }
      
      // Calculate position for portal
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          windowHeight: window.innerHeight,
          windowWidth: window.innerWidth
        });
      }
    } else {
      setCoords(null);
    }
  }, [isOpen, range.start, range.end]);

  const handleSelect = (newRange: DateRange | undefined) => {
    setTempRange(newRange);
  };

  const applyRange = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (tempRange?.from) {
      const start = new Date(tempRange.from);
      const [sh, sm] = startTime.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);

      let end = tempRange.to ? new Date(tempRange.to) : new Date(tempRange.from);
      const [eh, em] = endTime.split(':').map(Number);
      end.setHours(eh, em, 0, 0);

      if (end < start) {
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      }

      onChange({
        start: format(start, "yyyy-MM-dd'T'HH:mm"),
        end: format(end, "yyyy-MM-dd'T'HH:mm")
      });
      setIsOpen(false);
    }
  };

  const setPreset = (preset: 'today' | '24h' | '7d' | '30d') => {
    let from = new Date();
    let to = new Date();

    switch(preset) {
        case 'today':
            from = startOfToday();
            to = endOfToday();
            break;
        case '24h':
            from = subHours(new Date(), 24);
            to = new Date();
            break;
        case '7d':
            from = subDays(new Date(), 7);
            to = new Date();
            break;
        case '30d':
            from = subDays(new Date(), 30);
            to = new Date();
            break;
    }

    setTempRange({ from, to });
    setStartTime(format(from, 'HH:mm'));
    setEndTime(format(to, 'HH:mm'));
  };

  const displayText = range.start && range.end 
    ? `${format(new Date(range.start), 'MMM d, HH:mm')} - ${format(new Date(range.end), 'MMM d, HH:mm')}`
    : "Select Period";

  return (
    <div className="relative shrink-0 h-full min-w-max" ref={containerRef}>
       <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-transparent hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 rounded-none py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full"
       >
         <span className="flex items-center gap-2 whitespace-nowrap">
           <span className="text-slate-500 font-normal hidden xl:inline">Analysis Period:</span>
           <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
           <span className="font-semibold text-slate-800 dark:text-slate-200">{displayText}</span>
         </span>
         <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300", isOpen && "-rotate-180")} />
       </button>

       {isOpen && coords && createPortal(
           <div 
              ref={popoverRef}
              style={{ 
                ...(coords.bottom + 400 > coords.windowHeight && coords.top - 400 > 0
                  ? { top: coords.top - 400 } // approximate rendering above
                  : { top: coords.bottom + 8 }),
                left: Math.max(16, Math.min(coords.left + coords.width - 340, window.innerWidth - 356)), // Prevent overflow on both sides
                maxHeight: 'calc(100vh - 32px)',
              }}
              className={cn(
                "fixed z-[1001] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none shadow-xl p-4 w-[calc(100vw-32px)] sm:w-[340px] max-w-[340px] flex flex-col gap-4 pointer-events-auto overflow-y-auto animate-in fade-in zoom-in-95 duration-100",
                coords.bottom + 400 > coords.windowHeight && coords.top - 400 > 0 ? "origin-bottom-left" : "origin-top-left"
              )}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> Select Range
                </span>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-800 rounded-none transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="flex gap-2">
                {['today', '24h', '7d', '30d'].map(p => (
                    <button 
                        key={p}
                        onClick={() => setPreset(p as any)}
                        className="flex-1 py-1.5 rounded-none text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:text-blue-700 dark:hover:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-500/10 transition-all border border-slate-200 dark:border-slate-700 uppercase tracking-wide"
                    >
                        {p}
                    </button>
                ))}
              </div>

              <div className="p-2 bg-slate-50/50 dark:bg-slate-800/50 rounded-none border border-slate-100 dark:border-slate-700 flex justify-center">
                  <DayPicker
                      mode="range"
                      selected={tempRange}
                      onSelect={handleSelect}
                      numberOfMonths={1}
                      className="rdp-custom dark:text-slate-300"
                      showOutsideDays
                  />
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Start
                      </label>
                      <input 
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-none px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 dark:focus:border-sky-500 shadow-sm"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> End
                      </label>
                      <input 
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-none px-2.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 dark:focus:border-sky-500 shadow-sm"
                      />
                  </div>
              </div>

              <div className="mt-2 flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3.5 rounded-none border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Selected Period</span>
                      <span className="text-xs font-semibold text-blue-700 dark:text-sky-400 mt-0.5">
                          {tempRange?.from ? format(tempRange.from, 'MMM d') : '-'}
                          {tempRange?.to ? ` → ${format(tempRange.to, 'MMM d')}` : ''}
                      </span>
                  </div>
                  <button 
                      onClick={applyRange}
                      disabled={!tempRange?.from}
                      className="px-5 py-2 bg-blue-600 dark:bg-sky-600 hover:bg-blue-700 dark:hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-none transition-all shadow-sm active:scale-95"
                  >
                  Confirm
                  </button>
              </div>
            </div>,
         document.body
       )}

       <style>{`
          .rdp-custom { 
            --rdp-accent-color: #0284c7; 
            margin: 0;
            font-family: inherit;
          }
          .rdp-custom .rdp-day_selected, 
          .rdp-custom .rdp-day_selected:focus-visible, 
          .rdp-custom .rdp-day_selected:hover { 
            background-color: #0284c7 !important; 
            color: white !important; 
            font-weight: 700;
          }
          .rdp-custom .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { 
            background-color: #f1f5f9; 
            color: #1e293b; 
          }
          .rdp-custom .rdp-head_cell { 
            font-weight: 700; 
            font-size: 0.65rem; 
            color: #94a3b8; 
            text-transform: uppercase;
            padding-bottom: 0.5rem;
          }
          .rdp-custom .rdp-caption_label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            color: #1e293b;
            letter-spacing: 0.05em;
          }
          .rdp-custom .rdp-nav_button {
            color: #94a3b8;
          }
          .rdp-custom .rdp-nav_button:hover {
            color: #0284c7;
            background: transparent;
          }
          .rdp-custom .rdp-day {
            font-size: 0.7rem;
            font-weight: 600;
            width: 32px;
            height: 32px;
            color: #475569;
          }
          .rdp-custom .rdp-day_today {
            color: #0284c7;
            font-weight: 800;
          }
          .rdp-custom .rdp-day_outside {
            color: #cbd5e1;
          }
       `}</style>
    </div>
  );
}
