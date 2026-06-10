import React from 'react';
import { C, Spinner } from './Shared';
import { messagingApi } from '../api';

// ── Formatage heure ───────────────────────────────────────────────────────────
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function Messaging({ user, navigate }) {
  const [conversations, setConversations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeConv, setActiveConv] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [msgLoading, setMsgLoading] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef(null);
  const pollRef = React.useRef(null);

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await messagingApi.conversations();
      setConversations(res.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = React.useCallback(async (convId) => {
    setMsgLoading(true);
    try {
      const res = await messagingApi.messages(convId);
      setMessages(res.data || []);
    } catch { /* ignore */ }
    setMsgLoading(false);
  }, []);

  React.useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Poll messages toutes les 5s si une conversation est ouverte
  React.useEffect(() => {
    if (!activeConv) return;
    pollRef.current = setInterval(() => loadMessages(activeConv.id), 5000);
    return () => clearInterval(pollRef.current);
  }, [activeConv, loadMessages]);

  // Scroll vers le bas à chaque nouveau message
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConv = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    await loadMessages(conv.id);
    // Refresh conversations pour màj unread count
    loadConversations();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !activeConv) return;
    setSending(true);
    setInput('');
    try {
      const res = await messagingApi.sendMessage(activeConv.id, text);
      setMessages(prev => [...prev, res.data]);
      loadConversations();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <div style={{ fontFamily: C.dm, color: C.muted }}>Connectez-vous pour accéder à la messagerie.</div>
          <button onClick={() => navigate('auth', { mode: 'login' })} style={{
            marginTop: 20, background: C.gold, color: C.bg, border: 'none',
            padding: '12px 24px', borderRadius: 10, fontFamily: C.dm, fontWeight: 700, cursor: 'pointer',
          }}>Se connecter</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('home')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>←</button>
          <h1 style={{ fontFamily: C.playfair, fontSize: 28, fontWeight: 700, color: C.text }}>
            💬 Messagerie
          </h1>
        </div>

        {loading ? <Spinner /> : (
          <div className="ac-msg-layout" style={{ display: 'flex', height: 'calc(100vh - 200px)', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>

            {/* Sidebar — liste des conversations */}
            <div className="ac-msg-sidebar" style={{ width: 300, borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ padding: '16px', borderBottom: `1px solid ${C.border2}`, fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Conversations ({conversations.length})
              </div>

              {conversations.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                  Aucune conversation.<br />
                  <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Contactez un vendeur depuis une annonce.</span>
                </div>
              ) : conversations.map(conv => {
                const isActive = activeConv?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => openConv(conv)}
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      background: isActive ? 'rgba(201,169,110,0.08)' : 'transparent',
                      borderBottom: `1px solid ${C.border2}`,
                      borderLeft: isActive ? `3px solid ${C.gold}` : '3px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: isActive ? C.gold : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {conv.i_am_seller ? conv.buyer_name : conv.seller_name}
                      </div>
                      {conv.unread_count > 0 && (
                        <span style={{ background: C.gold, color: C.bg, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.car_label && (
                      <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🚗 {conv.car_label}
                      </div>
                    )}
                    {conv.last_message_content && (
                      <div style={{ fontFamily: C.dm, fontSize: 12, color: C.subtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.last_message_content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Panel — messages */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {!activeConv ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 48 }}>💬</div>
                  <div style={{ fontFamily: C.dm, fontSize: 14, color: C.muted }}>Sélectionnez une conversation</div>
                </div>
              ) : (
                <>
                  {/* Header conversation */}
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.goldDim, border: `1px solid ${C.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.dm, fontSize: 13, fontWeight: 700, color: C.gold }}>
                      {(user.user_type === 'seller' ? activeConv.buyer_name : activeConv.seller_name)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text }}>
                        {user.user_type === 'seller' ? activeConv.buyer_name : activeConv.seller_name}
                      </div>
                      {activeConv.car_label && (
                        <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>🚗 {activeConv.car_label}</div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {msgLoading ? <Spinner /> : messages.map((msg, i) => {
                      const isMine = msg.is_mine;
                      const showDate = i === 0 || fmtDate(messages[i - 1].created_at) !== fmtDate(msg.created_at);
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div style={{ textAlign: 'center', fontFamily: C.dm, fontSize: 11, color: C.muted, margin: '8px 0' }}>
                              {fmtDate(msg.created_at)}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                              maxWidth: '72%', padding: '10px 14px', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isMine ? C.goldDim : '#18181b',
                              border: `1px solid ${isMine ? C.goldBorder : C.border}`,
                            }}>
                              <div style={{ fontFamily: C.dm, fontSize: 14, color: isMine ? C.gold : C.text, lineHeight: 1.5 }}>{msg.content}</div>
                              <div style={{ fontFamily: C.dm, fontSize: 10, color: C.muted, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
                                {fmtTime(msg.created_at)}{isMine && (msg.is_read ? ' ✓✓' : ' ✓')}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border2}`, display: 'flex', gap: 10, flexShrink: 0 }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Écrivez votre message... (Entrée pour envoyer)"
                      rows={1}
                      style={{
                        flex: 1, background: '#18181b', border: `1px solid ${C.border}`,
                        color: C.text, fontFamily: C.dm, fontSize: 14,
                        padding: '10px 14px', borderRadius: 10, outline: 'none',
                        resize: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
                      }}
                      onFocus={e => { e.target.style.borderColor = C.gold; }}
                      onBlur={e => { e.target.style.borderColor = C.border; }}
                    />
                    <button onClick={handleSend} disabled={sending || !input.trim()} style={{
                      background: sending || !input.trim() ? 'rgba(201,169,110,0.3)' : C.gold,
                      border: 'none', color: C.bg, padding: '10px 18px', borderRadius: 10,
                      fontFamily: C.dm, fontWeight: 700, cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                      fontSize: 18, display: 'flex', alignItems: 'center', transition: 'background 0.2s',
                    }}>➤</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
