import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'api_service.dart';
import 'offline_queue.dart';

class FlushResult {
  final int synced;
  final int failed;
  final String? lastSyncRef;
  FlushResult({required this.synced, required this.failed, required this.lastSyncRef});
}

/// Store-and-forward sync — same shape as
/// rlts-myanmar/src/lib/sync/sync-engine.ts's flushQueue(): drain the local queue
/// oldest-first, POST each to /api/telemetry, stop (don't lose the rest) on a real
/// failure. The "Sync Now" button calls this directly; connectivity coming back online
/// also calls it automatically.
class SyncEngine {
  final ApiService api;
  SyncEngine(this.api);

  Future<String?> _photoToDataUrl(String? path) async {
    if (path == null) return null;
    final file = File(path);
    if (!await file.exists()) return null;
    final bytes = await file.readAsBytes();
    // Compress to WebP under ~200KB, same budget as the web app's
    // compressImageToWebP() in dexie-offline.ts (project_detail.md section 3.4).
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return "data:image/jpeg;base64,${base64Encode(bytes)}";
    }
    var resized = decoded;
    const maxDim = 1024;
    if (decoded.width > maxDim || decoded.height > maxDim) {
      resized = img.copyResize(decoded, width: decoded.width >= decoded.height ? maxDim : null, height: decoded.height > decoded.width ? maxDim : null);
    }
    Uint8List out = Uint8List.fromList(img.encodeJpg(resized, quality: 70));
    if (out.lengthInBytes > 200000) {
      out = Uint8List.fromList(img.encodeJpg(resized, quality: 40));
    }
    return "data:image/jpeg;base64,${base64Encode(out)}";
  }

  Future<FlushResult> flush({required bool allowNetwork}) async {
    if (!allowNetwork) return FlushResult(synced: 0, failed: 0, lastSyncRef: null);

    final pending = await OfflineQueue.queuedOldestFirst();
    int synced = 0;
    int failed = 0;
    String? lastRef;

    for (final record in pending) {
      try {
        final photoDataUrl = await _photoToDataUrl(record.photoPath);
        final result = await api.postTelemetry(record, photoDataUrl);
        await OfflineQueue.markSynced(record.eventUuid, result.serverSyncedAt);
        lastRef = result.batchRef;
        synced += 1;
      } catch (_) {
        failed += 1;
        break; // real network failure — leave the rest queued, try again next time
      }
    }
    return FlushResult(synced: synced, failed: failed, lastSyncRef: lastRef);
  }
}
