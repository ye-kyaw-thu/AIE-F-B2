import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

enum NetworkState { online, slow2g, offline }

/// Real device connectivity, mirroring two OpenIMIS references studied for this build:
///   - The connectivity-status STREAM pattern from
///     openimis/mobile-self_registration_flutter (lib/services/connectivity.dart),
///     which wraps the (now-unmaintained) `connectivity` package's
///     onConnectivityChanged stream into a small app-specific enum. This class does the
///     same thing with the maintained connectivity_plus package.
///   - Neither OpenIMIS Flutter app actually queues anything offline (both are online-only
///     GraphQL clients) — see rlts-myanmar/README.md for the fuller comparison — so the
///     queueing/sync behavior below is this app's own design, not ported from OpenIMIS.
///
/// A manual override is layered on top for the live demo, same idea as the web driver's
/// useRealNetworkState.ts + manual toggle: force a state on cue regardless of the
/// device's actual connectivity, so a presentation doesn't depend on venue wifi behaving.
class ConnectivityService {
  final _controller = StreamController<NetworkState>.broadcast();
  NetworkState _current = NetworkState.online;
  NetworkState? _override;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  Stream<NetworkState> get stream => _controller.stream;
  NetworkState get current => _override ?? _current;
  NetworkState get deviceReported => _current;

  Future<void> start() async {
    final initial = await Connectivity().checkConnectivity();
    _current = _mapResult(initial);
    _emit();
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      _current = _mapResult(results);
      _emit();
    });
  }

  void setOverride(NetworkState? state) {
    _override = state;
    _emit();
  }

  NetworkState _mapResult(List<ConnectivityResult> results) {
    if (results.isEmpty || results.every((r) => r == ConnectivityResult.none)) {
      return NetworkState.offline;
    }
    // connectivity_plus doesn't expose signal quality directly; SLOW_2G on this client
    // is reachable only via the manual override (same as project_detail.md's demo
    // control), not auto-detected — noted as a scope simplification vs. the web app's
    // Network Information API-based SLOW_2G auto-detection.
    return NetworkState.online;
  }

  void _emit() {
    if (!_controller.isClosed) _controller.add(current);
  }

  void dispose() {
    _sub?.cancel();
    _controller.close();
  }
}
