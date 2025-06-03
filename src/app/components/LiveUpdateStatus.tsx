'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, Wifi, Zap } from 'lucide-react';

export default function LiveUpdateStatus() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [mounted, setMounted] = useState(false);

  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS;
  const isWebSocketEnabled = !!heliusApiKey;

  useEffect(() => {
    setMounted(true);
    
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleNotificationToggle = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }

    if (notificationPermission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }

    if (notificationPermission === 'default' || notificationPermission === 'granted') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === 'granted');
      
      if (permission === 'granted') {
        new Notification('Solcials', {
          body: '🎉 Live notifications enabled! You\'ll be notified of new posts.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  if (!mounted) {
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
            onClick={handleNotificationToggle}
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