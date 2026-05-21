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
          className="absolute left-0 z-20 w-10 h-[40px] flex items-center justify-start bg-gradient-to-r from-white dark:from-slate-900 from-30% to-transparent pointer-events-auto cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
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
          className="absolute right-0 z-20 w-10 h-[40px] flex items-center justify-end bg-gradient-to-l from-white dark:from-slate-900 from-30% to-transparent pointer-events-auto cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all">
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </div>
        </button>
      )}
    </div>
  );
}
