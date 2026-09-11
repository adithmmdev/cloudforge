import { MessageSquare, Plus, Trash2 } from 'lucide-react';

function groupSessions(sessions) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = { Today: [], Yesterday: [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.created_at || s.updated_at || Date.now());
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else groups.Older.push(s);
  }
  return groups;
}

export default function SessionSidebar({
  sessions = [],
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  projectId,
}) {
  const groups = groupSessions(sessions);

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col h-full overflow-hidden transition-all"
      style={{ background: '#020203', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          disabled={!projectId}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all shadow-sm group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDEF' }}
          onMouseEnter={e => { if(projectId) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={e => { if(projectId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
              style={{ background: 'rgba(94,106,210,0.15)' }}>
              <Plus size={13} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-sm font-medium">New Chat</span>
          </div>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4" style={{ scrollbarWidth: 'none' }}>
        {sessions.length === 0 ? (
          <div className="text-center py-10 opacity-70">
            <MessageSquare size={20} className="mx-auto mb-3" style={{ color: '#8A8F98' }} />
            <p className="text-xs font-medium" style={{ color: '#8A8F98' }}>No history</p>
          </div>
        ) : (
          Object.entries(groups).map(([group, items]) =>
            items.length === 0 ? null : (
              <div key={group} className="mb-6">
                <p className="text-[11px] font-semibold px-3 pb-2 tracking-wide uppercase" style={{ color: '#8A8F98' }}>{group}</p>
                <div className="space-y-0.5">
                  {items.map(s => {
                    const isActive = activeSessionId === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`group relative flex items-center rounded-xl px-3 py-2 cursor-pointer transition-all duration-200`}
                        style={{
                          background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                          color: isActive ? '#EDEDEF' : '#8A8F98',
                          border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`
                        }}
                        onMouseEnter={e => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = '#EDEDEF';
                        }}
                        onMouseLeave={e => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = isActive ? '#EDEDEF' : '#8A8F98';
                        }}
                        onClick={() => onSelectSession(s.id)}
                      >
                        <span className="flex-1 text-sm truncate pr-6 font-medium">
                          {s.title || 'New Chat'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                          className={`absolute right-2 p-1.5 rounded-lg transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ color: '#8A8F98' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#fb7185'; e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#8A8F98'; e.currentTarget.style.background = 'transparent'; }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
