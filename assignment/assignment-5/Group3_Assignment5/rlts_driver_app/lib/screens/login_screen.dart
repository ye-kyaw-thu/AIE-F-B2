import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../i18n/translations.dart';
import '../services/api_service.dart';
import '../state/app_state.dart';

const List<Map<String, String>> kDemoAccounts = [
  {"label": "Driver (U Aung Ko)", "username": "driver", "password": "driver123"},
  {"label": "Driver 2 (Daw Hla Hla Win)", "username": "driver2", "password": "driver123"},
];

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _api = ApiService();
  bool _loading = false;
  String? _error;

  Future<void> _submit(String username, String password) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await _api.login(username, password);
      if (!mounted) return;
      await context.read<AppState>().login(session);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("Exception: ", ""));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: SegmentedButton<Lang>(
                      segments: const [
                        ButtonSegment(value: Lang.en, label: Text("EN")),
                        ButtonSegment(value: Lang.mm, label: Text("MM")),
                      ],
                      selected: {app.lang},
                      onSelectionChanged: (s) => app.setLang(s.first),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    app.t("appTitle"),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    "Real-Time Logistics Monitoring for Myanmar Trading",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _usernameCtrl,
                    decoration: InputDecoration(labelText: app.t("username"), border: const OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordCtrl,
                    obscureText: true,
                    decoration: InputDecoration(labelText: app.t("password"), border: const OutlineInputBorder()),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _loading ? null : () => _submit(_usernameCtrl.text, _passwordCtrl.text),
                    child: _loading
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(app.t("signIn")),
                  ),
                  const SizedBox(height: 24),
                  const Text("Demo accounts", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black45)),
                  const SizedBox(height: 8),
                  ...kDemoAccounts.map(
                    (acc) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: OutlinedButton(
                        onPressed: _loading
                            ? null
                            : () {
                                _usernameCtrl.text = acc["username"]!;
                                _passwordCtrl.text = acc["password"]!;
                                _submit(acc["username"]!, acc["password"]!);
                              },
                        child: Text("${acc["label"]}  (${acc["username"]} / ${acc["password"]})", style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
