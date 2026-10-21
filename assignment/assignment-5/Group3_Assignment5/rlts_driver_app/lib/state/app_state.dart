import 'package:flutter/foundation.dart';
import '../i18n/translations.dart';
import '../models/models.dart';
import '../services/session_service.dart';

class AppState extends ChangeNotifier {
  Session? session;
  Lang lang = Lang.en;
  bool hydrated = false;

  Future<void> hydrate() async {
    session = await SessionService.read();
    hydrated = true;
    notifyListeners();
  }

  Future<void> login(Session s) async {
    session = s;
    await SessionService.save(s);
    notifyListeners();
  }

  Future<void> logout() async {
    session = null;
    await SessionService.clear();
    notifyListeners();
  }

  void setLang(Lang l) {
    lang = l;
    notifyListeners();
  }

  String t(String key) => kTranslations[lang]?[key] ?? kTranslations[Lang.en]![key] ?? key;
}
