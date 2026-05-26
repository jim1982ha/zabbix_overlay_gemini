import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ScrollableBar({ children }: { children: ReactNode }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 3);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    
    let observer: ResizeObserver;
    if (scrollContainerRef.current) {
      observer = new ResizeObserver(() => checkScroll());
      observer.observe(scrollContainerRef.current);
      if (scrollContainerRef.current.firstElementChild) {
        observer.observe(scrollContainerRef.current.firstElementChild);
      }
    }

    const timeoutId = setTimeout(checkScroll, 100);
    return () => {
      window.removeEventListener('resize', checkScroll);
      if (observer) observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [checkScroll, children]);

  return (
    <div className="relative flex items-center flex-grow min-w-0 w-full overflow-hidden">
      {canScrollLeft && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: -180, behavior: 'smooth' });
            }
          }}
          className="absolute left-0 z-20 h-full w-8 flex items-center justify-start bg-gradient-to-r from-white dark:from-slate-900 from-40% to-transparent pointer-events-auto border-none outline-none select-none"
        >
          <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:scale-105 active:scale-95 transition-all">
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </button>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-2 items-center flex-1 overflow-x-auto scrollbar-hide scroll-smooth py-1"
      >
        {children}
      </div>

      {canScrollRight && (
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: 180, behavior: 'smooth' });
            }
          }}
          className="absolute right-0 z-20 h-full w-8 flex items-center justify-end bg-gradient-to-l from-white dark:from-slate-900 from-40% to-transparent pointer-events-auto border-none outline-none select-none"
        >
          <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:scale-105 active:scale-95 transition-all">
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </button>
      )}
    </div>
  );
}
