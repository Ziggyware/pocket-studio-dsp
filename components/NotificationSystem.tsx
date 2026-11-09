import React, { useEffect, useState } from 'react';
import { Notification } from '../types';

interface NotificationSystemProps {
  notifications: Notification[];
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications }) => {
  const [displayList, setDisplayList] = useState<Notification[]>([]);

  useEffect(() => {
    // Keep last 5
    setDisplayList(notifications.slice(-5));
  }, [notifications]);

  return (
    <div className="fixed top-[70px] right-4 z-[100] flex flex-col items-end space-y-1 pointer-events-none font-mono">
      {displayList.map((notif) => (
        <div 
          key={notif.id} 
          className="animate-in slide-in-from-right fade-in duration-300 flex items-center bg-black/80 backdrop-blur border-l-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)] px-3 py-1.5 max-w-[300px]"
        >
          <div className="flex flex-col">
              <div className="flex items-center space-x-2 text-[8px] text-slate-500 uppercase tracking-widest border-b border-white/5 pb-0.5 mb-0.5">
                  <span className="text-cyan-600">SYS.LOG</span>
                  <span>{new Date(notif.timestamp).toISOString().split('T')[1].split('.')[0]}</span>
                  <span className="text-slate-700">::0x{notif.id.slice(-4).toUpperCase()}</span>
              </div>
              <span className={`text-[10px] font-bold ${
                  notif.type === 'error' ? 'text-red-400' : 
                  notif.type === 'success' ? 'text-green-400' : 
                  notif.type === 'warning' ? 'text-yellow-400' : 'text-cyan-200'
              }`}>
                  {notif.message}
              </span>
          </div>
        </div>
      ))}
    </div>
  );
};