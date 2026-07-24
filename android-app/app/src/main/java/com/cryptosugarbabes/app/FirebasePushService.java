package com.cryptosugarbabes.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public final class FirebasePushService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences("push", MODE_PRIVATE).edit().putString("token", token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        String path = message.getData().get("path");
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\")) {
            path = "/dashboard#messages";
        }

        Intent openApp = new Intent(this, MainActivity.class)
            .putExtra(MainActivity.EXTRA_PATH, path)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            path.hashCode(),
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new Notification.Builder(this, MainActivity.CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Crypto Sugar")
            .setContentText("You have a new private message.")
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        getSystemService(NotificationManager.class).notify(message.getMessageId() == null ? path.hashCode() : message.getMessageId().hashCode(), notification);
    }
}
