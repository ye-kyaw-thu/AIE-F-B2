import 'dart:async';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../i18n/translations.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';
import '../services/offline_queue.dart';
import '../services/sync_engine.dart';
import '../state/app_state.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  final _api = ApiService();
  late final SyncEngine _syncEngine;
  final _connectivity = ConnectivityService();
  final _uuid = const Uuid();
  final _notesCtrl = TextEditingController();

  Shipment? _shipment;
  bool _loadingShipment = true;
  String? _photoPath;
  List<PendingSyncRecord> _queue = [];
  NetworkState _networkState = NetworkState.online;
  NetworkState? _override;
  String? _lastSyncRef;
  String? _lastAction;
  bool _syncingNow = false;
  Timer? _pollTimer;
  StreamSubscription<NetworkState>? _netSub;

  @override
  void initState() {
    super.initState();
    _syncEngine = SyncEngine(_api);
    _connectivity.start();
    _netSub = _connectivity.stream.listen((state) {
      setState(() => _networkState = state);
      if (state != NetworkState.offline) _flush();
    });
    _loadShipment();
    _refreshQueue();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadShipment());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _netSub?.cancel();
    _connectivity.dispose();
    super.dispose();
  }

  Future<void> _loadShipment() async {
    final app = context.read<AppState>();
    final username = app.session?.username;
    if (username == null) return;
    try {
      final shipments = await _api.fetchShipmentsForDriver(username);
      final active = shipments.where((s) => s.currentStatus != "DELIVERED").toList();
      if (mounted) {
        setState(() {
          _shipment = active.isNotEmpty ? active.first : (shipments.isNotEmpty ? shipments.first : null);
          _loadingShipment = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingShipment = false);
    }
  }

  Future<void> _refreshQueue() async {
    final items = await OfflineQueue.all();
    if (mounted) setState(() => _queue = items);
  }

  Future<void> _flush() async {
    final effective = _override ?? _networkState;
    final result = await _syncEngine.flush(allowNetwork: effective != NetworkState.offline);
    if (result.lastSyncRef != null && mounted) setState(() => _lastSyncRef = result.lastSyncRef);
    await _refreshQueue();
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (file != null && mounted) setState(() => _photoPath = file.path);
  }

  Future<void> _handleAction(String eventType, String label) async {
    final shipment = _shipment;
    if (shipment == null) return;
    if (eventType == "DELIVERED") {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text("Mark as delivered?"),
          content: Text("This finalizes ${shipment.trackingNumber}. This cannot be undone from this screen."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Confirm")),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    final record = PendingSyncRecord(
      eventUuid: _uuid.v4(),
      shipmentId: shipment.id,
      checkpointName: "Checkpoint",
      eventType: eventType,
      notes: _notesCtrl.text.isEmpty ? null : _notesCtrl.text,
      photoPath: _photoPath,
      lat: shipment.currentLat,
      lng: shipment.currentLng,
      clientRecordedAt: DateTime.now().toUtc().toIso8601String(),
      status: "QUEUED_LOCALLY",
    );
    await OfflineQueue.put(record);
    setState(() {
      _lastAction = "$label queued at ${DateFormat.Hms().format(DateTime.now())}";
      _notesCtrl.clear();
      _photoPath = null;
    });
    await _refreshQueue();
    final effective = _override ?? _networkState;
    if (effective != NetworkState.offline) await _flush();
  }

  Color _statusColor(NetworkState s) {
    switch (s) {
      case NetworkState.online:
        return Colors.green;
      case NetworkState.slow2g:
        return Colors.orange;
      case NetworkState.offline:
        return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final effective = _override ?? _networkState;
    final pendingCount = _queue.where((q) => q.status == "QUEUED_LOCALLY").length;

    return Scaffold(
      appBar: AppBar(
        title: Text(app.t("appTitle")),
        actions: [
          SegmentedButton<Lang>(
            segments: const [
              ButtonSegment(value: Lang.en, label: Text("EN")),
              ButtonSegment(value: Lang.mm, label: Text("MM")),
            ],
            selected: {app.lang},
            onSelectionChanged: (s) => app.setLang(s.first),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: app.t("logout"),
            onPressed: () => app.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _loadShipment();
          await _refreshQueue();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Chip(
                  avatar: Icon(pendingCount == 0 ? Icons.cloud_done : Icons.cloud_upload, size: 16),
                  label: Text(pendingCount == 0 ? "All data synced" : "$pendingCount cached locally"),
                  backgroundColor: pendingCount == 0 ? Colors.green.shade50 : Colors.amber.shade50,
                ),
                OutlinedButton.icon(
                  onPressed: effective == NetworkState.offline || _syncingNow
                      ? null
                      : () async {
                          setState(() => _syncingNow = true);
                          await _flush();
                          if (mounted) setState(() => _syncingNow = false);
                        },
                  icon: _syncingNow
                      ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.sync, size: 16),
                  label: Text(app.t("syncNow")),
                ),
              ],
            ),
            if (_lastSyncRef != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text("${app.t("syncRef")}: $_lastSyncRef", style: const TextStyle(fontSize: 10, color: Colors.black45)),
                ),
              ),
            const SizedBox(height: 12),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(app.t("networkStatus"), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.black45)),
                        Text("${app.t("deviceReports")}: ${_networkState.name.toUpperCase()}", style: const TextStyle(fontSize: 10, color: Colors.black45)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SegmentedButton<NetworkState?>(
                      segments: [
                        ButtonSegment(value: null, label: const Text("AUTO", style: TextStyle(fontSize: 11))),
                        ButtonSegment(value: NetworkState.online, label: const Text("ONLINE", style: TextStyle(fontSize: 11))),
                        ButtonSegment(value: NetworkState.offline, label: const Text("OFFLINE", style: TextStyle(fontSize: 11))),
                      ],
                      selected: {_override},
                      onSelectionChanged: (s) {
                        setState(() => _override = s.first);
                        if ((s.first ?? _networkState) != NetworkState.offline) _flush();
                      },
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.circle, size: 8, color: _statusColor(effective)),
                        const SizedBox(width: 4),
                        Text("Effective: ${effective.name.toUpperCase()}", style: const TextStyle(fontSize: 10, color: Colors.black45)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            if (_loadingShipment)
              const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
            else if (_shipment == null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(app.t("noShipmentAssigned"), textAlign: TextAlign.center, style: const TextStyle(color: Colors.black45)),
                ),
              )
            else
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_shipment!.trackingNumber, style: const TextStyle(fontFamily: "monospace", fontWeight: FontWeight.bold)),
                      Text("${_shipment!.originName.split(" ").first} → ${_shipment!.destinationName.split(" ").first}", style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(_shipment!.cargoType, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(
                        "${app.t("cargoValue")}: ${NumberFormat.simpleCurrency(name: _shipment!.cargoValueCurrency).format(_shipment!.cargoValue)}",
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),

            if (_shipment != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined, size: 16, color: Colors.black45),
                      const SizedBox(width: 8),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(fontSize: 11, color: Colors.black45),
                            children: [
                              TextSpan(
                                text: "${_shipment!.currentLat.toStringAsFixed(4)}, ${_shipment!.currentLng.toStringAsFixed(4)}  ",
                                style: const TextStyle(fontFamily: "monospace", color: Colors.black87),
                              ),
                              TextSpan(text: app.t("locationNote")),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(app.t("checkpointActions"), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.black45)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _notesCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(hintText: "Optional note", border: OutlineInputBorder(), isDense: true),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _shipment == null ? null : _pickPhoto,
                      icon: const Icon(Icons.camera_alt, size: 16),
                      label: Text(_photoPath != null ? app.t("photoAttached") : app.t("capturePhoto"), style: const TextStyle(fontSize: 12)),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0284C7), padding: const EdgeInsets.symmetric(vertical: 14)),
                      onPressed: _shipment == null ? null : () => _handleAction("ARRIVED", "Arrived at Checkpoint"),
                      child: Text(app.t("arrived")),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: Colors.green.shade700, padding: const EdgeInsets.symmetric(vertical: 14)),
                      onPressed: _shipment == null ? null : () => _handleAction("CLEARED", "Inspection Passed"),
                      child: Text(app.t("cleared")),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700, padding: const EdgeInsets.symmetric(vertical: 14)),
                      onPressed: _shipment == null ? null : () => _handleAction("DELAY_REPORTED", "Report Delay / Danger"),
                      icon: const Icon(Icons.warning_amber, size: 18),
                      label: Text(app.t("delay")),
                    ),
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F172A), padding: const EdgeInsets.symmetric(vertical: 14)),
                      onPressed: _shipment == null ? null : () => _handleAction("DELIVERED", "Delivered / Handed Over"),
                      icon: const Icon(Icons.done_all, size: 18),
                      label: Text(app.t("delivered")),
                    ),
                    if (_lastAction != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(_lastAction!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Colors.black45)),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(app.t("localQueue"), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.black45)),
                    const SizedBox(height: 8),
                    if (_queue.isEmpty)
                      Text(app.t("nothingQueued"), style: const TextStyle(fontSize: 12, color: Colors.black38))
                    else
                      ..._queue.take(6).map(
                            (q) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      "${q.eventType}  Ref: ${q.eventUuid.substring(0, 8)}",
                                      style: const TextStyle(fontSize: 11),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    q.status,
                                    style: TextStyle(fontSize: 11, color: q.status == "SYNCED" ? Colors.green.shade700 : Colors.orange.shade800),
                                  ),
                                ],
                              ),
                            ),
                          ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
