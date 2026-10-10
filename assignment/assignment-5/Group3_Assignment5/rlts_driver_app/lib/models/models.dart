/// Shared models, mirroring rlts-myanmar/src/lib/types.ts so the two codebases stay in
/// sync conceptually even though there's no shared package between a Next.js app and a
/// Flutter app.
library;

class Session {
  final String username;
  final String displayName;
  final String role;

  Session({required this.username, required this.displayName, required this.role});

  Map<String, dynamic> toJson() => {"username": username, "displayName": displayName, "role": role};

  factory Session.fromJson(Map<String, dynamic> json) => Session(
        username: json["username"] as String,
        displayName: json["displayName"] as String,
        role: json["role"] as String,
      );
}

class Shipment {
  final String id;
  final String trackingNumber;
  final String traderName;
  final String? driverUsername;
  final String cargoType;
  final double cargoWeightTons;
  final double cargoValue;
  final String cargoValueCurrency;
  final String originName;
  final String destinationName;
  final String targetGateId;
  final String currentStatus;
  final double currentLat;
  final double currentLng;
  final double routeProgress;
  final bool isDelayed;
  final String? delayReason;
  final String estimatedArrival;

  Shipment({
    required this.id,
    required this.trackingNumber,
    required this.traderName,
    required this.driverUsername,
    required this.cargoType,
    required this.cargoWeightTons,
    required this.cargoValue,
    required this.cargoValueCurrency,
    required this.originName,
    required this.destinationName,
    required this.targetGateId,
    required this.currentStatus,
    required this.currentLat,
    required this.currentLng,
    required this.routeProgress,
    required this.isDelayed,
    required this.delayReason,
    required this.estimatedArrival,
  });

  factory Shipment.fromJson(Map<String, dynamic> json) => Shipment(
        id: json["id"] as String,
        trackingNumber: json["trackingNumber"] as String,
        traderName: json["traderName"] as String? ?? "",
        driverUsername: json["driverUsername"] as String?,
        cargoType: json["cargoType"] as String? ?? "",
        cargoWeightTons: (json["cargoWeightTons"] as num?)?.toDouble() ?? 0,
        cargoValue: (json["cargoValue"] as num?)?.toDouble() ?? 0,
        cargoValueCurrency: json["cargoValueCurrency"] as String? ?? "USD",
        originName: json["originName"] as String? ?? "",
        destinationName: json["destinationName"] as String? ?? "",
        targetGateId: json["targetGateId"] as String? ?? "",
        currentStatus: json["currentStatus"] as String? ?? "PICKED_UP",
        currentLat: (json["currentLat"] as num?)?.toDouble() ?? 0,
        currentLng: (json["currentLng"] as num?)?.toDouble() ?? 0,
        routeProgress: (json["routeProgress"] as num?)?.toDouble() ?? 0,
        isDelayed: json["isDelayed"] as bool? ?? false,
        delayReason: json["delayReason"] as String?,
        estimatedArrival: json["estimatedArrival"] as String? ?? "",
      );
}

/// Row shape for the local sqflite pending_sync_queue — mirrors
/// rlts-myanmar/src/lib/db/dexie-offline.ts's PendingSyncRecord exactly, field for
/// field, so the two clients queue and sync the same way.
class PendingSyncRecord {
  final String eventUuid;
  final String shipmentId;
  final String checkpointName;
  final String eventType; // 'ARRIVED' | 'CLEARED' | 'DELAY_REPORTED'
  final String? notes;
  final String? photoPath; // local file path; base64-encoded into photoDataUrl at sync time
  final double lat;
  final double lng;
  final String clientRecordedAt;
  String status; // 'QUEUED_LOCALLY' | 'SYNCED'
  String? serverSyncedAt;

  PendingSyncRecord({
    required this.eventUuid,
    required this.shipmentId,
    required this.checkpointName,
    required this.eventType,
    required this.notes,
    required this.photoPath,
    required this.lat,
    required this.lng,
    required this.clientRecordedAt,
    required this.status,
    this.serverSyncedAt,
  });

  Map<String, dynamic> toDbMap() => {
        "eventUuid": eventUuid,
        "shipmentId": shipmentId,
        "checkpointName": checkpointName,
        "eventType": eventType,
        "notes": notes,
        "photoPath": photoPath,
        "lat": lat,
        "lng": lng,
        "clientRecordedAt": clientRecordedAt,
        "status": status,
        "serverSyncedAt": serverSyncedAt,
      };

  factory PendingSyncRecord.fromDbMap(Map<String, dynamic> m) => PendingSyncRecord(
        eventUuid: m["eventUuid"] as String,
        shipmentId: m["shipmentId"] as String,
        checkpointName: m["checkpointName"] as String,
        eventType: m["eventType"] as String,
        notes: m["notes"] as String?,
        photoPath: m["photoPath"] as String?,
        lat: (m["lat"] as num).toDouble(),
        lng: (m["lng"] as num).toDouble(),
        clientRecordedAt: m["clientRecordedAt"] as String,
        status: m["status"] as String,
        serverSyncedAt: m["serverSyncedAt"] as String?,
      );
}
