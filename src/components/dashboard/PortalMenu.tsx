import React, { useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export function PortalMenu({ isOpen, onClose, anchorRef, children, minWidth = 140, align = 'left' }: any) {
  const [coords, setCoords] = useState<{ top: number, left: number, width: number } | null>(null);

  useLayoutEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      let left = rect.left;
      if (align === 'right') {
        left = rect.right - minWidth;
      }
      
      left = Math.max(16, Math.min(left, window.innerWidth - minWidth - 16));
      
      setCoords({
        top: rect.bottom + 4,
        left,
        width: Math.max(rect.width, minWidth)
      });
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
               align === 'right' ? "origin-top-right" : "origin-top-left"
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
