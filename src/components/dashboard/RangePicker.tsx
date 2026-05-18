import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, subDays, subHours, startOfToday, endOfToday } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown, Clock, Zap, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface RangePickerProps {
  range: { start: string; end: string };
  onChange: (range: { start: string; end: string }) => void;
}

export function RangePicker({ range, onChange }: RangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, height: 0, windowHeight: 0 });
  
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
  useEffect(() => {
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
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
          windowHeight: window.innerHeight
        });
      }
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
    <div className="relative flex-1 min-w-full sm:min-w-[200px] h-full" ref={containerRef}>
       <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-transparent hover:bg-slate-50 rounded-md py-1 px-2 text-sm font-medium text-slate-700 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full"
       >
         <span className="flex items-center gap-2 truncate">
           <span className="text-slate-500 font-normal">Analysis Period:</span>
           <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
           <span className="truncate font-semibold text-slate-800">{displayText}</span>
         </span>
         <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300", isOpen && "-rotate-180")} />
       </button>

       {isOpen && createPortal(
           <motion.div 
              ref={popoverRef}
              style={{ 
                ...(coords.bottom - window.scrollY + 400 > coords.windowHeight && coords.top - window.scrollY - 400 > 0
                  ? { top: coords.top - 400 } // approximate rendering above
                  : { top: coords.bottom + 8 }),
                left: Math.max(16, coords.left + coords.width - 340), // Prefer right alignment relative to button
                maxHeight: 'calc(100vh - 32px)',
              }}
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              className="absolute z-[1001] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-[340px] flex flex-col gap-4 pointer-events-auto overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> Select Range
                </span>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="flex gap-2">
                {['today', '24h', '7d', '30d'].map(p => (
                    <button 
                        key={p}
                        onClick={() => setPreset(p as any)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:text-blue-700 hover:bg-blue-50 transition-all border border-slate-200 uppercase tracking-wide"
                    >
                        {p}
                    </button>
                ))}
              </div>

              <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-100 flex justify-center">
                  <DayPicker
                      mode="range"
                      selected={tempRange}
                      onSelect={handleSelect}
                      numberOfMonths={1}
                      className="rdp-custom"
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm"
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                      />
                  </div>
              </div>

              <div className="mt-2 flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Selected Period</span>
                      <span className="text-xs font-semibold text-blue-700 mt-0.5">
                          {tempRange?.from ? format(tempRange.from, 'MMM d') : '-'}
                          {tempRange?.to ? ` → ${format(tempRange.to, 'MMM d')}` : ''}
                      </span>
                  </div>
                  <button 
                      onClick={applyRange}
                      disabled={!tempRange?.from}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-sm active:scale-95"
                  >
                  Confirm
                  </button>
              </div>
            </motion.div>,
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
