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
    <div className="w-[260px] flex-shrink-0 border-r border-gray-100/80 bg-slate-50/50 flex flex-col h-full overflow-hidden transition-all">
      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          disabled={!projectId}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-100 text-slate-700 text-sm font-medium transition-all shadow-sm group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <Plus size={13} className="text-indigo-600" />
            </div>
            <span>New Chat</span>
          </div>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4" style={{ scrollbarWidth: 'none' }}>
        {sessions.length === 0 ? (
          <div className="text-center py-10 opacity-70">
            <MessageSquare size={20} className="text-gray-300 mx-auto mb-3" />
            <p className="text-xs text-gray-500 font-medium">No history</p>
          </div>
        ) : (
          Object.entries(groups).map(([group, items]) =>
            items.length === 0 ? null : (
              <div key={group} className="mb-6">
                <p className="text-[11px] font-semibold text-gray-400 px-3 pb-2 tracking-wide">{group}</p>
                <div className="space-y-0.5">
                  {items.map(s => {
                    const isActive = activeSessionId === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`group relative flex items-center rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-white shadow-sm border border-gray-100 text-indigo-900'
                            : 'hover:bg-gray-100/50 text-slate-600 border border-transparent'
                        }`}
                        onClick={() => onSelectSession(s.id)}
                      >
                        <span className="flex-1 text-sm truncate pr-6 font-medium">
                          {s.title || 'New Chat'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                          className={`absolute right-2 p-1.5 rounded-lg transition-all ${
                            isActive ? 'opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
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
