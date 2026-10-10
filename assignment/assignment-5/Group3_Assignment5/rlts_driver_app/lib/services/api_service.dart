import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/models.dart';

class TelemetryPostResult {
  final bool applied;
  final String batchRef;
  final String serverSyncedAt;
  TelemetryPostResult({required this.applied, required this.batchRef, required this.serverSyncedAt});
}

/// Talks to the same /api/* routes the web portal uses
/// (rlts-myanmar/src/app/api/*) — this is what makes "synced to driver and trader and
/// web portal" true across a native app boundary, not just across browser tabs.
class ApiService {
  Future<Session> login(String username, String password) async {
    final res = await http.post(
      Uri.parse("$kApiBaseUrl/auth/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"username": username, "password": password}),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200 || body["ok"] != true) {
      throw Exception(body["error"] ?? "Login failed");
    }
    return Session.fromJson(body["session"] as Map<String, dynamic>);
  }

  Future<List<Shipment>> fetchShipmentsForDriver(String driverUsername) async {
    final res = await http.get(Uri.parse("$kApiBaseUrl/state"));
    if (res.statusCode != 200) throw Exception("Failed to reach the server (${res.statusCode})");
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final all = (body["shipments"] as List).cast<Map<String, dynamic>>().map(Shipment.fromJson).toList();
    return all.where((s) => s.driverUsername == driverUsername).toList();
  }

  /// Idempotent on eventUuid — POSTing the same record twice (a retried "Sync Now") is a
  /// safe no-op, mirrors the web driver's sync-engine.ts and the server's own rule.
  Future<TelemetryPostResult> postTelemetry(PendingSyncRecord record, String? photoDataUrl) async {
    final res = await http.post(
      Uri.parse("$kApiBaseUrl/telemetry"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "eventUuid": record.eventUuid,
        "shipmentId": record.shipmentId,
        "checkpointName": record.checkpointName,
        "eventType": record.eventType,
        "notes": record.notes,
        "photoDataUrl": photoDataUrl,
        "lat": record.lat,
        "lng": record.lng,
        "clientRecordedAt": record.clientRecordedAt,
      }),
    );
    if (res.statusCode != 200) {
      throw Exception("Sync failed (${res.statusCode})");
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return TelemetryPostResult(
      applied: body["applied"] as bool,
      batchRef: body["batchRef"] as String,
      serverSyncedAt: body["serverSyncedAt"] as String,
    );
  }
}
