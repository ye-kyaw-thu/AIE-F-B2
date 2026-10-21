import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

const _kSessionKey = "rlts_mm_session_v1";

class SessionService {
  static Future<void> save(Session session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kSessionKey, jsonEncode(session.toJson()));
  }

  static Future<Session?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kSessionKey);
    if (raw == null) return null;
    try {
      return Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kSessionKey);
  }
}
