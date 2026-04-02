'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ghost, Hash, Loader2, Send, ShieldAlert, Vote, X } from 'lucide-react';
import { createClient } from '@/lib/client';

type ChannelConfig = {
  id: string;
  label: string;
  icon: string;
};

type CommunityFeedRow = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  channel: string;
  content: string;
  is_anon: boolean | null;
  ai_flagged: boolean | null;
  created_at: string;
};

type CommunityMessage = {
  id: string;
  author: string;
  author_id: string | null;
  channel: string;
  content: string;
  created_at: string;
  is_anon: boolean;
  ai_flagged: boolean;
  is_mine: boolean;
  is_system?: boolean;
};

type ReplyTarget = Pick<CommunityMessage, 'id' | 'author' | 'content'>;

type Poll = {
  id: string;
  question: string;
  options: string[];
  votes: Record<number, number>;
  total: number;
  created_at?: string;
};

const CHANNELS: ChannelConfig[] = [
  { id: 'global', label: 'Global Lounge', icon: 'GL' },
  { id: 'cs', label: '#CompSci', icon: 'CS' },
  { id: 'mech', label: '#Mechanical', icon: 'ME' },
  { id: 'design', label: '#Design', icon: 'DS' },
  { id: 'confessions', label: 'Confessions', icon: 'AN' },
  { id: 'flash_deals', label: 'Flash Deals', icon: 'FD' },
  { id: 'events', label: 'Events', icon: 'EV' },
];

const QUICK_REPLIES = [
  'Is this still available?',
  'Can we meet at the canteen?',
  "What's the final price?",
  'Can you share more photos?',
  'Is this negotiable?',
];

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toCommunityMessage(
  row: CommunityFeedRow,
  currentUserId: string | null,
): CommunityMessage {
  return {
    id: row.id,
    author: row.is_anon ? 'Anonymous' : row.author_name?.trim() || 'Student',
    author_id: row.author_id,
    channel: row.channel,
    content: row.content,
    created_at: row.created_at,
    is_anon: Boolean(row.is_anon),
    ai_flagged: Boolean(row.ai_flagged),
    is_mine: Boolean(currentUserId && row.author_id === currentUserId),
  };
}

function upsertCommunityMessage(
  currentMessages: CommunityMessage[],
  nextMessage: CommunityMessage,
) {
  const existingIndex = currentMessages.findIndex((message) => message.id === nextMessage.id);

  if (existingIndex === -1) {
    return [...currentMessages, nextMessage].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );
  }

  return currentMessages.map((message, index) =>
    index === existingIndex ? { ...message, ...nextMessage } : message,
  );
}

