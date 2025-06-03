'use client';

import React, { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { SolcialsCustomProgramService } from '../utils/solcialsProgram';
import { MessageSquare } from 'lucide-react';

interface ReplyCountProps {
  postId: string;
  initialCount?: number;
}

export default function ReplyCount({ postId, initialCount = 0 }: ReplyCountProps) {
  const [replyCount, setReplyCount] = useState(initialCount);
  const [hasChecked, setHasChecked] = useState(false);
  
  const { connection } = useConnection();

  useEffect(() => {
    const fetchReplyCount = async () => {
      if (hasChecked) return;
      
      try {
        const solcialsProgram = new SolcialsCustomProgramService(connection);
        const replies = await solcialsProgram.getReplies(postId, 100);
        setReplyCount(replies.length);
        setHasChecked(true);
      } catch (error) {
        console.error('Error fetching reply count:', error);
        setHasChecked(true);
      }
    };

    // Only fetch if we don't have an initial count
    if (initialCount === 0 && !hasChecked) {
      fetchReplyCount();
    }
  }, [postId, connection, initialCount, hasChecked]);

  if (replyCount === 0) {
    return null; // Don't show anything if no replies
  }

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <MessageSquare className="h-3 w-3" />
      <span>{replyCount}</span>
    </div>
  );
} 