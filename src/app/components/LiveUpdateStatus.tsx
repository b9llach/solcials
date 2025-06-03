'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, Wifi, Zap } from 'lucide-react';
import { Toast } from '../utils/toast';

export default function LiveUpdateStatus() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS;
  const isWebSocketEnabled = !!heliusApiKey;

  useEffect(() => {
    // Check if notifications are supported and enabled
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Simulate live status (you could connect to WebSocket here)
    const interval = setInterval(() => {
      setIsLive(Math.random() > 0.5);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      Toast.error('This browser does not support notifications');
      return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      Toast.success('Notifications enabled!');
    } else if (permission === 'denied') {
      Toast.warning('Notifications are blocked. Please enable them in your browser settings.');
    }
  };

  if (!isLive) {
    return null; // Avoid hydration mismatch
  }

  return (
    <Card className="mb-4 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {isWebSocketEnabled ? (
            <>
              <Zap className="h-4 w-4 text-green-500" />
              real-time updates
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-yellow-500" />
              periodic updates
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isWebSocketEnabled ? (
              <>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  websocket
                </Badge>
                <span>instant notifications</span>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                  http polling
                </Badge>
                <span>5 min intervals</span>
              </>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={requestNotificationPermission}
            className="h-8 px-2"
          >
            {notificationsEnabled ? (
              <>
                <Bell className="h-4 w-4 mr-1" />
                <span className="text-xs">on</span>
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-1" />
                <span className="text-xs">off</span>
              </>
            )}
          </Button>
        </div>

        {!isWebSocketEnabled && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            💡 add your helius api key to .env.local for real-time websocket updates
          </div>
        )}
      </CardContent>
    </Card>
  );
} 