export default function CampusPulsePage() {
  const supabaseRef = useRef(createClient());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = supabaseRef.current;

  const [activeChannel, setActiveChannel] = useState('global');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [polls, setPolls] = useState<Poll[]>([]);
  const pollsLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
      }
    };

    syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const loadMessages = async () => {
      setError(null);

      const { data, error: loadError } = await supabase
        .from('community_feed')
        .select('id, author_id, author_name, channel, content, is_anon, ai_flagged, created_at')
        .eq('channel', activeChannel)
        .order('created_at', { ascending: true });

      if (loadError) {
        console.error('Feed error:', loadError);
        setMessages([]);
        setError('Could not load the live feed right now.');
        return;
      }

      setMessages((data ?? []).map((row: any) => toCommunityMessage(row, currentUserId)));
    };

    loadMessages();
  }, [activeChannel, currentUserId, supabase]);

  useEffect(() => {
    const loadPolls = async () => {
      try {
        const { data, error } = await supabase
          .from('pulse_polls')
          .select('id, question, options, votes, total, created_at')
          .order('created_at', { ascending: true });
        if (error) throw error;
        setPolls(
          (data ?? []).map((p: any) => ({
            id: p.id,
            question: p.question,
            options: p.options || [],
            votes: p.votes || {},
            total: p.total || 0,
            created_at: p.created_at,
          })),
        );
        pollsLoadedRef.current = true;
      } catch (err) {
        console.error('Poll load error:', err);
        pollsLoadedRef.current = true;
      }
    };
    loadPolls();

    const ch = supabase
      .channel('pulse_polls_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pulse_polls' }, (payload: any) => {
        const row = payload.new as any;
        if (!row) return;
        setPolls((prev) =>
          [...prev.filter((p) => p.id !== row.id), {
            id: row.id,
            question: row.question,
            options: row.options || [],
            votes: row.votes || {},
            total: row.total || 0,
            created_at: row.created_at,
          }].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`community_feed_${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_feed',
          filter: `channel=eq.${activeChannel}`,
        },
        (payload: any) => {
          const nextMessage = toCommunityMessage(payload.new as CommunityFeedRow, currentUserId);

          setMessages((previousMessages) =>
            upsertCommunityMessage(previousMessages, nextMessage),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, currentUserId, supabase]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const messageText = newMessage.trim();
    if (!messageText) {
      return;
    }

    setIsModerating(true);
    setError(null);

    try {
      const moderationResponse = await fetch('/api/moderate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });
      const moderationResult = await moderationResponse.json();

      if (moderationResult.action === 'BLOCK') {
        alert(
          `Message blocked by AI Moderator\n\nReason: ${moderationResult.reason}\n\nPlease review our community guidelines.`,
        );
        return;
      }

      if (moderationResult.action === 'WARN') {
        alert(`AI Warning: ${moderationResult.reason}`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Please sign in before posting to Campus Pulse.');
        return;
      }

      const messageContent = replyingTo
        ? `Reply to @${replyingTo.author}: ${messageText}`
        : messageText;

      const { data: insertedRow, error: insertError } = await supabase
        .from('community_feed')
        .insert({
          content: messageContent,
          channel: activeChannel,
          is_anon: isAnon,
          ai_flagged: Boolean(moderationResult.flagged),
          author_id: user.id,
          author_name:
            user.user_metadata?.student_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Student',
        })
        .select('id, author_id, author_name, channel, content, is_anon, ai_flagged, created_at')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (insertedRow) {
        setMessages((previousMessages) =>
          upsertCommunityMessage(
            previousMessages,
            toCommunityMessage(insertedRow, user.id),
          ),
        );
      }

      setNewMessage('');
      setReplyingTo(null);
    } catch (sendError: unknown) {
      const message =
        sendError instanceof Error ? sendError.message : 'Unknown error while sending message.';

      console.error('Community send error:', sendError);
      setError(message);
      alert(`Error sending message: ${message}`);
    } finally {
      setIsModerating(false);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return;
    const nextVotes = { ...poll.votes, [optionIndex]: (poll.votes[optionIndex] || 0) + 1 };
    const nextTotal = poll.total + 1;
    setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, votes: nextVotes, total: nextTotal } : p)));
    try {
      await supabase.from('pulse_polls').update({ votes: nextVotes, total: nextTotal }).eq('id', pollId);
    } catch (err) {
      console.error('Vote error', err);
    }
  };

  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((option) => option.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    const newPoll: Poll = {
      id: crypto.randomUUID(),
      question: pollQuestion,
      options: validOptions,
      votes: Object.fromEntries(validOptions.map((_, index) => [index, 0])),
      total: 0,
    };
    setPolls((previousPolls) => [...previousPolls, newPoll]);
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollCreate(false);
    try {
      const { error } = await supabase.from('pulse_polls').insert({
        id: newPoll.id,
        question: newPoll.question,
        options: newPoll.options,
        votes: newPoll.votes,
        total: newPoll.total,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Create poll error', err);
    }
  };

  const channelInfo = CHANNELS.find((channel) => channel.id === activeChannel);

  return (
    <div className="h-screen flex flex-col gap-4 bg-zinc-950 p-4 md:p-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>{channelInfo?.icon}</span> Campus Pulse
          </h1>
          <p className="text-zinc-500 text-sm">
            Real-time campus community - {messages.length} messages
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowPollCreate(!showPollCreate)}
            variant="outline"
            className="h-10 rounded-xl border-zinc-800 text-zinc-400 hover:text-white"
          >
            <Vote className="mr-2 h-4 w-4" /> Poll
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 shrink-0">
          {error}
        </div>
      )}

      {showPollCreate && (
        <div className="shrink-0 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 animate-in slide-in-from-top-4 fade-in">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Vote className="h-4 w-4 text-indigo-400" /> Create a Poll
          </h3>

          <input
            value={pollQuestion}
            onChange={(event) => setPollQuestion(event.target.value)}
            placeholder="Ask a question..."
            className="w-full rounded-xl border-0 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {pollOptions.map((option, index) => (
            <input
              key={index}
              value={option}
              onChange={(event) => {
                const nextOptions = [...pollOptions];
                nextOptions[index] = event.target.value;
                setPollOptions(nextOptions);
              }}
              placeholder={`Option ${index + 1}`}
              className="w-full rounded-xl border-0 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ))}

          <div className="flex gap-2">
            <Button
              onClick={handleCreatePoll}
              className="h-9 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500"
            >
              Create Poll
            </Button>
            <Button
              onClick={() => setPollOptions([...pollOptions, ''])}
              variant="outline"
              className="h-9 rounded-xl border-zinc-700 text-sm text-zinc-400"
            >
              + Option
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
        {CHANNELS.map((channel) => (
          <button
            key={channel.id}
            onClick={() => setActiveChannel(channel.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeChannel === channel.id
                ? 'bg-white text-zinc-900'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span>{channel.icon}</span> {channel.label}
          </button>
        ))}
      </div>

      {activeChannel === 'global' && pollsLoadedRef.current && polls.length > 0 && (
        <div className="shrink-0 space-y-3">
          {polls.map((poll) => (
            <div
              key={poll.id}
              className="rounded-2xl border border-indigo-500/20 bg-indigo-900/20 p-4"
            >
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Vote className="h-4 w-4 text-indigo-400" /> {poll.question}
              </p>

              <div className="space-y-2">
                {poll.options.map((option, index) => {
                  const percentage =
                    poll.total > 0
                      ? Math.round(((poll.votes[index] || 0) / poll.total) * 100)
                      : 0;

                  return (
                    <button
                      key={index}
                      onClick={() => handleVote(poll.id, index)}
                      className="flex w-full items-center gap-3 group"
                    >
                      <div className="relative h-9 flex-1 overflow-hidden rounded-xl bg-zinc-800">
                        <div
                          className="h-full bg-indigo-600/30 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-4 text-sm font-medium text-white">
                          {option}
                        </span>
                      </div>
                      <span className="w-10 text-right text-sm font-bold text-zinc-400">
                        {percentage}%
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-xs text-zinc-600">{poll.total} votes</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.is_mine ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ${
                message.is_system
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                  : message.is_anon
                    ? 'bg-zinc-700'
                    : message.is_mine
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}
            >
              {message.is_anon ? (
                <Ghost className="h-4 w-4" />
              ) : message.is_system ? (
                '!'
              ) : (
                message.author.charAt(0).toUpperCase()
              )}
            </div>

            <div
              className={`flex max-w-[75%] flex-col space-y-1 ${
                message.is_mine ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`flex items-center gap-2 ${
                  message.is_mine ? 'flex-row-reverse' : ''
                }`}
              >
                <span className="text-xs font-bold text-zinc-500">
                  {message.is_mine ? 'You' : message.author}
                </span>
                <span className="text-[10px] text-zinc-700">
                  {formatTime(message.created_at)}
                </span>
                {message.ai_flagged && (
                  <Badge className="bg-amber-600/20 text-[10px] text-amber-400">
                    AI Reviewed
                  </Badge>
                )}
              </div>

              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.is_mine
                    ? 'rounded-tr-sm bg-emerald-600 text-white'
                    : message.is_system
                      ? 'rounded-tl-sm border border-amber-500/20 bg-amber-500/10 text-amber-200'
                      : message.is_anon
                        ? 'rounded-tl-sm bg-zinc-800 text-zinc-200'
                        : 'rounded-tl-sm bg-zinc-800 text-zinc-100'
                }`}
              >
                {message.content}
              </div>

              <button
                onClick={() =>
                  setReplyingTo({
                    id: message.id,
                    author: message.author,
                    content: message.content,
                  })
                }
                className="flex items-center gap-1 px-1 text-[10px] text-zinc-700 transition-colors hover:text-zinc-400"
              >
                Reply
              </button>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {showQuickReplies && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_REPLIES.map((quickReply) => (
            <button
              key={quickReply}
              onClick={() => {
                setNewMessage(quickReply);
                setShowQuickReplies(false);
              }}
              className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              {quickReply}
            </button>
          ))}
        </div>
      )}

      {replyingTo && (
        <div className="flex shrink-0 items-center gap-3 rounded-xl border-l-2 border-indigo-500 bg-zinc-800/50 px-4 py-2">
          <p className="flex-1 text-xs text-zinc-400">
            Replying to <span className="font-bold text-white">{replyingTo.author}</span>:{' '}
            {replyingTo.content.slice(0, 50)}
            {replyingTo.content.length > 50 ? '...' : ''}
          </p>
          <button onClick={() => setReplyingTo(null)}>
            <X className="h-4 w-4 text-zinc-500 hover:text-zinc-300" />
          </button>
        </div>
      )}

      {activeChannel !== 'flash_deals' && (
        <form onSubmit={handleSend} className="flex gap-2 shrink-0">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 transition-colors focus-within:border-indigo-500">
            <Badge className="flex items-center gap-1 bg-zinc-700 text-[10px] text-zinc-400">
              <ShieldAlert className="h-2.5 w-2.5" /> AI Mod Active
            </Badge>

            {activeChannel === 'confessions' && (
              <button
                type="button"
                onClick={() => setIsAnon(!isAnon)}
                className={`rounded-lg p-1.5 transition-colors ${
                  isAnon
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Ghost className="h-4 w-4" />
              </button>
            )}

            <input
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder={`Message ${
                activeChannel === 'confessions' ? '#confessions' : `#${activeChannel}`
              }...`}
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className="text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <Hash className="h-4 w-4" />
            </button>
          </div>

          <Button
            type="submit"
            disabled={isModerating || !newMessage.trim()}
            className="h-12 w-12 shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isModerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
