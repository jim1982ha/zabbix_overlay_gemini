import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function PortalMenu({ isOpen, onClose, anchorRef, children, minWidth = 140, align = 'left' }: any) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
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
    }
  }, [isOpen, anchorRef, minWidth, align]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="portal-menu">
          <div className="fixed inset-0 z-[200]" onClick={onClose} />
          <motion.div 
             initial={{ opacity: 0, y: -5, scale: 0.98 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: -5, scale: 0.98 }}
             transition={{ duration: 0.15 }}
             className={cn(
               "fixed z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg overflow-hidden flex flex-col pointer-events-auto"
             )}
             style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
          >
            {children}
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body
  );
}
