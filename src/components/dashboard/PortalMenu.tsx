import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export function PortalMenu({ isOpen, onClose, anchorRef, children, minWidth = 140, align = 'left', className }: any) {
  const [coords, setCoords] = useState<{ top: number, left: number, width: number, origin: string } | null>(null);

  useLayoutEffect(() => {
    if (isOpen && anchorRef.current) {
      const updatePosition = () => {
        if (!anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        let left = rect.left;
        if (align === 'right') {
          left = rect.right - minWidth;
        }
        
        left = Math.max(16, Math.min(left, window.innerWidth - minWidth - 16));
        const fitsBelow = window.innerHeight - rect.bottom > 250;
        
        setCoords({
          top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 250 - 4), // 250 is max dropdown height approx
          left,
          width: Math.max(rect.width, minWidth),
          origin: fitsBelow ? (align === 'right' ? 'top-right' : 'top-left') : (align === 'right' ? 'bottom-right' : 'bottom-left')
        });
      };
      
      updatePosition();
      
      window.addEventListener('scroll', updatePosition, true);
      return () => window.removeEventListener('scroll', updatePosition, true);
    } else if (!isOpen) {
      setCoords(null);
    }
  }, [isOpen, anchorRef, minWidth, align]);

  return createPortal(
    <>
      {isOpen && coords && (
        <React.Fragment key="portal-menu">
          <div className="fixed inset-0 z-[200]" onClick={onClose} />
          <div 
             className={cn(
               "fixed z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg overflow-hidden flex flex-col pointer-events-auto",
               "animate-in fade-in zoom-in-95 duration-100",
               `origin-${coords.origin}`,
               className
             )}
             style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
          >
            {children}
          </div>
        </React.Fragment>
      )}
    </>,
    document.body
  );
}
