import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/models.dart';

/// Local-first offline queue — the Flutter equivalent of
/// rlts-myanmar/src/lib/db/dexie-offline.ts's IndexedDB table. Every driver action is
/// written here FIRST, synchronously from the UI's point of view, before any network
/// call is attempted. This is the same "offline is a normal operating state" principle
/// from Logistimo/Open mSupply/OpenLMIS cited throughout the web app.
class OfflineQueue {
  static Database? _db;

  static Future<Database> _database() async {
    if (_db != null) return _db!;
    final path = join(await getDatabasesPath(), "rlts_mm_offline.db");
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_sync_queue (
            eventUuid TEXT PRIMARY KEY,
            shipmentId TEXT NOT NULL,
            checkpointName TEXT NOT NULL,
            eventType TEXT NOT NULL,
            notes TEXT,
            photoPath TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            clientRecordedAt TEXT NOT NULL,
            status TEXT NOT NULL,
            serverSyncedAt TEXT
          )
        ''');
      },
    );
    return _db!;
  }

  static Future<void> put(PendingSyncRecord record) async {
    final db = await _database();
    // eventUuid is the primary key, so re-submitting the same event is idempotent
    // client-side too, not just on the server.
    await db.insert("pending_sync_queue", record.toDbMap(), conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<List<PendingSyncRecord>> queuedOldestFirst() async {
    final db = await _database();
    final rows = await db.query(
      "pending_sync_queue",
      where: "status = ?",
      whereArgs: ["QUEUED_LOCALLY"],
      orderBy: "clientRecordedAt ASC",
    );
    return rows.map(PendingSyncRecord.fromDbMap).toList();
  }

  static Future<List<PendingSyncRecord>> all() async {
    final db = await _database();
    final rows = await db.query("pending_sync_queue", orderBy: "clientRecordedAt DESC");
    return rows.map(PendingSyncRecord.fromDbMap).toList();
  }

  static Future<void> markSynced(String eventUuid, String serverSyncedAt) async {
    final db = await _database();
    await db.update(
      "pending_sync_queue",
      {"status": "SYNCED", "serverSyncedAt": serverSyncedAt},
      where: "eventUuid = ?",
      whereArgs: [eventUuid],
    );
  }

  static Future<int> pendingCount() async {
    final db = await _database();
    final result = await db.rawQuery(
      "SELECT COUNT(*) as c FROM pending_sync_queue WHERE status = 'QUEUED_LOCALLY'",
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
