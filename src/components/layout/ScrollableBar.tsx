import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ScrollableBar({ children }: { children: ReactNode }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    
    let observer: ResizeObserver;
    if (scrollContainerRef.current) {
      observer = new ResizeObserver(() => checkScroll());
      observer.observe(scrollContainerRef.current);
      // also observe the child to catch content size changes
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
    <div className="relative flex items-center flex-1 min-w-0 h-full w-full py-1">
      {canScrollLeft && (
        <button 
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
            }
          }}
          className="absolute left-0 z-20 w-8 h-full flex items-center justify-start bg-gradient-to-r from-white dark:from-slate-900 from-50% to-transparent pointer-events-auto"
        >
          <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700 hover:shadow transition-all">
            <ChevronLeft className="w-4 h-4" />
          </div>
        </button>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-2 items-center flex-1 overflow-x-auto scrollbar-hide scroll-smooth h-[40px]"
      >
        {children}
      </div>

      {canScrollRight && (
        <button 
          onClick={() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
            }
          }}
          className="absolute right-0 z-20 w-8 h-full flex items-center justify-end bg-gradient-to-l from-white dark:from-slate-900 from-50% to-transparent pointer-events-auto"
        >
          <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-700 hover:shadow transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      )}
    </div>
  );
}
